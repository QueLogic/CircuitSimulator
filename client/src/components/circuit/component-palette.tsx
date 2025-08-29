import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ComponentType } from "@/types/circuit-types";

const basicComponents: { type: ComponentType; label: string; svg: JSX.Element }[] = [
  {
    type: "resistor",
    label: "Resistor",
    svg: (
      <svg width="32" height="16" viewBox="0 0 32 16" className="text-circuit-component">
        <rect x="4" y="6" width="24" height="4" fill="currentColor" rx="2"/>
        <line x1="0" y1="8" x2="4" y2="8" stroke="currentColor" strokeWidth="2"/>
        <line x1="28" y1="8" x2="32" y2="8" stroke="currentColor" strokeWidth="2"/>
      </svg>
    )
  },
  {
    type: "capacitor",
    label: "Capacitor",
    svg: (
      <svg width="32" height="16" viewBox="0 0 32 16" className="text-circuit-component">
        <line x1="0" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="2"/>
        <line x1="14" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="3"/>
        <line x1="18" y1="2" x2="18" y2="14" stroke="currentColor" strokeWidth="3"/>
        <line x1="18" y1="8" x2="32" y2="8" stroke="currentColor" strokeWidth="2"/>
      </svg>
    )
  },
  {
    type: "led",
    label: "LED",
    svg: (
      <svg width="32" height="16" viewBox="0 0 32 16" className="text-circuit-success">
        <circle cx="16" cy="8" r="6" fill="currentColor" opacity="0.7"/>
        <line x1="0" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="2"/>
        <line x1="22" y1="8" x2="32" y2="8" stroke="currentColor" strokeWidth="2"/>
        <polygon points="13,8 19,5 19,11" fill="white"/>
      </svg>
    )
  },
  {
    type: "battery",
    label: "Battery",
    svg: (
      <svg width="32" height="16" viewBox="0 0 32 16" className="text-circuit-component">
        <line x1="0" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="2"/>
        <line x1="8" y1="4" x2="8" y2="12" stroke="currentColor" strokeWidth="3"/>
        <line x1="12" y1="6" x2="12" y2="10" stroke="currentColor" strokeWidth="3"/>
        <line x1="12" y1="8" x2="32" y2="8" stroke="currentColor" strokeWidth="2"/>
        <text x="20" y="6" className="text-xs font-bold" fill="currentColor">+</text>
      </svg>
    )
  },
  {
    type: "node",
    label: "Connection Node",
    svg: (
      <svg width="32" height="16" viewBox="0 0 32 16" className="text-circuit-component">
        <circle cx="16" cy="8" r="1.2" fill="currentColor"/>
        <circle cx="16" cy="6.8" r="0.5" fill="currentColor"/>
        <circle cx="17.2" cy="8" r="0.5" fill="currentColor"/>
        <circle cx="16" cy="9.2" r="0.5" fill="currentColor"/>
        <circle cx="14.8" cy="8" r="0.5" fill="currentColor"/>
        <line x1="16" y1="7.2" x2="16" y2="6.8" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="16.6" y1="8" x2="17.2" y2="8" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="16" y1="8.6" x2="16" y2="9.2" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="15.4" y1="8" x2="14.8" y2="8" stroke="currentColor" strokeWidth="0.5"/>
      </svg>
    )
  }
];

const transistors = [
  { type: "bc327" as ComponentType, label: "BC327" },
  { type: "bc337" as ComponentType, label: "BC337" },
  { type: "bc547" as ComponentType, label: "BC547" },
  { type: "bc548" as ComponentType, label: "BC548" },
  { type: "bc549" as ComponentType, label: "BC549" },
  { type: "bc550" as ComponentType, label: "BC550" },
];

const icChips = [
  { type: "ne555" as ComponentType, label: "NE555 Timer" },
  { type: "lm358" as ComponentType, label: "LM358 Op-Amp" },
  { type: "lm324" as ComponentType, label: "LM324 Quad Op-Amp" },
  { type: "cd4001" as ComponentType, label: "CD4001BE NOR" },
  { type: "cd4011" as ComponentType, label: "CD4011BE NAND" },
  { type: "cd4017" as ComponentType, label: "CD4017BE Counter" },
  { type: "cd4069" as ComponentType, label: "CD4069UBE Inverter" },
];

