// server/utils/simple-spice.ts
import { Component } from '@shared/schema';

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

const OHM_CHARS = /[ΩΩ]/g;

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

  let s = String(val).trim().replace(OHM_CHARS, "");
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
    suffix === "f" ? 1e-15 :
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
    if (!n || n === "0") return 0;
    
    if (netToNodeMap[n] == null) {
      const used = Object.values(netToNodeMap);
      const next = used.length === 0 ? 1 : Math.max(...used) + 1;
      netToNodeMap[n] = next;
      console.log(`📍 Registering net "${n}" as node ${next}`);
    }
    return netToNodeMap[n];
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
      return `V${ref} ${np} ${nn} DC ${v}`;
    },
    npn: (ref: string, c: string, b: string, e: string, model = "BC549") => {
      const [nc, nb, ne] = nodesOf(c, b, e);
      console.log(`✅ Transistor Q${ref}: C=node${nc}(${c}), B=node${nb}(${b}), E=node${ne}(${e})`);
      return `Q${ref} ${nc} ${nb} ${ne} ${model}`;
    },
    opamp: (ref: string, out: string, neg: string, pos: string, vcc: string, vee: string, model = "OPAMP") => {
      const [no, nn, np, nvcc, nvee] = nodesOf(out, neg, pos, vcc, vee);
      return `X${ref} ${no} ${nn} ${np} ${nvcc} ${nvee} ${model}`;
    },
    touch,
  };
}

// ----------------------------------------------------------------------------
// Main entry
// ----------------------------------------------------------------------------

export interface SimpleCircuitComponent {
  id: string;
  ref: string;
  kind: string;
  model?: string;
  type?: string;
  value?: string;
  pins?: Record<string, { net: string; polarity?: "+" | "-"; comment?: string; }>;
  comment?: string;
}

