// Robust SI unit parsing for electronic components
// Handles values like "15kΩ", "1µF", "100µF", "220kΩ", etc.

export function parseSI(raw?: string): number {
  if (!raw) return NaN;
  const s0 = String(raw).trim();
  const s = s0
    .replace(/[, ]+/g, "")
    .replace(/[ΩΩOhm|ohm|F|H|V|A]$/i, "")
    .replace(/Ω|Ω|ohms?/gi, "");
  
  const m = s.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)([a-zA-Zµμ]*)$/);
  if (!m) return NaN;
  
  const num = parseFloat(m[1]);
  const sufRaw = m[2] || "";
  const suf = sufRaw;
  const l = suf.toLowerCase();
  
  const map: Record<string, number> = {
    "": 1,
    "k": 1e3, "K": 1e3,
    "m": 1e-3, "M": 1e6,
    "u": 1e-6, "µ": 1e-6, "μ": 1e-6,
    "n": 1e-9, "N": 1e-9,
    "p": 1e-12, "P": 1e-12,
    "f": 1e-15, "F": 1e-15,
    "a": 1e-18, "A": 1e-18,
    "g": 1e9, "G": 1e9,
    "t": 1e12, "T": 1e12,
  };
  
  const factor = map[l] ?? map[suf] ?? 1;
  return num * factor;
}

export function parseOhms(raw?: string): number {
  return parseSI(raw);
}

export function parseFarads(raw?: string): number {
  return parseSI(raw);
}

export function parseHenries(raw?: string): number {
  return parseSI(raw);
}

export function parseVolts(raw?: string): number {
  return parseSI(raw);
}

export function parseAmps(raw?: string): number {
  return parseSI(raw);
}

// Helper function to parse capacitance values specifically
export function parseCapacitanceValue(value: string): number {
  const parsed = parseFarads(value);
  return isNaN(parsed) ? 1e-6 : parsed; // Default to 1µF if parsing fails
}

// Helper function to parse resistance values specifically  
export function parseResistanceValue(value: string): number {
  const parsed = parseOhms(value);
  return isNaN(parsed) ? 1000 : parsed; // Default to 1kΩ if parsing fails
}

// Format numbers for SPICE netlist to avoid floating-point precision issues
export function formatSpiceNumber(val: number, preferSI: boolean = true): string {
  if (!Number.isFinite(val)) return "0";
  if (!preferSI) return val.toExponential(6);
  
  const abs = Math.abs(val);
  if (abs >= 1e6) return (val/1e6).toFixed(6).replace(/0+$/,"").replace(/\.$/,"") + "M";
  if (abs >= 1e3) return (val/1e3).toFixed(6).replace(/0+$/,"").replace(/\.$/,"") + "k";
  if (abs >= 1) return val.toFixed(6).replace(/0+$/,"").replace(/\.$/,"");
  if (abs >= 1e-3) return (val*1e3).toFixed(6).replace(/0+$/,"").replace(/\.$/,"") + "m";
  if (abs >= 1e-6) return (val*1e6).toFixed(6).replace(/0+$/,"").replace(/\.$/,"") + "u";
  if (abs >= 1e-9) return (val*1e9).toFixed(6).replace(/0+$/,"").replace(/\.$/,"") + "n";
  if (abs >= 1e-12) return (val*1e12).toFixed(6).replace(/0+$/,"").replace(/\.$/,"") + "p";
  
  return val.toExponential(6);
}