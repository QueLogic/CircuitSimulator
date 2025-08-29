// Circuit component types for NGSpice
export interface CircuitComponent {
  id: string;
  ref: string;
  kind: string;
  type?: string;
  model?: string;
  value?: string;
  position: {
    x: number;
    y: number;
  };
  pins?: Record<string, {
    net: string;
    polarity?: "+" | "-";
    comment?: string;
  }>;
  comment?: string;
  initialCondition?: string;
  amplitude?: string;
  frequency?: string;
}

export interface SpiceNetlist {
  netlist: string;
  controlCommands: string[];
  netToNodeMap: Map<string, number>;
}

export function generateSpiceNetlist(components: CircuitComponent[]): SpiceNetlist {
  const lines: string[] = [];
  const controlCommands: string[] = [];
  
  // SPICE netlist header (first line must be title)
  lines.push("Circuit Simulator Pro - Generated SPICE Netlist");
  lines.push("* Generated at: " + new Date().toISOString());
  lines.push("");
  
  // Log component count and types for debugging
  console.log(`Generating netlist for ${components.length} components`);
  const componentTypes = components.map(c => `${c.ref}(${c.kind})`).join(", ");
  console.log(`Components: ${componentTypes}`);
  
  // Build node mapping - convert string nets to numbered nodes
  const netToNode = new Map<string, number>();
  let nodeCounter = 1;
  
  // Reserve node 0 for ground
  netToNode.set("GND", 0);
  
  // Collect all nets from components
  components.forEach(component => {
    if (component.pins) {
      Object.values(component.pins).forEach(pin => {
        if (pin.net && !netToNode.has(pin.net)) {
          netToNode.set(pin.net, nodeCounter++);
        }
      });
    }
  });
  
  // Log only the final net map for debugging Q4B issue
  console.log("NetToNodeMap nets:", Array.from(netToNode.keys()));
  
  // Generate SPICE components
  components.forEach(component => {
    const spiceLine = generateSpiceComponent(component, netToNode);
    if (spiceLine) {
      lines.push(spiceLine);
    }
  });
  
  // Add simulation commands
  lines.push("");
  lines.push("* Analysis commands");
  
  // DC operating point analysis
  controlCommands.push("op");
  
  // Transient analysis for time-domain simulation
  controlCommands.push("tran 0.1ms 10ms");
  
  // AC analysis for frequency response
  controlCommands.push("ac dec 100 1 1meg");
  
  // Noise analysis if we have noise sources
  const hasNoiseSource = components.some(c => 
    c.kind === "transistor" && c.model?.includes("BC337")
  );
  if (hasNoiseSource) {
    controlCommands.push("noise v(noise) v1 dec 100 1 1meg");
  }
  
  lines.push("");
  lines.push("* Analysis commands");  
  lines.push(".op");
  lines.push(".end");
  
  return {
    netlist: lines.join("\n"),
    controlCommands,
    netToNodeMap: netToNode
  };
}

