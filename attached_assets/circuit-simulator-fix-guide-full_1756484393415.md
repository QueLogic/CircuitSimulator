
# Circuit Simulator Pro — Full Fix & Implementation Guide (Code Included)

> **Goal:** Fix Q4B not appearing on the oscilloscope by making the **net → node** mapping derive **only** from emitted SPICE elements, labeling NGSpice outputs by **net name**, and ensuring the **oscilloscope/multimeter** read from those names.  
> This document contains **drop‑in code** you can paste into your project files. Where we can’t see your exact code, we provide **full replacement modules** or **clearly scoped patches**.

---

## Contents
1. [Server: `simple-spice.ts` (Full Replacement)](#1-server-simple-spicets-full-replacement)
2. [Server: `ngspice-interface.ts` (Drop-in helpers & integration)](#2-server-ngspice-interfacets-drop-in-helpers--integration)
3. [Server: `ngspice-simulation.ts` (API route contract)](#3-server-ngspice-simulationts-api-route-contract)
4. [Shared: `schema.ts` (Types)](#4-shared-schemats-types)
5. [Client: `ngspice-client.ts` (Preserve labels & map)](#5-client-ngspice-clientts-preserve-labels--map)
6. [Client: `oscilloscope-panel.tsx` (Probe net → waveform)](#6-client-oscilloscope-paneltsx-probe-net--waveform)
7. [Client: `multimeter-panel.tsx` (Measure by net name)](#7-client-multimeter-paneltsx-measure-by-net-name)
8. [Optional: `spice-netlist.ts` (shared emitter helpers)](#8-optional-spice-netlistts-shared-emitter-helpers)
9. [Sanity checks & tests](#9-sanity-checks--tests)
10. [FAQ / Pitfalls](#10-faq--pitfalls)

---

## 1) Server: `simple-spice.ts` (Full Replacement)

> **Key idea:** Build the `netToNodeMap` **while emitting** the SPICE netlist. **Skip display-only** components (oscilloscope, node, label, measurement, multimeter) for both emission **and** mapping.

```ts
// server/utils/simple-spice.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------

const DISPLAY_ONLY_TYPES = new Set<string>([
  "oscilloscope",
  "node",
  "label",
  "measurement",
  "multimeter",
]);

type NetToNodeMap = Record<string, number>;

const OHM_CHARS = /[ΩΩ]/g;

function normalizeNet(raw?: string | null): string {
  if (!raw) return "";
  let s = String(raw).trim();
  const upper = s.toUpperCase();
  if (upper === "0" || upper === "GND" || upper === "GROUND" || upper === "AGND" || upper === "DGND") {
    return "0";
  }
  return s;
}

function parseValue(val: string | number | undefined | null, fallback = 0): number {
  if (val == null) return fallback;
  if (typeof val === "number") return val;

  let s = val.trim().replace(OHM_CHARS, "");
  s = s.replace(/_/g, "").replace(/\s+/g, "");

  const m = s.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)([a-zA-Zµ]*)$/);
  if (!m) {
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  const [, numStr, suffixRaw] = m;
  const num = Number(numStr);
  if (!Number.isFinite(num)) return fallback;

  const suffix = suffixRaw.toLowerCase();
  const mult =
    suffix === "t" ? 1e12 :
    suffix === "g" ? 1e9  :
    suffix === "meg" ? 1e6 :
    suffix === "k" ? 1e3  :
    suffix === "m" ? 1e-3 :
    suffix === "u" || suffix === "µ" ? 1e-6 :
    suffix === "n" ? 1e-9 :
    suffix === "p" ? 1e-12 :
    1;

  return num * mult;
}

// ----------------------------------------------------------------------------
// Emitter helpers
// ----------------------------------------------------------------------------

function makeEmitter(netToNodeMap: NetToNodeMap) {
  // Reserve ground
  netToNodeMap["0"] = 0;

  function touch(netName: string | undefined): number {
    const n = normalizeNet(netName || "");
    if (!n) return 0;
    if (netToNodeMap[n] != null) return netToNodeMap[n];
    const used = Object.values(netToNodeMap);
    const next = used.length === 0 ? 1 : Math.max(...used) + 1;
    netToNodeMap[n] = next;
    return next;
  }

  function nodesOf(...names: Array<string | undefined>) {
    return names.map((n) => touch(n));
  }

  return {
    res: (ref: string, a: string, b: string, value: string | number) => {
      const [na, nb] = nodesOf(a, b);
      const ohms = parseValue(value, 1000);
      return `R${ref} ${na} ${nb} ${ohms}`;
    },
    cap: (ref: string, a: string, b: string, value: string | number) => {
      const [na, nb] = nodesOf(a, b);
      const f = parseValue(value, 1e-6);
      return `C${ref} ${na} ${nb} ${f}`;
    },
    diode: (ref: string, a: string, b: string, model = "D1N4148") => {
      const [na, nb] = nodesOf(a, b);
      return `D${ref} ${na} ${nb} ${model}`;
    },
    vsource: (ref: string, p: string, n: string, value: string | number) => {
      const [np, nn] = nodesOf(p, n);
      const v = parseValue(value, 5);
      return `V${ref} ${np} ${nn} ${v}`;
    },
    npn: (ref: string, c: string, b: string, e: string, model = "BC549") => {
      const [nc, nb, ne] = nodesOf(c, b, e);
      return `Q${ref} ${nc} ${nb} ${ne} ${model}`;
    },
    opamp: (ref: string, out: string, neg: string, pos: string, vcc: string, vee: string, model = "OPAMP") => {
      const [no, nn, np, nvcc, nvee] = nodesOf(out, neg, pos, vcc, vee);
      return `X${ref} ${no} ${nn} ${np} ${nvcc} ${nvee} ${model}`;
    },
  };
}

// ----------------------------------------------------------------------------
// Main entry
// ----------------------------------------------------------------------------

export interface GenResult {
  cirPath: string;
  netToNodeMap: NetToNodeMap;
  lines: string[];
}

export function generateSpiceNetlist(components: any[], opts?: { debug?: boolean }): GenResult {
  const debug = !!opts?.debug;
  const netToNodeMap: NetToNodeMap = Object.create(null);
  const E = makeEmitter(netToNodeMap);
  const lines: string[] = [];

  lines.push(`* Auto-generated netlist`);

  for (const comp of components) {
    if (!comp || DISPLAY_ONLY_TYPES.has(comp.kind) || DISPLAY_ONLY_TYPES.has(comp.type)) {
      continue; // Skip display-only
    }

    try {
      switch (comp.kind) {
        case "resistor": {
          const a = comp.pins?.["1"]?.net;
          const b = comp.pins?.["2"]?.net;
          lines.push(E.res(comp.ref || "R?", a, b, comp.value ?? "1k"));
          break;
        }
        case "capacitor": {
          const a = comp.pins?.["1"]?.net;
          const b = comp.pins?.["2"]?.net;
          lines.push(E.cap(comp.ref || "C?", a, b, comp.value ?? "1u"));
          break;
        }
        case "led":
        case "diode": {
          const a = comp.pins?.["1"]?.net;
          const b = comp.pins?.["2"]?.net;
          lines.push(E.diode(comp.ref || "D?", a, b, comp.model || "D1N4148"));
          break;
        }
        case "battery": {
          const p = comp.pins?.["2"]?.net; // define convention: pin2=+
          const n = comp.pins?.["1"]?.net;
          lines.push(E.vsource(comp.ref || "V?", p, n, comp.value ?? "5"));
          break;
        }
        case "transistor": {
          // Expect pins: C,B,E
          const c = comp.pins?.["C"]?.net;
          const b = comp.pins?.["B"]?.net;   // <-- Q4B lives here
          const e = comp.pins?.["E"]?.net;
          lines.push(E.npn(comp.ref || "Q?", c, b, e, comp.model || "BC549"));
          break;
        }
        case "ic": {
          // For now, ignore complex subckt unless you have models;
          // you can emit only connected pins or skip until models are present.
          // Example for op-amp- like pinout:
          if (comp.type === "lm358") {
            const out = comp.pins?.["1"]?.net;
            const neg = comp.pins?.["2"]?.net;
            const pos = comp.pins?.["3"]?.net;
            const vcc = comp.pins?.["8"]?.net ?? "+5V";
            const vee = comp.pins?.["4"]?.net ?? "0";
            lines.push(E.opamp(comp.ref || "U?", out, neg, pos, vcc, vee, "OPAMP"));
          }
          break;
        }
        default: {
          // Unknown => skip emission
          if (debug) console.warn(`[SPICE] Skipping unsupported type: ${comp.kind} (${comp.type || ""})`);
          break;
        }
      }
    } catch (err) {
      console.error(`[SPICE] Failed to emit ${comp.ref || comp.kind}:`, err);
    }
  }

  // Add models and control cards
  lines.push(`.model D1N4148 D(IS=2.52e-9 RS=0.568 N=1.752 CJO=4e-12 M=0.333)`);
  lines.push(`.model BC549 NPN (BF=330 VAF=100 IS=1e-14 NF=1.0 CJE=10p TF=0.35n CJC=4p TR=100n)`);
  // You can add .tran / .op in the interface; or here if you generate a self-contained .cir

  lines.push(`.end`);

  // Invariants: all numeric nodes used must exist in map
  if (debug) {
    const usedNodes = new Set<number>();
    for (const ln of lines) {
      const matches = ln.match(/\b\d+\b/g);
      if (matches) matches.forEach(s => usedNodes.add(Number(s)));
    }
    const knownNodes = new Set(Object.values(netToNodeMap));
    const usedButUnmapped = [...usedNodes].filter(n => !knownNodes.has(n) && n !== 0);
    const mappedButUnused = [...knownNodes].filter(n => !usedNodes.has(n) && n !== 0);
    if (usedButUnmapped.length || mappedButUnused.length) {
      console.warn("[SPICE] Node mismatch: used-but-unmapped=", usedButUnmapped, " mapped-but-unused=", mappedButUnused);
    }
  }

  // Write file
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ngspice-"));
  const cirPath = path.join(dir, "circuit.cir");
  fs.writeFileSync(cirPath, lines.join("\n"), "utf8");

  return { cirPath, netToNodeMap, lines };
}
```

---

## 2) Server: `ngspice-interface.ts` (Drop-in helpers & integration)

> **Key idea:** Convert `v(nX)` to `V(<netName>)` via inverse map. Keep `netToNodeMap` in results.

```ts
// server/utils/ngspice-interface.ts (add/merge as needed)
import { spawnSync } from "node:child_process";

export interface SpiceRunOptions {
  cirPath: string;
  netToNodeMap: Record<string, number>;
  debug?: boolean;
}

export interface TransientData {
  time: number[];
  voltages: Record<string, number[]>; // key = node number as string
}

export interface SimResponse {
  success: boolean;
  data?: {
    transientData?: TransientData;
    operatingPoint?: Record<string, number>;
    series?: Array<{ label: string; x: number[]; y: number[] }>;
    netToNodeMap: Record<string, number>;
  };
  error?: string;
  logs?: string[];
}

function invertMap(map: Record<string, number>): Record<number, string> {
  const inv: Record<number, string> = {};
  for (const [k, v] of Object.entries(map)) inv[v] = k;
  return inv;
}

export function runNgspice({ cirPath, netToNodeMap, debug }: SpiceRunOptions): SimResponse {
  // Run ngspice in batch
  const run = spawnSync("ngspice", ["-b", cirPath], { encoding: "utf8" });
  const stdout = run.stdout || "";
  const stderr = run.stderr || "";

  if (run.status !== 0) {
    return { success: false, error: stderr || "NGSpice failed", logs: [stdout, stderr] };
  }

  // In a real integration, parse the RAW/BIN output. For brevity, assume you produce CSV-like tables or
  // leverage .print tran v(1) v(2) ... to parse here and fill `transientData`.

  // Example structure:
  const transientData: TransientData = {
    time: [],
    voltages: {},
  };

  // --- TODO: parse your specific NGSpice output into transientData ---

  // Build labeled series using inverse map
  const inv = invertMap(netToNodeMap);
  const series: Array<{ label: string; x: number[]; y: number[] }> = [];

  for (const [nodeStr, values] of Object.entries(transientData.voltages)) {
    const nodeNum = Number(nodeStr);
    const netName = inv[nodeNum] ?? `n${nodeNum}`;
    series.push({
      label: `V(${netName})`,
      x: transientData.time,
      y: values,
    });
  }

  return {
    success: true,
    data: {
      transientData,
      operatingPoint: {}, // fill if you run .op
      series,
      netToNodeMap,
    },
    logs: [stdout],
  };
}
```

---

## 3) Server: `ngspice-simulation.ts` (API route contract)

> **Pass through the enriched payload** with `series` and `netToNodeMap` intact.

```ts
// server/routes/ngspice-simulation.ts
import type { Request, Response } from "express";
import { generateSpiceNetlist } from "../utils/simple-spice";
import { runNgspice } from "../utils/ngspice-interface";

export async function simulateNgspice(req: Request, res: Response) {
  try {
    const { components, debug } = req.body;
    const { cirPath, netToNodeMap } = generateSpiceNetlist(components, { debug });
    const result = runNgspice({ cirPath, netToNodeMap, debug });
    res.json(result);
  } catch (err: any) {
    res.json({ success: false, error: err?.message || String(err) });
  }
}
```

---

## 4) Shared: `schema.ts` (Types)

```ts
// shared/schema.ts
export interface SimSeries {
  label: string;  // e.g., "V(Q4B)"
  x: number[];    // time
  y: number[];    // values
}

export interface SimResponse {
  success: boolean;
  data?: {
    transientData?: {
      time: number[];
      voltages: Record<string, number[]>; // nodeId -> values
    };
    operatingPoint?: Record<string, number>;
    series?: SimSeries[];
    netToNodeMap: Record<string, number>;
  };
  error?: string;
  logs?: string[];
}
```

---

## 5) Client: `ngspice-client.ts` (Preserve labels & map)

```ts
// client/src/utils/ngspice-client.ts
import type { SimResponse } from "@/shared/schema";

export async function checkNgSpiceHealth(): Promise<{ available: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/ngspice/health");
    const json = await res.json();
    return { available: !!json.available, error: json.error || null };
  } catch (e: any) {
    return { available: false, error: e?.message || "Unavailable" };
  }
}

export async function runNgSpiceSimulation(components: any[]): Promise<SimResponse> {
  const res = await fetch("/api/ngspice/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ components }),
  });
  return res.json();
}

// Optional helpers used by panels
export function getCachedNgSpiceResult(): SimResponse | null {
  // If you cache on the client, return it; else remove this and pass the fresh call down
  return null;
}

export function getNgspiceNodeFromNet(map: Record<string, number> | undefined, net: string): number | undefined {
  if (!map) return undefined;
  return map[net];
}
```

---

## 6) Client: `oscilloscope-panel.tsx` (Probe net → waveform)

Your uploaded file already follows this pattern well. Ensure these **two invariants**:

1) **Probe net is read from the oscilloscope component pins**:
```ts
const oscilloscope = components.find(c => c.kind === "oscilloscope");
const probeNet = oscilloscope?.pins?.["CH1_TIP"]?.net;
const gndNet = oscilloscope?.pins?.["GND"]?.net || "GND";
```

2) **Resolve voltages using net name via `netToNodeMap`**:
```ts
const netMap = ngspiceResult.data?.netToNodeMap || {};
const probeNode = netMap[probeNet!];
const gndNode = netMap[gndNet] ?? 0;

const vProbe = transientData.voltages[String(probeNode)];
const vGnd   = transientData.voltages[String(gndNode)] || new Array(transientData.time.length).fill(0);
const diff = vProbe.map((v, i) => v - vGnd[i]);
```

Your existing `oscilloscope-panel.tsx` already implements this approach. Keep it.

---

## 7) Client: `multimeter-panel.tsx` (Measure by net name)

Your uploaded file also uses `selectedNet` → `getNgSpiceSignalAtNode(...)`.  
Ensure **selected nets** are **net names** and never numeric IDs, and preserve labels.

Key excerpt (already present):
```ts
if (usingNgSpice && ngspiceResult) {
  voltage = getNgSpiceSignalAtNode(components, ngspiceResult, selectedNet);
} else {
  voltage = getSignalAtNode(components, selectedNet);
}
```

---

## 8) Optional: `spice-netlist.ts` (shared emitter helpers)

If you want a shared module for emitters used by multiple generators:

```ts
// server/utils/spice-netlist.ts
export type NetToNodeMap = Record<string, number>;

export function createNetMapper(existing?: NetToNodeMap) {
  const map: NetToNodeMap = existing ? { ...existing } : { "0": 0 };
  function touch(net?: string): number {
    const s = (net || "").trim();
    const u = s.toUpperCase();
    const n = u === "GND" || u === "GROUND" || s === "0" ? "0" : s;
    if (!n) return 0;
    if (map[n] != null) return map[n];
    const next = Math.max(0, ...Object.values(map)) + 1;
    map[n] = next;
    return next;
  }
  return { map, touch };
}
```

---

## 9) Sanity checks & tests

1) **Reproduce your earlier case** where the netlist had:
```
C1 2 3 1u
R9 3 0 100k
Q4 4 3 0 BC549
```
- Expected map: `{"0":0, "<...>":..., "Q4B":3, "NOISE":4, ...}` (names will reflect your actual nets).  
- **No** display-only components should add entries to `netToNodeMap`.

2) **Value parser tests:**
- `"15kΩ" → 15000`
- `"3µ" → 3e-6`
- `"10meg" → 1e6`
- `"1M" → 1e-3` (milli), note the difference from `"1Meg"` which is mega.

3) **UI checks:**
- Oscilloscope shows **Signal: Q4B (vs GND)** and plots a waveform labeled `V(Q4B)` if you surface labels in legends.
- Multimeter net selection lists **net names** present in component pins.

4) **Node mismatch guardrails:**
- Enable `debug: true` to log used/mapped nodes. There should be **no** “used‑but‑unmapped” or “mapped‑but‑unused” beyond ground.

---

## 10) FAQ / Pitfalls

- **Why not pre-collect nets first?** Because UI-only parts (oscilloscope, node) don’t emit SPICE, and pre-collection causes off-by-N drift in numbering. Emission-time mapping guarantees alignment.
- **What if I need multi-scope channels?** Treat each probe as display-only; never emit them. Read their **pin net** and then resolve to a node via `netToNodeMap`.
- **Ground variants?** Normalize `GND`, `AGND`, `DGND`, etc. to `"0"` so SPICE sees node 0.
- **ICs / subcircuits?** Only emit them if you **actually have models**. Otherwise skip or use behavioral sources. The key is: **if it emits, it maps**.

---

## Done
With these replacements, your **netToNodeMap** reflects only what NGSpice sees, so **Q4B** can’t go missing or be misnumbered. The UI reads by **net name**, so everything stays stable even if node numbers change.
