import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useCircuitStore } from "@/stores/circuit-store";
import { getSignalAtNode, getNoiseSignal, simulateCircuitProfessional, getCachedNgSpiceResult, Series, getDifferentialSeries, lttbDownsample, getSeriesForNet, resetSimulationCache } from "@/utils/circuit-simulation";
import { runNgSpiceSimulation, getNgSpiceSignalAtNode, checkNgSpiceHealth } from "@/utils/ngspice-client";
import { Badge } from "@/components/ui/badge";

export default function OscilloscopePanel() {
  const { components } = useCircuitStore();
  const [isRunning, setIsRunning] = useState(false);
  const [selectedProbe, setSelectedProbe] = useState("Q4B");
  const [referenceProbe, setReferenceProbe] = useState("GND");
  const [voltageScale, setVoltageScale] = useState("1");
  const [timeScale, setTimeScale] = useState("2");
  const [data, setData] = useState<Series | null>(null);
  const [stats, setStats] = useState({ avg: 0, points: 0, variation: 0 });
  const [ngspiceHealth, setNgspiceHealth] = useState<{ available: boolean; error: string | null }>({ available: false, error: null });
  const animationRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Extract unique net names from components for probe selection
  const availableNets = Array.from(new Set(
    components.flatMap(comp => 
      Object.values(comp.pins || {}).map(pin => pin.net)
    ).filter(net => net && net.trim() !== "")
  )).sort();

  // Add reset function
  const resetOscilloscope = () => {
    console.log("🔄 Resetting oscilloscope and simulation cache");
    resetSimulationCache();
    setData(null);
    setStats({ avg: 0, points: 0, variation: 0 });
    setIsRunning(false);
  };

  // Check NGSpice health on component mount
  useEffect(() => {
    checkNgSpiceHealth().then(setNgspiceHealth);
  }, []);

  // Update simulation data when components change
  useEffect(() => {
    if (components.length > 0) {
      simulateCircuitProfessional(components);
    }
  }, [components]);

  // Animation loop for real-time display
  useEffect(() => {
    if (!isRunning) return;

    const updateDisplay = () => {
      const result = getCachedNgSpiceResult();
      if (result?.success && result.data) {
        console.log(`🔍 Getting series for net "${selectedProbe}"`);
        
        // Get the series data for the selected probe
        let series = getSeriesForNet(result, selectedProbe);
        
        if (!series && selectedProbe !== "GND") {
          console.log(`⚠️ No series data for ${selectedProbe}, trying differential measurement`);
          series = getDifferentialSeries(result, selectedProbe, referenceProbe);
        }
        
        if (series && series.t.length > 0) {
          // Downsample if too many points for performance
          const targetPoints = 1200;
          const processedSeries = series.t.length > targetPoints ? 
            lttbDownsample(series, targetPoints) : series;
          
          setData(processedSeries);
          
          // Calculate statistics
          const voltages = processedSeries.v;
          const avg = voltages.reduce((sum, v) => sum + v, 0) / voltages.length;
          const variation = Math.max(...voltages) - Math.min(...voltages);
          
          setStats({
            avg: avg,
            points: processedSeries.t.length,
            variation: variation * 1000 // Convert to mV
          });
          
          console.log(`✅ Monitoring ${selectedProbe} with ${processedSeries.t.length} points, variation: ${variation * 1000}mV`);
        } else {
          console.log(`❌ No valid series data for ${selectedProbe}`);
          setData(null);
          setStats({ avg: 0, points: 0, variation: 0 });
        }
      }
      
      animationRef.current = requestAnimationFrame(updateDisplay);
    };

    animationRef.current = requestAnimationFrame(updateDisplay);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, selectedProbe, referenceProbe, components]);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Vertical grid lines (time)
    const timeDiv = parseFloat(timeScale);
    const timePerPixel = (timeDiv * 10) / width;
    for (let i = 0; i <= width; i += width / 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    
    // Horizontal grid lines (voltage)
    const voltDiv = parseFloat(voltageScale);
    for (let i = 0; i <= height; i += height / 8) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Center line
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Waveform
    if (data.t.length > 1) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const maxTime = Math.max(...data.t);
      const timeRange = timeDiv * 10; // Total time span shown
      
      data.t.forEach((time, i) => {
        const x = (time / timeRange) * width;
        const voltage = data.v[i];
        const y = height / 2 - (voltage / voltDiv) * (height / 8);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }
  }, [data, voltageScale, timeScale]);

  return (
    <div className="p-4 bg-black text-green-400 font-mono border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          📊 Oscilloscope
          <Badge variant={ngspiceHealth.available ? "default" : "destructive"}>
            {ngspiceHealth.available ? "NGSpice Ready" : "NGSpice Error"}
          </Badge>
        </h3>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsRunning(!isRunning)}
            variant={isRunning ? "destructive" : "default"}
            size="sm"
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            onClick={resetOscilloscope}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Probe</Label>
          <Select value={selectedProbe} onValueChange={setSelectedProbe}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableNets.map(net => (
                <SelectItem key={net} value={net}>{net}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Reference</Label>
          <Select value={referenceProbe} onValueChange={setReferenceProbe}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GND">GND</SelectItem>
              <SelectItem value="NONE">Single-ended</SelectItem>
              {availableNets.filter(net => net !== selectedProbe).map(net => (
                <SelectItem key={net} value={net}>{net}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Voltage/Div</Label>
          <Select value={voltageScale} onValueChange={setVoltageScale}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.1">0.1V/div</SelectItem>
              <SelectItem value="0.2">0.2V/div</SelectItem>
              <SelectItem value="0.5">0.5V/div</SelectItem>
              <SelectItem value="1">1V/div</SelectItem>
              <SelectItem value="2">2V/div</SelectItem>
              <SelectItem value="5">5V/div</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Time/Div</Label>
          <Select value={timeScale} onValueChange={setTimeScale}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.1">0.1ms/div</SelectItem>
              <SelectItem value="0.5">0.5ms/div</SelectItem>
              <SelectItem value="1">1ms/div</SelectItem>
              <SelectItem value="2">2ms/div</SelectItem>
              <SelectItem value="5">5ms/div</SelectItem>
              <SelectItem value="10">10ms/div</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-gray-900 p-2 rounded mb-4">
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="w-full border border-green-400"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>CH1: {voltageScale}V/div</div>
        <div>Time: {timeScale}ms/div</div>
        <div>Signal: {selectedProbe} {referenceProbe !== "NONE" ? `(vs ${referenceProbe})` : ""}</div>
        <div>Avg: {stats.avg.toFixed(2)}V</div>
        <div>Points: {stats.points}</div>
        <div>P-P: {stats.variation.toFixed(1)}mV</div>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        Monitoring: {selectedProbe} {referenceProbe !== "NONE" ? `(vs ${referenceProbe})` : "(single-ended)"}
      </div>
    </div>
  );
}