import { Play, Square, RotateCcw, Upload, Download, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCircuitStore } from "@/stores/circuit-store";

export default function TopToolbar() {
  const { 
    isSimulating, 
    simulationStatus, 
    startSimulation, 
    stopSimulation, 
    resetCircuit,
    setImportModalOpen,
    createNewCircuit 
  } = useCircuitStore();

  const handleExport = () => {
    const { exportCircuit } = useCircuitStore.getState();
    exportCircuit();
  };

  return (
    <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between" data-testid="toolbar-main">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-circuit-green flex items-center gap-2">
          <div className="w-6 h-6 bg-circuit-green rounded flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-sm"></div>
          </div>
          Circuit Simulator Pro
        </h1>
        <div className="flex items-center gap-2">
          <Button 
            onClick={createNewCircuit}
            variant="outline"
            className="border-circuit-green text-circuit-green hover:bg-circuit-green hover:text-white"
            data-testid="button-new-circuit"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Circuit
          </Button>
          <Button 
            onClick={startSimulation}
            disabled={isSimulating}
            className="bg-primary hover:bg-primary/90"
            data-testid="button-start-simulation"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Simulation
          </Button>
          <Button 
            onClick={stopSimulation}
            disabled={!isSimulating}
            variant="destructive"
            data-testid="button-stop-simulation"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop
          </Button>
          <Button 
            onClick={() => {
              // Import and call reset function
              import("@/utils/circuit-simulation").then(({ resetSimulationCache }) => {
                resetSimulationCache();
              });
              resetCircuit();
            }}
            variant="secondary"
            data-testid="button-reset-circuit"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono bg-muted px-2 py-1 rounded" data-testid="text-simulation-status">
          Status: {simulationStatus}
        </span>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setImportModalOpen(true)}
            title="Import Circuit"
            data-testid="button-import"
          >
            <Upload className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleExport}
            title="Export Circuit"
            data-testid="button-export"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            title="Settings"
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
