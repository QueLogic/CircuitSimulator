import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCircuitStore } from "@/stores/circuit-store";
import { runNgSpiceSimulation, checkNgSpiceHealth } from "@/utils/ngspice-client";

export default function NgSpiceStatus() {
  const { components } = useCircuitStore();
  const [ngspiceAvailable, setNgspiceAvailable] = useState(false);
  const [lastSimulation, setLastSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Check NGSpice availability
  useEffect(() => {
    checkNgSpiceHealth().then((health) => {
      setNgspiceAvailable(health.available);
    });
  }, []);

  // Run simulation when components change
  useEffect(() => {
    if (!ngspiceAvailable || components.length === 0) return;

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await runNgSpiceSimulation(components);
        setLastSimulation(result);
      } catch (error) {
        console.error("NGSpice simulation error:", error);
      } finally {
        setLoading(false);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [components, ngspiceAvailable]);

  return (
    <Card className="mb-4" data-testid="ngspice-status">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          NGSpice Engine
          <Badge variant={ngspiceAvailable ? "default" : "destructive"}>
            {ngspiceAvailable ? "Professional" : "Fallback"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {ngspiceAvailable
            ? "Using industry-standard SPICE simulation for 100% accurate results"
            : "NGSpice unavailable - using simplified simulation"}
        </div>

        {loading && (
          <div className="text-sm text-blue-600" data-testid="simulation-loading">
            Running professional circuit analysis...
          </div>
        )}

        {lastSimulation && (
          <div className="space-y-2" data-testid="simulation-results">
            <div className="text-sm font-medium">
              Simulation Status: 
              <Badge variant={lastSimulation.success ? "default" : "destructive"} className="ml-2">
                {lastSimulation.success ? "Success" : "Failed"}
              </Badge>
            </div>
            
            {lastSimulation.success && lastSimulation.data && (
              <div className="text-xs text-muted-foreground">
                Operating Points: {Object.keys(lastSimulation.data.operatingPoint).length} nodes
              </div>
            )}
            
            {!lastSimulation.success && lastSimulation.error && (
              <div className="text-xs text-red-600">
                Error: {lastSimulation.error}
              </div>
            )}
          </div>
        )}

        {components.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Add components to see NGSpice simulation results
          </div>
        )}
      </CardContent>
    </Card>
  );
}