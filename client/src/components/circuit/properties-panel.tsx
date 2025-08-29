import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCircuitStore } from "@/stores/circuit-store";
import { useEffect, useState } from "react";
import { checkNgSpiceHealth } from "@/utils/ngspice-client";

export default function PropertiesPanel() {
  const { selectedComponent, updateComponent } = useCircuitStore();
  const [ngspiceStatus, setNgspiceStatus] = useState<{ available: boolean; error: string | null }>({ available: false, error: null });

  useEffect(() => {
    // Check NGSpice status every 5 seconds
    const checkStatus = async () => {
      const status = await checkNgSpiceHealth();
      setNgspiceStatus(status);
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!selectedComponent) {
    return (
      <div className="space-y-4">
        {/* NGSpice Status */}
        <div className="p-4 border-b border-border" data-testid="ngspice-status">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            Simulation Engine
            <Badge variant={ngspiceStatus.available ? "default" : "destructive"}>
              {ngspiceStatus.available ? "Professional" : "Fallback"}
            </Badge>
          </h2>
          <div className="text-sm text-muted-foreground">
            {ngspiceStatus.available
              ? "🔬 Using industry-standard SPICE for 100% accurate circuit simulation"
              : "⚠️ NGSpice unavailable - using simplified simulation"}
          </div>
          {!ngspiceStatus.available && ngspiceStatus.error && (
            <div className="text-xs text-red-600 mt-1">
              Error: {ngspiceStatus.error}
            </div>
          )}
        </div>
        
        {/* Component Properties */}
        <div className="p-4 border-b border-border" data-testid="properties-panel">
          <h2 className="font-semibold text-lg mb-3">Component Properties</h2>
          <div className="text-sm text-muted-foreground">
            Select a component to view its properties
          </div>
        </div>
      </div>
    );
  }

  const handlePropertyChange = (field: string, value: string) => {
    updateComponent(selectedComponent.id, { [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* NGSpice Status */}
      <div className="p-4 border-b border-border" data-testid="ngspice-status">
        <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
          Simulation Engine
          <Badge variant={ngspiceStatus.available ? "default" : "destructive"}>
            {ngspiceStatus.available ? "Professional" : "Fallback"}
          </Badge>
        </h2>
        <div className="text-sm text-muted-foreground">
          {ngspiceStatus.available
            ? "🔬 Using industry-standard SPICE for 100% accurate circuit simulation"
            : "⚠️ NGSpice unavailable - using simplified simulation"}
        </div>
        {!ngspiceStatus.available && ngspiceStatus.error && (
          <div className="text-xs text-red-600 mt-1">
            Error: {ngspiceStatus.error}
          </div>
        )}
      </div>
      
      {/* Component Properties */}
      <div className="p-4 border-b border-border" data-testid="properties-panel">
        <h2 className="font-semibold text-lg mb-3">Component Properties</h2>
        
        <div className="space-y-4">
        <div>
          <Label htmlFor="component-type">Component Type</Label>
          <Input
            id="component-type"
            value={selectedComponent.kind}
            className="font-mono bg-muted"
            readOnly
            data-testid="input-component-type"
          />
        </div>
        
        <div>
          <Label htmlFor="component-ref">Reference</Label>
          <Input
            id="component-ref"
            value={selectedComponent.ref}
            onChange={(e) => handlePropertyChange("ref", e.target.value)}
            className="font-mono"
            data-testid="input-component-ref"
          />
        </div>

        {selectedComponent.model && (
          <div>
            <Label htmlFor="component-model">Model</Label>
            <Input
              id="component-model"
              value={selectedComponent.model}
              onChange={(e) => handlePropertyChange("model", e.target.value)}
              className="font-mono"
              data-testid="input-component-model"
            />
          </div>
        )}

        {selectedComponent.value && (
          <div>
            <Label htmlFor="component-value">Value</Label>
            <Input
              id="component-value"
              value={selectedComponent.value}
              onChange={(e) => handlePropertyChange("value", e.target.value)}
              className="font-mono"
              data-testid="input-component-value"
            />
          </div>
        )}

        <div>
          <Label>Position</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="pos-x" className="text-xs">X</Label>
              <Input
                id="pos-x"
                type="number"
                value={selectedComponent.position.x}
                onChange={(e) => {
                  const newPosition = {
                    ...selectedComponent.position,
                    x: parseInt(e.target.value) || 0
                  };
                  updateComponent(selectedComponent.id, { position: newPosition });
                }}
                className="font-mono text-sm"
                data-testid="input-position-x"
              />
            </div>
            <div>
              <Label htmlFor="pos-y" className="text-xs">Y</Label>
              <Input
                id="pos-y"
                type="number"
                value={selectedComponent.position.y}
                onChange={(e) => {
                  const newPosition = {
                    ...selectedComponent.position,
                    y: parseInt(e.target.value) || 0
                  };
                  updateComponent(selectedComponent.id, { position: newPosition });
                }}
                className="font-mono text-sm"
                data-testid="input-position-y"
              />
            </div>
          </div>
        </div>

        {selectedComponent.kind === "transistor" && (
          <div>
            <Label>Pinout</Label>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono mt-2">
              <div className="p-2 bg-muted rounded text-center">C</div>
              <div className="p-2 bg-muted rounded text-center">B</div>
              <div className="p-2 bg-muted rounded text-center">E</div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