function generateSpiceComponent(component: CircuitComponent, netToNode: Map<string, number>): string | null {
  if (!component.pins) {
    return null;
  }
  
  const pins = Object.entries(component.pins);
  const ref = component.ref || `${component.kind}${component.id.slice(0, 8)}`;
  
  switch (component.kind) {
    case "resistor":
      if (pins.length >= 2) {
        const node1 = netToNode.get(pins[0][1].net) ?? 0;
        const node2 = netToNode.get(pins[1][1].net) ?? 0;
        const value = parseResistanceValue(component.value || "1k");
        return `R${ref} ${node1} ${node2} ${value}`;
      }
      break;
      
    case "capacitor":
      if (pins.length >= 2) {
        const pin1 = pins[0][1];
        const pin2 = pins[1][1];
        const node1 = netToNode.get(pin1.net) ?? 0;
        const node2 = netToNode.get(pin2.net) ?? 0;
        const value = parseCapacitanceValue(component.value || "1u");
        const ic = component.initialCondition || "0V";
        return `C${ref} ${node1} ${node2} ${value} IC=${ic}`;
      }
      break;
      
    case "inductor":
      if (pins.length >= 2) {
        const pin1 = pins[0][1];
        const pin2 = pins[1][1];
        const node1 = netToNode.get(pin1.net) ?? 0;
        const node2 = netToNode.get(pin2.net) ?? 0;
        const value = parseInductanceValue(component.value || "1m");
        return `L${ref} ${node1} ${node2} ${value}`;
      }
      break;
      
    case "battery":
    case "voltage_source":
      if (pins.length >= 2) {
        const pin1 = pins[0][1];
        const pin2 = pins[1][1];
        const nodePos = netToNode.get(pin1.net) ?? 0;
        const nodeNeg = netToNode.get(pin2.net) ?? 0;
        const voltage = parseVoltageValue(component.value || "9V");
        return `V${ref} ${nodePos} ${nodeNeg} DC ${voltage}`;
      }
      break;
      
    case "current_source":
      if (pins.length >= 2) {
        const pin1 = pins[0][1];
        const pin2 = pins[1][1];
        const nodePos = netToNode.get(pin1.net) ?? 0;
        const nodeNeg = netToNode.get(pin2.net) ?? 0;
        const current = parseCurrentValue(component.value || "1m");
        return `I${ref} ${nodePos} ${nodeNeg} DC ${current}`;
      }
      break;
      
    case "diode":
    case "led":
      if (pins.length >= 2) {
        const pin1 = pins[0][1];
        const pin2 = pins[1][1];
        const anode = netToNode.get(pin1.net) ?? 0;
        const cathode = netToNode.get(pin2.net) ?? 0;
        const model = component.kind === "led" ? "LED_MODEL" : "DIODE_MODEL";
        return `D${ref} ${anode} ${cathode} ${model}`;
      }
      break;
      
    case "transistor":
      if (pins.length >= 3) {
        const collectorPin = pins.find(([pin]) => pin === "C");
        const basePin = pins.find(([pin]) => pin === "B");
        const emitterPin = pins.find(([pin]) => pin === "E");
        
        if (collectorPin && basePin && emitterPin) {
          const collector = netToNode.get(collectorPin[1].net) ?? 0;
          const base = netToNode.get(basePin[1].net) ?? 0;
          const emitter = netToNode.get(emitterPin[1].net) ?? 0;
          
          // Determine transistor type and model
          let model = "NPN_GENERIC";
          if (component.model?.includes("BC337")) {
            model = "BC337";
          } else if (component.model?.includes("BC549")) {
            model = "BC549";
          } else if (component.model?.includes("BC327")) {
            model = "BC327";
          }
          
          return `Q${ref} ${collector} ${base} ${emitter} ${model}`;
        }
      }
      break;
      
    case "opamp":
      if (pins.length >= 3) {
        const vinPosPin = pins.find(([p]) => p === "V+");
        const vinNegPin = pins.find(([p]) => p === "V-");
        const voutPin = pins.find(([p]) => p === "Vout");
        
        if (vinPosPin && vinNegPin && voutPin) {
          const vinPos = netToNode.get(vinPosPin[1].net) ?? 0;
          const vinNeg = netToNode.get(vinNegPin[1].net) ?? 0;
          const vout = netToNode.get(voutPin[1].net) ?? 0;
          return `X${ref} ${vinNeg} ${vinPos} ${vout} OPAMP_IDEAL`;
        }
      }
      break;
      
    // IC Chips
    case "ne555":
      if (pins.length >= 8) {
        // NE555: Pin 1=GND, 2=TRIG, 3=OUT, 4=RESET, 5=CTRL, 6=THRESH, 7=DISCH, 8=VCC
        const nodes = [];
        for (let i = 1; i <= 8; i++) {
          const pin = pins.find(([p]) => p === `${i}`);
          nodes.push(pin ? netToNode.get(pin[1].net) ?? 0 : 0);
        }
        return `X${ref} ${nodes.join(' ')} NE555`;
      }
      break;
      
    case "lm358":
      if (pins.length >= 8) {
        // LM358: Pin 1=OUT1, 2=IN1-, 3=IN1+, 4=VCC, 5=IN2+, 6=IN2-, 7=OUT2, 8=VEE
        const nodes = [];
        for (let i = 1; i <= 8; i++) {
          const pin = pins.find(([p]) => p === `${i}`);
          nodes.push(pin ? netToNode.get(pin[1].net) ?? 0 : 0);
        }
        return `X${ref} ${nodes.join(' ')} LM358`;
      }
      break;
      
    case "lm324":
      if (pins.length >= 14) {
        // LM324: 14-pin Quad Op-Amp
        const nodes = [];
        for (let i = 1; i <= 14; i++) {
          const pin = pins.find(([p]) => p === `${i}`);
          nodes.push(pin ? netToNode.get(pin[1].net) ?? 0 : 0);
        }
        return `X${ref} ${nodes.join(' ')} LM324`;
      }
      break;
      
    case "cd4001":
      if (pins.length >= 14) {
        // CD4001: 14-pin Quad NOR Gate
        const nodes = [];
        for (let i = 1; i <= 14; i++) {
          const pin = pins.find(([p]) => p === `${i}`);
          nodes.push(pin ? netToNode.get(pin[1].net) ?? 0 : 0);
        }
        return `X${ref} ${nodes.join(' ')} CD4001`;
      }
      break;
      
    case "cd4011":
      if (pins.length >= 14) {
        // CD4011: 14-pin Quad NAND Gate
        const nodes = [];
        for (let i = 1; i <= 14; i++) {
          const pin = pins.find(([p]) => p === `${i}`);
          nodes.push(pin ? netToNode.get(pin[1].net) ?? 0 : 0);
        }
        return `X${ref} ${nodes.join(' ')} CD4011`;
      }
      break;
      
    case "cd4017":
      if (pins.length >= 16) {
        // CD4017: 16-pin Decade Counter
        const nodes = [];
        for (let i = 1; i <= 16; i++) {
          const pin = pins.find(([p]) => p === `${i}`);
          nodes.push(pin ? netToNode.get(pin[1].net) ?? 0 : 0);
        }
        return `X${ref} ${nodes.join(' ')} CD4017`;
      }
      break;
      
    case "cd4069":
      if (pins.length >= 14) {
        // CD4069: 14-pin Hex Inverter
        const nodes = [];
        for (let i = 1; i <= 14; i++) {
          const pin = pins.find(([p]) => p === `${i}`);
          nodes.push(pin ? netToNode.get(pin[1].net) ?? 0 : 0);
        }
        return `X${ref} ${nodes.join(' ')} CD4069`;
      }
      break;
      
    // Generic IC handling for remaining types
    case "lm393":
    case "lm339":
    case "cd4007":
    case "cd4013":
    case "cd4052":
    case "cd4053":
    case "cd4060":
    case "cd4093":
    case "cd3066":
      // Use OPAMP_IDEAL as fallback for unsupported ICs
      if (pins.length >= 3) {
        const pin1 = pins[0];
        const pin2 = pins[1];
        const pin3 = pins[2];
        if (pin1 && pin2 && pin3) {
          const node1 = netToNode.get(pin1[1].net) ?? 0;
          const node2 = netToNode.get(pin2[1].net) ?? 0;
          const node3 = netToNode.get(pin3[1].net) ?? 0;
          return `X${ref} ${node2} ${node1} ${node3} OPAMP_IDEAL`;
        }
      }
      break;
      
    case "ac_source":
      if (pins.length >= 2) {
        const pin1 = pins[0][1];
        const pin2 = pins[1][1];
        const nodePos = netToNode.get(pin1.net) ?? 0;
        const nodeNeg = netToNode.get(pin2.net) ?? 0;
        const amplitude = component.amplitude || "1V";
        const frequency = component.frequency || "1k";
        return `V${ref} ${nodePos} ${nodeNeg} SIN(0 ${amplitude} ${frequency})`;
      }
      break;
  }
  
  return null;
}

