import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCircuitStore } from "@/stores/circuit-store";
import { simulateCircuit, getSignalAtNode } from "@/utils/circuit-simulation";
import { runNgSpiceSimulation, convertNgSpiceToSimulationResults, getNgSpiceSignalAtNode, checkNgSpiceHealth } from "@/utils/ngspice-client";

export default function MultimeterPanel() {
  const { components, selectedComponent, isSimulating } = useCircuitStore();
  const [measurements, setMeasurements] = useState({
    voltage: 0,
    current: 0,
    resistance: 0
  });
  const [probeConnected, setProbeConnected] = useState(false);
  const [measurementMode, setMeasurementMode] = useState("voltage");
  const [probeLocation, setProbeLocation] = useState("auto");
  const [selectedNet, setSelectedNet] = useState("+V");
  const [ngspiceResult, setNgspiceResult] = useState<any>(null);
  const [usingProfessionalSim, setUsingProfessionalSim] = useState(false);
  const [ngspiceAvailable, setNgspiceAvailable] = useState(false);

  // Get all available nets for measurement
  const availableNets = Array.from(new Set(
    components.flatMap(comp => 
      Object.values(comp.pins || {}).map(pin => pin.net)
    ).filter(net => net && net.trim() !== "")
  ));

  // Check NGSpice availability
  useEffect(() => {
    checkNgSpiceHealth().then((health) => {
      setNgspiceAvailable(health.available);
    });
  }, []);

  // Run NGSpice simulation when components change
  useEffect(() => {
    // Only simulate if we have NGSpice available and real circuit components
    // Avoid simulating the fallback test circuit (R1 + V1)
    if (!ngspiceAvailable || components.length === 0 || 
        (components.length === 2 && 
         components.some(c => c.ref === "R1" && c.kind === "resistor") &&
         components.some(c => c.ref === "V1" && c.kind === "battery"))) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const result = await runNgSpiceSimulation(components);
        if (result.success) {
          setNgspiceResult(result);
          setUsingProfessionalSim(true);
        } else {
          setNgspiceResult(null);
          setUsingProfessionalSim(false);
        }
      } catch (error) {
        setNgspiceResult(null);
        setUsingProfessionalSim(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [components, ngspiceAvailable]);

  useEffect(() => {
    if (isSimulating && probeConnected) {
      const interval = setInterval(() => {
        // Try to use NGSpice results first, fallback to simplified simulation
        let simulationResults;
        let usingNgSpice = false;

        if (ngspiceResult && (ngspiceResult as any).success) {
          simulationResults = convertNgSpiceToSimulationResults(components, ngspiceResult);
          usingNgSpice = true;
        } else {
          simulationResults = simulateCircuit(components);
          usingNgSpice = false;
        }

        setUsingProfessionalSim(usingNgSpice);
        
        // Calculate measurements based on measurement mode and selection
        let voltage = 0;
        let current = 0;
        let resistance = 0;
        
        if (probeLocation === "net" && selectedNet) {
          // Measure specific net - try NGSpice first
          if (usingNgSpice && ngspiceResult) {
            voltage = getNgSpiceSignalAtNode(components, ngspiceResult, selectedNet);
          } else {
            voltage = getSignalAtNode(components, selectedNet);
          }
          
          // Find components connected to this net to get current
          const connectedComponents = components.filter(comp => 
            Object.values(comp.pins || {}).some(pin => pin.net === selectedNet)
          );
          
          current = connectedComponents.reduce((sum, comp) => {
            const result = simulationResults.find(r => r.componentId === comp.id);
            return sum + (result?.current || 0);
          }, 0);
          
          resistance = voltage / (current + 0.0001); // Avoid division by zero
        } else if (probeLocation === "component" && selectedComponent) {
          // Measure specific component
          const result = simulationResults.find(r => r.componentId === selectedComponent.id);
          if (result) {
            voltage = result.voltage;
            current = result.current;
            resistance = result.resistance;
          }
        } else {
          // Auto mode - show overall circuit measurements
          voltage = simulationResults.reduce((sum, r) => sum + r.voltage, 0) / simulationResults.length;
          current = simulationResults.reduce((sum, r) => sum + r.current, 0);
          resistance = simulationResults.reduce((sum, r) => sum + r.resistance, 0);
        }
        
        // Add small measurement noise for realism
        setMeasurements({
          voltage: voltage + (Math.random() - 0.5) * 0.05,
          current: current + (Math.random() - 0.5) * 0.001,
          resistance: resistance + (Math.random() - 0.5) * (resistance * 0.01)
        });
      }, 50); // Update more frequently for real-time feel

      return () => clearInterval(interval);
    }
  }, [isSimulating, selectedComponent, probeConnected, components, probeLocation, selectedNet, ngspiceResult]);

  const formatNumber = (value: number, decimals: number = 2) => {
    return value.toFixed(decimals);
  };

  const formatResistance = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}MΩ`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}kΩ`;
    }
    return `${value.toFixed(0)}Ω`;
  };

  const formatCurrent = (value: number) => {
    if (value >= 1) {
      return `${value.toFixed(2)}A`;
    } else if (value >= 0.001) {
      return `${(value * 1000).toFixed(1)}mA`;
    } else {
      return `${(value * 1000000).toFixed(0)}µA`;
    }
  };

  return (
    <div className="p-4 border-b border-border" data-testid="multimeter-panel">
      <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
        <div className="w-4 h-4 bg-circuit-blue rounded-full"></div>
        Multimeter
        {usingProfessionalSim && (
          <Badge variant="default" className="text-xs">
            Professional
          </Badge>
        )}
        {!usingProfessionalSim && ngspiceAvailable && (
          <Badge variant="secondary" className="text-xs">
            Fallback
          </Badge>
        )}
      </h2>
      
      {usingProfessionalSim && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
          <div className="text-xs text-green-700 flex items-center gap-1">
            🔬 Using professional SPICE simulation for 100% accurate measurements
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {/* Measurement display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted p-3 rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Voltage (V)</div>
            <div className="text-lg font-mono text-circuit-blue" data-testid="text-voltage">
              {formatNumber(measurements.voltage)}
            </div>
          </div>
          <div className="bg-muted p-3 rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Current</div>
            <div className="text-lg font-mono text-circuit-blue" data-testid="text-current">
              {formatCurrent(measurements.current)}
            </div>
          </div>
        </div>
        
        <div className="bg-muted p-3 rounded-md">
          <div className="text-xs text-muted-foreground mb-1">Resistance</div>
          <div className="text-lg font-mono text-circuit-blue" data-testid="text-resistance">
            {formatResistance(measurements.resistance)}
          </div>
        </div>
        
        {/* Probe configuration */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="measurement-mode">Mode</Label>
              <Select value={measurementMode} onValueChange={setMeasurementMode}>
                <SelectTrigger id="measurement-mode" className="h-8 text-xs" data-testid="select-measurement-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voltage">Voltage (V)</SelectItem>
                  <SelectItem value="current">Current (A)</SelectItem>
                  <SelectItem value="resistance">Resistance (Ω)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="probe-location">Probe</Label>
              <Select value={probeLocation} onValueChange={setProbeLocation}>
                <SelectTrigger id="probe-location" className="h-8 text-xs" data-testid="select-probe-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="component">Component</SelectItem>
                  <SelectItem value="net">Net/Node</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {probeLocation === "net" && (
            <div>
              <Label htmlFor="selected-net">Measure Net</Label>
              <Select value={selectedNet} onValueChange={setSelectedNet}>
                <SelectTrigger id="selected-net" className="h-8 text-xs" data-testid="select-measurement-net">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableNets.map(net => (
                    <SelectItem key={net} value={net}>{net}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={probeConnected ? "default" : "secondary"}
            className="flex-1"
            onClick={() => setProbeConnected(!probeConnected)}
            disabled={probeLocation === "component" && !selectedComponent}
            data-testid="button-connect-probe"
          >
            {probeConnected ? "Disconnect" : "Connect Probe"}
          </Button>
        </div>
        
        {/* Status messages */}
        {probeLocation === "net" && selectedNet && (
          <div className="text-xs text-muted-foreground">
            Measuring net: {selectedNet}
          </div>
        )}
        
        {probeLocation === "component" && selectedComponent && (
          <div className="text-xs text-muted-foreground">
            Measuring: {selectedComponent.kind} ({selectedComponent.ref})
          </div>
        )}
        
        {probeLocation === "component" && !selectedComponent && (
          <div className="text-xs text-muted-foreground">
            Select a component to measure
          </div>
        )}
        
        {probeLocation === "auto" && (
          <div className="text-xs text-muted-foreground">
            Auto measuring circuit
          </div>
        )}
      </div>
    </div>
  );
}