export function generateSimpleSpiceNetlist(components: SimpleCircuitComponent[]): { 
  netlist: string; 
  netToNodeMap: NetToNodeMap;
} {
  console.log(`🚀 generateSimpleSpiceNetlist called with ${components.length} components`);
  
  const netToNodeMap: NetToNodeMap = Object.create(null);
  const E = makeEmitter(netToNodeMap);
  const lines: string[] = [];

  lines.push("Simple Circuit");
  lines.push("");

  for (const comp of components) {
    if (!comp || DISPLAY_ONLY_TYPES.has(comp.kind) || DISPLAY_ONLY_TYPES.has(comp.type || "")) {
      console.log(`⏭️ Skipping display-only: ${comp.ref} (${comp.kind})`);
      continue;
    }

    try {
      switch (comp.kind) {
        case "resistor": {
          const a = comp.pins?.["1"]?.net;
          const b = comp.pins?.["2"]?.net;
          if (a && b) {
            lines.push(E.res(comp.ref || "R?", a, b, comp.value ?? "1k"));
          }
          break;
        }
        case "capacitor": {
          const a = comp.pins?.["1"]?.net;
          const b = comp.pins?.["2"]?.net;
          if (a && b) {
            lines.push(E.cap(comp.ref || "C?", a, b, comp.value ?? "1u"));
          }
          break;
        }
        case "led":
        case "diode": {
          const a = comp.pins?.["1"]?.net;
          const b = comp.pins?.["2"]?.net;
          if (a && b) {
            lines.push(E.diode(comp.ref || "D?", a, b, comp.model || "D1N4148"));
          }
          break;
        }
        case "battery": {
          // Pin 2 is positive, Pin 1 is negative (as per guide)
          const p = comp.pins?.["2"]?.net;
          const n = comp.pins?.["1"]?.net;
          if (p && n) {
            lines.push(E.vsource(comp.ref || "V?", p, n, comp.value ?? "5"));
          }
          break;
        }
        case "transistor": {
          // Expect pins: C,B,E
          const c = comp.pins?.["C"]?.net;
          const b = comp.pins?.["B"]?.net;
          const e = comp.pins?.["E"]?.net;
          if (c && b && e) {
            const model = pickBjtModel(comp);
            lines.push(E.npn(comp.ref || "Q?", c, b, e, model));
          }
          break;
        }
        case "node": {
          // N-nodes are breadboard-style connection points that merge all connected nets
          // They don't emit SPICE elements but ensure nets are properly connected
          if (comp.pins) {
            const connectedNets = Object.values(comp.pins).map(p => p.net).filter(Boolean);
            if (connectedNets.length > 1) {
              // All nets connected to this node should have the same node number
              const primaryNet = connectedNets[0];
              const primaryNode = E.touch(primaryNet);
              
              // Map all other nets to the same node number (breadboard junction behavior)
              for (let i = 1; i < connectedNets.length; i++) {
                const secondaryNet = normalizeNet(connectedNets[i]);
                if (secondaryNet && secondaryNet !== "0") {
                  netToNodeMap[secondaryNet] = primaryNode;
                  console.log(`🔌 N-node ${comp.ref}: Connecting ${secondaryNet} to ${primaryNet} (node ${primaryNode})`);
                }
              }
            }
          }
          break;
        }
        case "ic": {
          // Skip ICs unless we have proper models
          console.log(`⏭️ Skipping IC: ${comp.ref} (would need subcircuit model)`);
          break;
        }
        default: {
          console.log(`⏭️ Skipping unsupported: ${comp.kind} (${comp.ref})`);
          break;
        }
      }
    } catch (err) {
      console.error(`[SPICE] Failed to emit ${comp.ref || comp.kind}:`, err);
    }
  }

  // Add special noise sources for avalanche circuit
  lines.push("");
  lines.push("* Zener-assisted avalanche breakdown at emitter node");
  lines.push("* Q1 creates BE breakdown ~6-8V, zener provides realistic breakdown for noise");
  
  if ("Q1E" in netToNodeMap) {
    const q1eNode = netToNodeMap["Q1E"];
    lines.push(`DNOISE 0 ${q1eNode} DZ6V8    ; Zener emulates avalanche breakdown`);
    lines.push("");
    lines.push("* Transient noise at Q1E node (deterministic sine for NGSpice compatibility)");
    lines.push(`VNOISE ${q1eNode} 0 SIN(0 0.001 1000)`);
  }

  // Add models and control cards
  lines.push("");
  lines.push("* --- BJT models ---");
  lines.push(".model BC337 NPN (IS=1e-14 BF=200 VAF=100 NF=1 RB=100 RE=1 RC=1 CJE=5p VJE=0.7 CJC=3p VJC=0.3 TF=0.3n TR=10n KF=2e-14 AF=1)");
  lines.push(".model BC549 NPN (IS=1e-14 BF=300 VAF=150 NF=1 RB=150 RE=1 RC=1 CJE=6p VJE=0.7 CJC=3p VJC=0.3 TF=0.25n TR=8n KF=5e-15 AF=1)");
  lines.push("");
  lines.push("* --- Zener models ---");
  lines.push(".model DZ6V8 D (IS=1e-14 N=1 BV=6.8 IBV=10u RS=10 KF=0 AF=1)");
  lines.push(".model DZ4V7 D (IS=1e-14 N=1 BV=4.7 IBV=10u RS=10 KF=0 AF=1)");
  lines.push("");
  lines.push("* Solver options for convergence stability");
  lines.push(".options reltol=1e-3 abstol=1e-12 vntol=1e-6");
  lines.push(".options gmin=1e-12 itl1=100 itl2=50");
  lines.push(".options temp=27 tnom=27");
  lines.push("");
  lines.push("* Analysis");
  lines.push(".control");
  lines.push("set filetype=ascii");
  lines.push("op");
  lines.push("print all");
  lines.push("");
  lines.push("* Transient analysis with proper timestep for noise");
  lines.push("tran 0.1us 5ms uic");
  
  // Build node list for data extraction from the actual netToNodeMap
  const nodeList: string[] = [];
  for (const [netName, nodeNum] of Object.entries(netToNodeMap)) {
    if (nodeNum > 0) {  // Skip ground
      nodeList.push(`v(${nodeNum})`);
    }
  }
  
  lines.push(`wrdata tran.csv time ${nodeList.join(" ")}`);
  lines.push(`print time ${nodeList.join(" ")}`);
  lines.push(".endc");
  lines.push(".end");

  // Log final mapping
  console.log(`📊 Final netToNodeMap (${Object.keys(netToNodeMap).length} nets):`, netToNodeMap);
  
  // Verify Q4B is in the map
  if ("Q4B" in netToNodeMap) {
    console.log(`✅ SUCCESS: Q4B is mapped to node ${netToNodeMap["Q4B"]}`);
  } else {
    console.log(`❌ WARNING: Q4B is not in the netToNodeMap!`);
    console.log(`Available nets: ${Object.keys(netToNodeMap).join(", ")}`);
  }

  return {
    netlist: lines.join("\n"),
    netToNodeMap
  };
}

// Transistor model selection function
function pickBjtModel(component: { model?: string, ref?: string }) {
  const m = (component.model || "").toUpperCase();
  if (m.includes("BC549")) return "BC549";
  if (m.includes("BC337")) return "BC337";
  if ((component.ref || "").toUpperCase() === "Q4") return "BC549";
  return "BC337";
}