export default function ComponentPalette() {
  const [searchTerm, setSearchTerm] = useState("");

  const handleDragStart = (e: React.DragEvent, componentType: ComponentType) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type: componentType }));
  };

  const transistorSvg = (
    <svg width="32" height="16" viewBox="0 0 32 16" className="text-circuit-component">
      <circle cx="16" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="2"/>
      <line x1="13" y1="6" x2="19" y2="6" stroke="currentColor" strokeWidth="2"/>
      <line x1="13" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="2"/>
      <line x1="0" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="2"/>
      <line x1="19" y1="6" x2="26" y2="2" stroke="currentColor" strokeWidth="2"/>
      <line x1="19" y1="10" x2="26" y2="14" stroke="currentColor" strokeWidth="2"/>
      <polygon points="24,12 26,14 24,16" fill="currentColor"/>
    </svg>
  );

  const icSvg = (label: string) => (
    <svg width="48" height="32" viewBox="0 0 48 32" className="text-circuit-component">
      <rect x="8" y="4" width="32" height="24" fill="currentColor" rx="2"/>
      <rect x="10" y="6" width="28" height="20" fill="white"/>
      <text x="24" y="18" className="text-xs font-bold" textAnchor="middle" fill="currentColor">{label}</text>
      <circle cx="4" cy="8" r="2" fill="currentColor"/>
      <circle cx="4" cy="12" r="2" fill="currentColor"/>
      <circle cx="4" cy="16" r="2" fill="currentColor"/>
      <circle cx="4" cy="20" r="2" fill="currentColor"/>
      <circle cx="44" cy="8" r="2" fill="currentColor"/>
      <circle cx="44" cy="12" r="2" fill="currentColor"/>
      <circle cx="44" cy="16" r="2" fill="currentColor"/>
      <circle cx="44" cy="20" r="2" fill="currentColor"/>
    </svg>
  );

  return (
    <aside className="w-80 bg-card border-r border-border flex flex-col" data-testid="component-palette">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg mb-3">Component Library</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            type="text" 
            placeholder="Search components..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-components"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Basic Components */}
        <div className="p-4">
          <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wide">Basic Components</h3>
          <div className="grid grid-cols-2 gap-3">
            {basicComponents.map((component) => (
              <div
                key={component.type}
                className="component-symbol bg-muted hover:bg-accent p-3 rounded-lg cursor-grab border-2 border-transparent hover:border-circuit-green transition-all"
                draggable
                onDragStart={(e) => handleDragStart(e, component.type)}
                data-testid={`component-${component.type}`}
              >
                <div className="text-center">
                  <div className="w-full h-8 flex items-center justify-center">
                    {component.svg}
                  </div>
                  <span className="text-xs font-mono mt-1 block">{component.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transistors */}
        <div className="p-4 border-t border-border">
          <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wide">Transistors</h3>
          <div className="grid grid-cols-3 gap-2">
            {transistors.map((transistor) => (
              <div
                key={transistor.type}
                className="component-symbol bg-muted hover:bg-accent p-3 rounded-lg cursor-grab border-2 border-transparent hover:border-circuit-green transition-all"
                draggable
                onDragStart={(e) => handleDragStart(e, transistor.type)}
                data-testid={`component-${transistor.type}`}
              >
                <div className="text-center">
                  <div className="w-full h-8 flex items-center justify-center">
                    {transistorSvg}
                  </div>
                  <span className="text-xs font-mono mt-1 block">{transistor.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* IC Chips */}
        <div className="p-4 border-t border-border">
          <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wide">IC Chips</h3>
          <div className="grid grid-cols-1 gap-3">
            {icChips.map((chip) => (
              <div
                key={chip.type}
                className="component-symbol bg-muted hover:bg-accent p-3 rounded-lg cursor-grab border-2 border-transparent hover:border-circuit-green transition-all"
                draggable
                onDragStart={(e) => handleDragStart(e, chip.type)}
                data-testid={`component-${chip.type}`}
              >
                <div className="text-center">
                  <div className="w-full h-12 flex items-center justify-center">
                    {icSvg(chip.type === "ne555" ? "555" : "4017")}
                  </div>
                  <span className="text-xs font-mono mt-1 block">{chip.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
