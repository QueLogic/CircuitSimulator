
# Oscilloscope Simulation — **Critical Bug Fix Plan & Patch Guide**

**Goal:** Make the oscilloscope display **authentic NGSpice transient waveforms** that react to component changes and real circuit behavior. This document gives precise, minimal patches to remove synthetic signals, preserve transient analysis, parse real time-series, and fix caching.

---

## Table of Contents
1. [Quick Fix Checklist](#quick-fix-checklist)
2. [Fix #1 — Remove Fake Noise Injection (Client)](#fix-1--remove-fake-noise-injection-client)
3. [Fix #2 — Respect Transient Analysis (Server NGSpice Interface)](#fix-2--respect-transient-analysis-server-ngspice-interface)
4. [Fix #3 — Parse Real Transient Arrays (Server Parser)](#fix-3--parse-real-transient-arrays-server-parser)
5. [Fix #4 — Proper Cache Invalidation (Client)](#fix-4--proper-cache-invalidation-client)
6. [Oscilloscope Panel Wiring](#oscilloscope-panel-wiring)
7. [Optional Dev Feature Flags](#optional-dev-feature-flags)
8. [Validation & Tests](#validation--tests)
9. [Operational Notes (Replit)](#operational-notes-replit)
10. [Acceptance Criteria](#acceptance-criteria)

---

## Quick Fix Checklist

- [ ] **Delete synthetic noise path** from `getNgSpiceSignalAtNode`.
- [ ] **Stop stripping** `.tran` / `.control` in `ngspice-interface.ts`.
- [ ] **Return real time-series** from NGSpice; **remove fake 2‑point arrays**.
- [ ] **Invalidate cache** on **any component/netlist change**; stop returning stale data.
- [ ] Oscilloscope reads **NGSpice transient series**, not math-generated values.
- [ ] Add minimal **tests** to lock behavior.

---

## Fix #1 — Remove Fake Noise Injection (Client)

**File:** `client/src/utils/ngspice-client.ts`  
**Problem:** Math-generated noise overrides physics for any net named `"NOISE"` or `"SCOPE_OUT"`.

### Patch (minimal & safe)
Search for this block (approx. lines 238–244) and **remove it**:
```ts
// Add some realistic noise for noise signals and their AC-coupled outputs
if (targetNet.includes("NOISE") || targetNet.includes("SCOPE_OUT")) {
  const time = Date.now() / 1000;
  const noiseAmplitude = Math.abs(baseVoltage) * 0.15 + 0.01; // Ensure minimum visible noise
  const lowFreqNoise = Math.sin(time * 1000 * Math.PI) * noiseAmplitude * 0.3;
  const highFreqNoise = (Math.random() - 0.5) * noiseAmplitude * 0.7;
  const totalNoise = lowFreqNoise + highFreqNoise;
  return baseVoltage + totalNoise;
}
```

**Replace** with:
```ts
// Return raw NGSpice-derived value (no synthetic noise)
return baseVoltage;
```

> Result: The front-end stops inventing waveforms; it renders whatever NGSpice computed.

---

## Fix #2 — Respect Transient Analysis (Server NGSpice Interface)

**File:** `server/utils/ngspice-interface.ts`  
**Problems:**
- A hardcoded control script runs **only** operating point (`op`), ignoring `.tran`.
- Code **removes** transient analysis from the provided netlist.

### Patch (preserve original analysis)
1. **Remove** the hardcoded `spiceScript` and any logic that **replaces** or **strips** `.tran`, `.control`, or `.end`.  
2. **Pass the original netlist through unchanged**, ensuring there is **exactly one `.end`** at the end.

#### Suggested replacement snippet
```ts
// Helper: ensure the netlist ends with a single `.end`
function ensureSingleEnd(src: string): string {
  const noTrailingEnd = src.replace(/\n?\.end\s*$/i, "");
  return noTrailingEnd.trimEnd() + "\n.end\n";
}

// Build the final netlist exactly as generated upstream (e.g., simple-spice.ts)
const netlist = ensureSingleEnd(originalNetlist);

// Write netlist to temp file and run ngspice in batch
await fs.promises.writeFile(tmpNetlistPath, netlist, "utf8");
const args = ["-b", "-o", tmpLogPath, tmpNetlistPath]; // batch mode, ascii log
await execa("ngspice", args, { timeout: 120000 });
```

> Result: Whatever `.tran` / `.control` block `simple-spice.ts` produced **will be executed**. Nothing is stripped or overridden.

**Tip:** If you must add defaults, **only** append a `.control` block **when the netlist lacks one**, never replace an existing one.

---

## Fix #3 — Parse Real Transient Arrays (Server Parser)

**File:** `server/utils/ngspice-interface.ts`  
**Problems:**
- For OP-only results, code fabricates a 2‑point "transient" like:
  ```ts
  time: [0, 0.001], voltages[node]=[v,v]
  ```
- Transient arrays are **static**, not parsed from NGSpice output.

### Patch (true time-series parsing)
**Remove** the “fake transient” section (approx. lines 294–308) and **replace** with logic that:
1. Detects **Transient Analysis** in NGSpice output (`plotname: Transient Analysis`) or reads a `.raw`/CSV written via `wrdata`.
2. Extracts the **time vector** and **node series** for **every requested node**.
3. Ensures arrays are **same length** and **monotonic in time**.
4. Returns `{ time: number[], voltages: Record<string, number[]>, currents: Record<string, number[]> }`.

#### Example parsing scaffold (ASCII log route)
```ts
interface TransientData {
  time: number[];
  voltages: Record<string, number[]>;
  currents: Record<string, number[]>;
}

function parseTransientAsciiLog(log: string, wantedNodes: string[]): TransientData | null {
  // 1) Detect transient section
  if (!/plotname:\s*Transient Analysis/i.test(log)) return null;

  // 2) Extract "Variables" block to map index -> name (e.g., time, v(noise), v(scope_out))
  const varsBlockMatch = log.match(/Variables:\s*\n([\s\S]*?)\nValues:/i);
  const valuesBlockMatch = log.match(/Values:\s*\n([\s\S]*?)\n\n/iu);
  if (!varsBlockMatch || !valuesBlockMatch) return null;

  const varLines = varsBlockMatch[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const indexToName: string[] = [];
  for (const line of varLines) {
    // e.g., "0   time   time" or "1   v(noise)   voltage"
    const m = line.match(/^\d+\s+([^\s]+)\s+/);
    if (m) indexToName.push(m[1].toLowerCase());
  }

  const timeIdx = indexToName.findIndex(n => n === "time");
  if (timeIdx < 0) return null;

  const wantedIdx = new Map<string, number>(); // key: lower-case v(node)
  for (const n of wantedNodes) {
    const needle = `v(${n.toLowerCase()})`;
    const idx = indexToName.findIndex(vn => vn === needle);
    if (idx >= 0) wantedIdx.set(n, idx);
  }

  // 3) Parse "Values" rows; each row has var columns
  const time: number[] = [];
  const voltages: Record<string, number[]> = Object.fromEntries(
    [...wantedIdx.keys()].map(n => [n, []])
  );

  for (const row of valuesBlockMatch[1].split(/\r?\n/)) {
    const cols = row.trim().split(/\s+/);
    if (cols.length !== indexToName.length) continue;
    const t = Number(cols[timeIdx]);
    if (!Number.isFinite(t)) continue;
    time.push(t);
    for (const [node, idx] of wantedIdx) {
      voltages[node]!.push(Number(cols[idx]));
    }
  }

  return { time, voltages, currents: {} };
}
```

**Return OP-only results as OP**, not fake transient:
```ts
if (!transientData) {
  return { kind: "op", operatingPoint, /* no transientData */ };
}
return { kind: "tran", transientData };
```

> Result: The server provides **real** time-varying arrays. No duplication. No fabrication.

---

## Fix #4 — Proper Cache Invalidation (Client)

**File:** `client/src/utils/circuit-simulation.ts`  
**Problems:**
- Returns cached results even when components changed.
- Kicks off background NGSpice update but still **returns stale** immediately.

### Patch (keyed cache + no stale returns)
1. Create a stable **cache key** from the **netlist/graph**.
```ts
import { createHash } from "crypto";

function getSimKey(components: Component[], analysis?: object): string {
  const payload = JSON.stringify({ components, analysis });
  // Use a simple hash if crypto not available; otherwise SHA‑1 here for determinism.
  // In browser, fallback to MurmurHash or similar.
  return typeof createHash === "function"
    ? createHash("sha1").update(payload).digest("hex")
    : payload;
}
```

2. Replace the stale-return logic (approx. lines 63–67) with:
```ts
const key = getSimKey(components, analysisOptions);
if (cachedNgSpiceResult && cachedNgSpiceResult.success && cachedNgSpiceResult.key === key) {
  return convertNgSpiceToSimulationResults(components, cachedNgSpiceResult);
}

// No valid cache: run NGSpice now (not only in background)
const fresh = await updateNgSpiceSimulation(components, analysisOptions);
cachedNgSpiceResult = { ...fresh, key };
return convertNgSpiceToSimulationResults(components, fresh);
```

> Result: Any change to components or analysis triggers **fresh simulation** before the oscilloscope updates. No stale visuals.

---

## Oscilloscope Panel Wiring

**File:** `client/src/components/circuit/oscilloscope-panel.tsx`  
**Issue:** It calls a function chain that returns math-generated samples.

### Patch
Replace:
```ts
signalValue = getSignalAtNode(components, monitoredNet);
```
With a hook/selectors that pull **transient arrays** from the NGSpice store:
```ts
const series = useNgSpiceSeries(monitoredNet); // { t: number[], v: number[] }
```

And render from `series.v` against `series.t` with downsampling/decimation for performance. **Do not** post-process with random noise.

---

## Optional Dev Feature Flags

If you want to keep synthetic noise for demos, guard it **behind a flag** defaulting to **off**:

**File:** `client/src/utils/ngspice-client.ts`
```ts
const DEV_FAKE_NOISE = process.env.DEV_FAKE_NOISE === "1";

if (DEV_FAKE_NOISE && (targetNet.includes("NOISE") || targetNet.includes("SCOPE_OUT"))) {
  // synthetic noise for demos only
  ...
}
```

**Default:** `DEV_FAKE_NOISE=0` in `.env`.

---

## Validation & Tests

1. **Unit:**  
   - Parser test with a captured NGSpice transient log; assert `time.length > 2` and monotonic.  
   - No `getNgSpiceSignalAtNode` noise when `DEV_FAKE_NOISE=0`.

2. **Integration:**  
   - Change `R8` from `220k` → `22k`; expect amplitude change at `NOISE`/`SCOPE_OUT`.  
   - Remove `C1`; expect base drive to vanish and output flatten.

3. **E2E (UI):**  
   - Modify component, hit **Run**; verify waveform updates within one run and **“stale” badge** never appears.

---

## Operational Notes (Replit)

- If **Docker is blocked**, keep using the current **Node server + native ngspice** if available on the host.  
- If native ngspice isn’t available, consider **ngspice‑wasm** as a fallback (slower but works in-browser). The architecture above still applies—just swap the backend executor.

---

## Acceptance Criteria

- Oscilloscope updates **only** from **NGSpice transient** data.  
- No synthetic signals are shown unless `DEV_FAKE_NOISE=1`.  
- Changing any component **changes the waveform** in the next render.  
- Netlist `.tran`/`.control` from `simple-spice.ts` are **preserved** and executed.  
- Parser returns **full-length** time-series arrays with matching lengths.  
- Cache key changes whenever components/analysis change; stale data is never rendered.

---

### Appendix — Minimal `.control` (only if missing)
If your generated netlist lacks a control block, you may append (do **not** override existing):
```
.control
set filetype=ascii
tran 1u 5m uic
echo "Transient Analysis Complete"
.endc
```