// Model definitions for common components
export function getSpiceModels(): string {
  return `
* Component Models
.model DIODE_MODEL D(Is=1e-14 Rs=1)
.model LED_MODEL D(Is=1e-14 Rs=1 Vj=2.1)

* BC337 NPN Transistor Model
.model BC337 NPN(
+ Is=1.8e-14 Xti=3 Eg=1.11 Vaf=74.03 Bf=200
+ Ne=1.5 Ise=1.8e-14 Ikf=0.15 Xtb=1.5 Br=6
+ Nc=2 Isc=0 Ikr=0 Rc=1 Cjc=7.306e-12 Mjc=0.3416
+ Vjc=0.75 Fc=0.5 Cje=2.441e-11 Mje=0.377 Vje=0.75
+ Tr=2.39e-8 Tf=4.31e-10 Itf=0.6 Vtf=1.7 Xtf=3
+ Rb=10)

* BC549 NPN Transistor Model  
.model BC549 NPN(
+ Is=7.049e-15 Xti=3 Eg=1.11 Vaf=62.79 Bf=300
+ Ne=1.5 Ise=7.049e-15 Ikf=0.08 Xtb=1.5 Br=7.5
+ Nc=2 Isc=0 Ikr=0 Rc=1 Cjc=5.57e-12 Mjc=0.3414
+ Vjc=0.75 Fc=0.5 Cje=1.23e-11 Mje=0.377 Vje=0.75
+ Tr=1.6e-8 Tf=6.4e-10 Itf=0.7 Vtf=1.2 Xtf=2
+ Rb=100)

* BC327 PNP Transistor Model
.model BC327 PNP(
+ Is=2.294e-14 Xti=3 Eg=1.11 Vaf=115.7 Bf=200
+ Ne=1.5 Ise=2.294e-14 Ikf=0.15 Xtb=1.5 Br=5
+ Nc=2 Isc=0 Ikr=0 Rc=1 Cjc=9.81e-12 Mjc=0.3416
+ Vjc=0.75 Fc=0.5 Cje=3.43e-11 Mje=0.377 Vje=0.75
+ Tr=2.39e-8 Tf=4.31e-10 Itf=0.6 Vtf=1.7 Xtf=3
+ Rb=10)

* Ideal OpAmp Model
.subckt OPAMP_IDEAL 1 2 3
E1 3 0 1 2 1e6
.ends

* NE555 Timer IC Model
.subckt NE555 1 2 3 4 5 6 7 8
* Pin 1=GND, 2=TRIG, 3=OUT, 4=RESET, 5=CTRL, 6=THRESH, 7=DISCH, 8=VCC
* Simplified behavioral model
V_THRESH 6 1 {2*V(8,1)/3}
V_TRIG 2 1 {V(8,1)/3}
E_OUT 3 1 VALUE={IF(V(2,1) < V(8,1)/3, V(8,1), IF(V(6,1) > 2*V(8,1)/3, 0, V(3,1)))}
.ends

* LM358 Dual Op-Amp Model
.subckt LM358 1 2 3 4 5 6 7 8
* Pin 1=OUT1, 2=IN1-, 3=IN1+, 4=VCC, 5=IN2+, 6=IN2-, 7=OUT2, 8=VEE
X1 3 2 1 OPAMP_IDEAL
X2 5 6 7 OPAMP_IDEAL
.ends

* LM324 Quad Op-Amp Model  
.subckt LM324 1 2 3 4 5 6 7 8 9 10 11 12 13 14
* 4 op-amps in one package
X1 3 2 1 OPAMP_IDEAL
X2 5 6 7 OPAMP_IDEAL  
X3 10 9 8 OPAMP_IDEAL
X4 12 13 14 OPAMP_IDEAL
.ends

* CD4001 Quad NOR Gate Model
.subckt CD4001 1 2 3 4 5 6 7 8 9 10 11 12 13 14
* Simplified digital logic model
E1 3 7 VALUE={IF((V(1,7) < V(14,7)/2) | (V(2,7) < V(14,7)/2), V(14,7), 0)}
E2 4 7 VALUE={IF((V(5,7) < V(14,7)/2) | (V(6,7) < V(14,7)/2), V(14,7), 0)}
E3 10 7 VALUE={IF((V(8,7) < V(14,7)/2) | (V(9,7) < V(14,7)/2), V(14,7), 0)}
E4 11 7 VALUE={IF((V(12,7) < V(14,7)/2) | (V(13,7) < V(14,7)/2), V(14,7), 0)}
.ends

* CD4011 Quad NAND Gate Model
.subckt CD4011 1 2 3 4 5 6 7 8 9 10 11 12 13 14
* Simplified digital logic model
E1 3 7 VALUE={IF((V(1,7) > V(14,7)/2) & (V(2,7) > V(14,7)/2), 0, V(14,7))}
E2 4 7 VALUE={IF((V(5,7) > V(14,7)/2) & (V(6,7) > V(14,7)/2), 0, V(14,7))}
E3 10 7 VALUE={IF((V(8,7) > V(14,7)/2) & (V(9,7) > V(14,7)/2), 0, V(14,7))}
E4 11 7 VALUE={IF((V(12,7) > V(14,7)/2) & (V(13,7) > V(14,7)/2), 0, V(14,7))}
.ends

* CD4017 Decade Counter Model
.subckt CD4017 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16
* Simplified counter behavior - outputs cycle 0-9
* Pin 14=CLK, 13=ENABLE, 15=RESET, 16=VDD, 8=VSS
V_COUNT 100 0 0
E_Q0 3 8 VALUE={IF(V(100) == 0, V(16,8), 0)}
E_Q1 2 8 VALUE={IF(V(100) == 1, V(16,8), 0)}
E_Q2 4 8 VALUE={IF(V(100) == 2, V(16,8), 0)}
E_Q3 7 8 VALUE={IF(V(100) == 3, V(16,8), 0)}
E_Q4 10 8 VALUE={IF(V(100) == 4, V(16,8), 0)}
E_Q5 1 8 VALUE={IF(V(100) == 5, V(16,8), 0)}
E_Q6 5 8 VALUE={IF(V(100) == 6, V(16,8), 0)}
E_Q7 6 8 VALUE={IF(V(100) == 7, V(16,8), 0)}
E_Q8 9 8 VALUE={IF(V(100) == 8, V(16,8), 0)}
E_Q9 11 8 VALUE={IF(V(100) == 9, V(16,8), 0)}
.ends

* CD4069 Hex Inverter Model
.subckt CD4069 1 2 3 4 5 6 7 8 9 10 11 12 13 14
* Pin 14=VDD, 7=VSS
E1 2 7 VALUE={IF(V(1,7) > V(14,7)/2, 0, V(14,7))}
E2 4 7 VALUE={IF(V(3,7) > V(14,7)/2, 0, V(14,7))}
E3 6 7 VALUE={IF(V(5,7) > V(14,7)/2, 0, V(14,7))}
E4 8 7 VALUE={IF(V(9,7) > V(14,7)/2, 0, V(14,7))}
E5 10 7 VALUE={IF(V(11,7) > V(14,7)/2, 0, V(14,7))}
E6 12 7 VALUE={IF(V(13,7) > V(14,7)/2, 0, V(14,7))}
.ends

* NPN Generic Model
.model NPN_GENERIC NPN(Bf=100)
`;
}

