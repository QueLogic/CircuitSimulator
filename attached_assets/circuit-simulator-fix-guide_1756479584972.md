# Circuit Simulator Pro – Debugging & Fix Guide

## Overview
This document explains how to fix the critical **Q4B node mapping issue** and align the oscilloscope, multimeter, and NGSpice integration in your Circuit Simulator Pro app. The fixes ensure that:
- Node mapping only uses **real SPICE components** (not UI-only nodes like oscilloscope probes).
- The oscilloscope correctly tracks the **actual connected net**.
- The multimeter and NGSpice status panels report consistent results.

---

## Root Cause
- **Oscilloscope/Node components** were consuming node IDs in the net-to-node map, but they **weren’t included** in the SPICE netlist.
- This caused **off-by-one mapping errors** (e.g., NOISE being assigned to Q4B’s node).

---

## Fix Summary by File

### 1. `server/utils/simple-spice.ts`
- Switch to **emit-and-collect** mapping:
  - Only allocate node IDs for components actually emitted into the SPICE netlist.
  - Skip UI-only components (`oscilloscope`, `node`).
- Add **unit parsing** (`15kΩ → 15000`, `10uF → 1e-5`) and **GND normalization** (`GND`/`AGND` → `0`).
- Add invariant check: after netlist generation, validate that all nets in `netToNodeMap` appear in `.cir` file.

### 2. `server/utils/ngspice-interface.ts`
- Use **inverse mapping**: return simulation results as `V(<netName>)` instead of `V(n3)`.
- Example:
  ```ts
  const inverseMap = Object.fromEntries(
    Object.entries(netToNodeMap).map(([k, v]) => [v, k])
  );
  result.series = Object.keys(transient.voltages).map(nodeId => ({
    label: `V(${inverseMap[nodeId] || nodeId})`,
    values: transient.voltages[nodeId]
  }));
  ```

### 3. `server/routes/ngspice-simulation.ts`
- Pass through enriched payload with `series`, `operatingPoint`, `netToNodeMap`.
- No additional logic change needed.

### 4. `client/src/components/circuit/oscilloscope-panel.tsx`
- Select net dynamically from oscilloscope probe pins:
  - Detect `oscilloscope.pins["CH1_TIP"]?.net`.
  - Cross-check with `netToNodeMap`.
- Show `V(Q4B)` waveform instead of `V(3)`.

### 5. `client/src/components/circuit/multimeter-panel.tsx`
- Use **net names** instead of numeric IDs.
- Example when measuring:
  ```ts
  voltage = getNgSpiceSignalAtNode(components, ngspiceResult, selectedNet);
  ```

### 6. `client/src/utils/ngspice-client.ts`
- Ensure returned payload preserves `netToNodeMap` and `series` with labels.

### 7. `shared/schema.ts`
- Update type definitions:
  ```ts
  export interface Series {
    label: string;
    values: number[];
  }
  export interface SimResponse {
    success: boolean;
    data?: {
      series: Series[];
      operatingPoint: Record<string, number>;
      netToNodeMap: Record<string, number>;
    };
    error?: string;
  }
  ```

---

## Testing Steps
1. Create a simple circuit with **Q4 transistor**, resistor divider, and oscilloscope probe on Q4B.
2. Run simulation:
   - Expected: Oscilloscope displays **V(Q4B)** correctly.
   - No mismatch between node index and label.
3. Verify:
   - `multimeter-panel.tsx` shows correct voltages at Q4B net.
   - `ngspice-status.tsx` reports success and consistent node count.
4. Check invariants in logs:
   - All nets in `netToNodeMap` should exist in the generated `.cir` file.

---

## Additional Enhancements
- Add **debug logging** to `simple-spice.ts`:
  ```ts
  console.log("Generated netToNodeMap:", netToNodeMap);
  console.log("Emitted SPICE lines:", spiceLines);
  ```
- Add **unit tests** for `parseValue("15kΩ")` and `mapTransistorPins(Q4)`.

---

## Conclusion
By restricting node allocation to **real SPICE components only** and labeling results by **net name**, the oscilloscope, multimeter, and NGSpice outputs will align correctly. This guarantees that Q4B (and similar nets) are accurately tracked and displayed.