// Value parsing functions
function parseResistanceValue(value: string): string {
  const numericValue = parseFloat(value);
  if (value.includes("M") || value.includes("meg")) {
    return `${numericValue}meg`;
  } else if (value.includes("k")) {
    return `${numericValue}k`;
  } else if (value.includes("m") && !value.includes("meg")) {
    return `${numericValue}m`;
  } else {
    return `${numericValue}`;
  }
}

function parseCapacitanceValue(value: string): string {
  const numericValue = parseFloat(value);
  if (value.includes("F") && !value.includes("m") && !value.includes("u") && !value.includes("n") && !value.includes("p")) {
    return `${numericValue}F`;
  } else if (value.includes("mF") || value.includes("m")) {
    return `${numericValue}mF`;
  } else if (value.includes("uF") || value.includes("µF") || value.includes("u")) {
    return `${numericValue}uF`;
  } else if (value.includes("nF") || value.includes("n")) {
    return `${numericValue}nF`;
  } else if (value.includes("pF") || value.includes("p")) {
    return `${numericValue}pF`;
  } else {
    return `${numericValue}uF`; // Default to microfarads
  }
}

function parseInductanceValue(value: string): string {
  const numericValue = parseFloat(value);
  if (value.includes("H") && !value.includes("m") && !value.includes("u") && !value.includes("n")) {
    return `${numericValue}H`;
  } else if (value.includes("mH") || value.includes("m")) {
    return `${numericValue}mH`;
  } else if (value.includes("uH") || value.includes("µH") || value.includes("u")) {
    return `${numericValue}uH`;
  } else if (value.includes("nH") || value.includes("n")) {
    return `${numericValue}nH`;
  } else {
    return `${numericValue}mH`; // Default to millihenries
  }
}

function parseVoltageValue(value: string): string {
  const numericValue = parseFloat(value);
  if (value.includes("V")) {
    return `${numericValue}`;
  } else {
    return `${numericValue}`;
  }
}

function parseCurrentValue(value: string): string {
  const numericValue = parseFloat(value);
  if (value.includes("A") && !value.includes("m") && !value.includes("u") && !value.includes("n")) {
    return `${numericValue}`;
  } else if (value.includes("mA") || value.includes("m")) {
    return `${numericValue}m`;
  } else if (value.includes("uA") || value.includes("µA") || value.includes("u")) {
    return `${numericValue}u`;
  } else if (value.includes("nA") || value.includes("n")) {
    return `${numericValue}n`;
  } else {
    return `${numericValue}m`; // Default to milliamps
  }
}