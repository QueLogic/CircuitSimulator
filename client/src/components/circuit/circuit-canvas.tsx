import { useRef, useEffect, useCallback } from "react";
import { ZoomIn, ZoomOut, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCircuitStore } from "@/stores/circuit-store";
import { ComponentType, CircuitComponent } from "@/types/circuit-types";
import { detectComponentFailures } from "@/utils/circuit-simulation";

export default function CircuitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastPanPositionRef = useRef({ x: 0, y: 0 });
  const isDraggingComponentRef = useRef(false);
  const dragComponentIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  
  // Double-click detection for dragging
  const lastClickTimeRef = useRef(0);
  const lastClickPosRef = useRef({ x: 0, y: 0 });
  const doubleClickThresholdRef = useRef(300); // 300ms for double-click
  const doubleClickDistanceRef = useRef(5); // Max 5px distance between clicks
  
  // Double right-click detection for nodes
  const lastRightClickTimeRef = useRef(0);
  const lastRightClickPosRef = useRef({ x: 0, y: 0 });
  
  // Wire dragging state
  const isWiringRef = useRef(false);
  const wireStartRef = useRef<{componentId: string, pin: string, position: {x: number, y: number}} | null>(null);
  const wireEndPosRef = useRef<{x: number, y: number}>({ x: 0, y: 0 });
  
  const { 
    components, 
    addComponent, 
    selectedComponent,
    setSelectedComponent,
    updateComponent,
    zoom,
    pan,
    setZoom,
    setPan,
    isSimulating
  } = useCircuitStore();
  
  // Get components with failure detection when simulation is running
  const componentsWithFailures = isSimulating ? detectComponentFailures(components) : components;

  const drawComponent = useCallback((ctx: CanvasRenderingContext2D, component: CircuitComponent) => {
    if (!component.position) return;
    const { x, y } = component.position;
    const time = Date.now() / 1000;
    
    ctx.save();
    
    // Check for component failure and flashing
    const isFlashing = component.failureState?.isFailed && Math.sin(time * 8) > 0; // Flash 4 times per second
    const flashColor = component.failureState?.severity === 'critical' ? '#ef4444' : '#f59e0b'; // Red for critical, amber for warning
    
    // Draw failure flash indicator first (behind everything)
    if (isFlashing && component.failureState?.isFailed) {
      ctx.save();
      ctx.strokeStyle = flashColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(x - 32, y - 22, 64, 44);
      ctx.restore();
    }
    
    // Draw selection highlight (smaller for nodes)
    if (selectedComponent?.id === component.id) {
      ctx.strokeStyle = "var(--circuit-active)";
      ctx.lineWidth = 3;
      if (component.kind === "node") {
        // Smaller selection highlight for nodes
        ctx.strokeRect(x - 9, y - 6, 18, 12); // Slightly larger than background
      } else {
        ctx.strokeRect(x - 30, y - 20, 60, 40);
      }
    }
    
    // Draw component background (smaller for nodes)
    ctx.fillStyle = "white";
    ctx.strokeStyle = component.id === selectedComponent?.id ? "var(--circuit-active)" : "var(--circuit-green)";
    ctx.lineWidth = 2;
    
    if (component.kind === "node") {
      // Much smaller rectangle for nodes (30% of original size)
      ctx.fillRect(x - 7.5, y - 4.5, 15, 9); // 50*0.3 = 15, 30*0.3 = 9  
      ctx.strokeRect(x - 7.5, y - 4.5, 15, 9);
    } else {
      ctx.fillRect(x - 25, y - 15, 50, 30);
      ctx.strokeRect(x - 25, y - 15, 50, 30);
    }
    
    // Add warning text for failed components
    if (component.failureState?.isFailed) {
      ctx.save();
      ctx.fillStyle = flashColor;
      ctx.font = "bold 9px 'Roboto Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("⚠ FAIL", x, y - 30);
      
      // Show failure reason on hover or selection
      if (selectedComponent?.id === component.id) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(x - 60, y + 35, 120, 20);
        ctx.fillStyle = "white";
        ctx.font = "8px 'Roboto Mono', monospace";
        ctx.fillText(component.failureState.reason, x, y + 47);
      }
      ctx.restore();
    }
    
    // Draw component symbol based on type
    ctx.fillStyle = "var(--circuit-component)";
    ctx.font = "10px 'Roboto Mono', monospace";
    ctx.textAlign = "center";
    
    switch (component.kind) {
      case "resistor":
        // Draw resistor symbol - zigzag pattern
        ctx.beginPath();
        ctx.moveTo(x - 20, y);
        ctx.lineTo(x - 15, y - 5);
        ctx.lineTo(x - 10, y + 5);
        ctx.lineTo(x - 5, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.lineTo(x + 5, y - 5);
        ctx.lineTo(x + 10, y + 5);
        ctx.lineTo(x + 15, y - 5);
        ctx.lineTo(x + 20, y);
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 2;
        ctx.stroke();
        // Connection lines
        ctx.beginPath();
        ctx.moveTo(x - 25, y);
        ctx.lineTo(x - 20, y);
        ctx.moveTo(x + 20, y);
        ctx.lineTo(x + 25, y);
        ctx.stroke();
        
        // Add pin dots for resistor
        ctx.fillStyle = "#FFD700"; // Yellow dots
        ctx.beginPath();
        ctx.arc(x - 25, y, 3, 0, 2 * Math.PI); // Pin 1
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 25, y, 3, 0, 2 * Math.PI); // Pin 2
        ctx.fill();
        
        ctx.fillStyle = "var(--circuit-component)";
        ctx.fillText(`${component.ref}`, x, y + 25);
        ctx.fillText(`${component.value || "1kΩ"}`, x, y + 35);
        break;
      case "transistor":
        // Draw transistor symbol - circle with C, B, E pins
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, 2 * Math.PI);
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Base line
        ctx.beginPath();
        ctx.moveTo(x - 20, y);
        ctx.lineTo(x - 8, y);
        ctx.moveTo(x - 8, y - 6);
        ctx.lineTo(x - 8, y + 6);
        ctx.stroke();
        
        // Collector (top)
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 6);
        ctx.lineTo(x + 8, y - 12);
        ctx.lineTo(x + 8, y - 20);
        ctx.stroke();
        
        // Emitter (bottom) with arrow
        ctx.beginPath();
        ctx.moveTo(x - 4, y + 6);
        ctx.lineTo(x + 8, y + 12);
        ctx.lineTo(x + 8, y + 20);
        ctx.stroke();
        
        // Arrow on emitter for NPN
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 8);
        ctx.lineTo(x + 8, y + 12);
        ctx.lineTo(x + 6, y + 14);
        ctx.fillStyle = "var(--circuit-component)";
        ctx.fill();
        
        
        // Add pin dots for transistor: E, B, C
        ctx.fillStyle = "#FFD700"; // Yellow dots
        ctx.beginPath();
        ctx.arc(x - 20, y, 3, 0, 2 * Math.PI); // Base
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 8, y - 20, 3, 0, 2 * Math.PI); // Collector
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 8, y + 20, 3, 0, 2 * Math.PI); // Emitter
        ctx.fill();
        
        // Add pin labels
        ctx.fillStyle = "#0080FF"; // Blue labels
        ctx.font = "8px 'Roboto Mono', monospace";
        ctx.fillText("B", x - 26, y + 3);
        ctx.fillText("C", x + 14, y - 17);
        ctx.fillText("E", x + 14, y + 23);
        
        ctx.font = "10px 'Roboto Mono', monospace";
        ctx.fillText(`${component.ref}`, x, y + 40);
        ctx.fillText(`${component.model || "BC337"}`, x, y + 50);
        break;
      case "capacitor":
        // Draw capacitor symbol - two parallel plates
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 12);
        ctx.lineTo(x - 3, y + 12);
        ctx.moveTo(x + 3, y - 12);
        ctx.lineTo(x + 3, y + 12);
        ctx.stroke();
        
        // Connection lines
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 25, y);
        ctx.lineTo(x - 3, y);
        ctx.moveTo(x + 3, y);
        ctx.lineTo(x + 25, y);
        ctx.stroke();
        
        // Polarity marking for electrolytics
        if (component.type === "electrolytic") {
          ctx.fillStyle = "var(--circuit-active)";
          ctx.fillText("+", x - 10, y - 15);
          ctx.fillText("-", x + 10, y - 15);
        }
        
        
        // Add pin dots for capacitor
        ctx.fillStyle = "#FFD700"; // Yellow dots
        ctx.beginPath();
        ctx.arc(x - 25, y, 3, 0, 2 * Math.PI); // Pin 1
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 25, y, 3, 0, 2 * Math.PI); // Pin 2
        ctx.fill();
        
        ctx.fillStyle = "var(--circuit-component)";
        ctx.fillText(`${component.ref}`, x, y + 25);
        ctx.fillText(`${component.value || "1µF"}`, x, y + 35);
        break;
      case "led":
        // Draw LED symbol
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = component.id === selectedComponent?.id ? "var(--circuit-active)" : "var(--circuit-success)";
        ctx.fill();
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw connection lines
        ctx.beginPath();
        ctx.moveTo(x - 25, y);
        ctx.lineTo(x - 8, y);
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + 25, y);
        ctx.stroke();
        
        // Add pin dots for LED: Anode and Cathode
        ctx.fillStyle = "#FFD700"; // Yellow dots
        ctx.beginPath();
        ctx.arc(x - 25, y, 3, 0, 2 * Math.PI); // Anode
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 25, y, 3, 0, 2 * Math.PI); // Cathode
        ctx.fill();
        
        // Add polarity indicators
        ctx.fillStyle = "#0080FF"; // Blue labels
        ctx.font = "8px 'Roboto Mono', monospace";
        ctx.fillText("+", x - 31, y + 3); // Anode
        ctx.fillText("-", x + 31, y + 3); // Cathode
        
        ctx.font = "10px 'Roboto Mono', monospace";
        ctx.fillStyle = "var(--circuit-component)";
        ctx.fillText(`${component.ref}`, x, y + 25);
        break;
      case "battery":
        // Draw battery symbol - long and short plates
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 12);
        ctx.lineTo(x - 5, y + 12);
        ctx.moveTo(x + 2, y - 8);
        ctx.lineTo(x + 2, y + 8);
        ctx.moveTo(x + 5, y - 12);
        ctx.lineTo(x + 5, y + 12);
        ctx.stroke();
        
        
        // Draw connection lines
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 25, y);
        ctx.lineTo(x - 5, y);
        ctx.moveTo(x + 5, y);
        ctx.lineTo(x + 25, y);
        ctx.stroke();
        
        // Add pin dots for battery
        ctx.fillStyle = "#FFD700"; // Yellow dots
        ctx.beginPath();
        ctx.arc(x - 25, y, 3, 0, 2 * Math.PI); // Negative terminal
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 25, y, 3, 0, 2 * Math.PI); // Positive terminal
        ctx.fill();
        
        ctx.fillStyle = "#0080FF"; // Blue labels
        ctx.fillText("+", x + 15, y - 5);
        ctx.fillText("-", x - 15, y - 5);
        ctx.fillStyle = "var(--circuit-component)";
        ctx.fillText(`${component.ref}`, x, y + 25);
        ctx.fillText(`${component.value || "5V"}`, x, y + 35);
        break;
      case "oscilloscope":
        // Draw oscilloscope symbol
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 2;
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(x - 30, y - 20, 60, 40);
        ctx.strokeRect(x - 30, y - 20, 60, 40);
        
        // Screen
        ctx.fillStyle = "#003300";
        ctx.fillRect(x - 25, y - 15, 50, 30);
        
        // Waveform
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 40; i++) {
          const waveX = x - 20 + i;
          const waveY = y + Math.sin(i * 0.3) * 5;
          if (i === 0) ctx.moveTo(waveX, waveY);
          else ctx.lineTo(waveX, waveY);
        }
        ctx.stroke();
        
        // Controls
        ctx.fillStyle = "var(--circuit-component)";
        ctx.beginPath();
        ctx.arc(x - 20, y + 25, 2, 0, 2 * Math.PI);
        ctx.arc(x, y + 25, 2, 0, 2 * Math.PI);
        ctx.arc(x + 20, y + 25, 2, 0, 2 * Math.PI);
        ctx.fill();
        
        
        // Add pin dots for oscilloscope: Probe and Ground
        ctx.fillStyle = "#FFD700"; // Yellow dots
        ctx.beginPath();
        ctx.arc(x - 35, y, 3, 0, 2 * Math.PI); // Probe (CH1_TIP)
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 35, y, 3, 0, 2 * Math.PI); // Ground (GND)
        ctx.fill();
        
        // Draw connection lines
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 35, y);
        ctx.lineTo(x - 30, y);
        ctx.moveTo(x + 30, y);
        ctx.lineTo(x + 35, y);
        ctx.stroke();
        
        // Add pin labels
        ctx.fillStyle = "#0080FF"; // Blue labels
        ctx.font = "8px 'Roboto Mono', monospace";
        ctx.fillText("PROBE", x - 48, y + 3);
        ctx.fillText("GND", x + 38, y + 3);
        
        ctx.font = "10px 'Roboto Mono', monospace";
        ctx.fillText(`${component.ref}`, x, y + 45);
        ctx.fillText("SCOPE", x, y + 55);
        break;
      case "node":
        // Draw signal splitter/junction node - rectangular with single input/output
        ctx.fillStyle = "var(--circuit-component)";
        ctx.fillRect(x - 6, y - 4, 12, 8); // Small rectangle center
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 6, y - 4, 12, 8);
        
        // Draw single input dot (left) - green
        ctx.fillStyle = "#00FF00"; // Green for input
        ctx.beginPath();
        ctx.arc(x - 8, y, 3, 0, 2 * Math.PI); // Single IN pin
        ctx.fill();
        
        // Draw single output dot (right) - orange  
        ctx.fillStyle = "#FF8000"; // Orange for output
        ctx.beginPath();
        ctx.arc(x + 8, y, 3, 0, 2 * Math.PI); // Single OUT pin
        ctx.fill();
        
        // Draw connection line inside the node (input to output)
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 6, y); // From left edge
        ctx.lineTo(x + 6, y);  // To right edge
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = "#00FF00"; // Green
        ctx.font = "6px 'Roboto Mono', monospace";
        ctx.fillText("IN", x - 18, y + 2);
        ctx.fillStyle = "#FF8000"; // Orange  
        ctx.fillText("OUT", x + 12, y + 2);
        
        ctx.fillStyle = "var(--circuit-component)";
        ctx.font = "8px 'Roboto Mono', monospace";
        ctx.fillText(`${component.ref}`, x, y + 15);
        break;
      // IC Chips - check component.type for specific IC types
      case "ic":
        if (!component.type || !["ne555", "lm358", "lm324", "lm393", "lm339", "cd4001", "cd4007", "cd4011", "cd4013", "cd4017", "cd4052", "cd4053", "cd4060", "cd4069", "cd4093", "cd3066"].includes(component.type)) {
          // Fall back to default drawing for unknown IC types
          ctx.fillStyle = "var(--circuit-component)";
          ctx.fillRect(x - 15, y - 10, 30, 20);
          ctx.fillText(`${component.ref}`, x, y + 25);
          break;
        }
        // Draw IC chip body
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(x - 30, y - 20, 60, 40);
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 30, y - 20, 60, 40);
        
        // Draw chip label area
        ctx.fillStyle = "white";
        ctx.fillRect(x - 28, y - 18, 56, 36);
        
        // Add chip model text
        ctx.fillStyle = "var(--circuit-component)";
        ctx.font = "9px 'Roboto Mono', monospace";
        ctx.fillText(component.kind.toUpperCase(), x, y - 5);
        ctx.font = "8px 'Roboto Mono', monospace";
        ctx.fillText(component.model || "", x, y + 5);
        
        // Add notch indicator (pin 1 indicator)
        ctx.fillStyle = "#1a1a1a";
        ctx.beginPath();
        ctx.arc(x - 25, y - 15, 3, 0, Math.PI, false);
        ctx.fill();
        
        // Determine pin count and layout based on chip type
        let pinCount = 8; // Default for most chips
        let pinsPerSide = 4;
        
        if (component.type && ["lm324", "cd4017", "cd4060", "cd4052", "cd4053"].includes(component.type)) {
          pinCount = 16;
          pinsPerSide = 8;
        } else if (component.type && ["lm339", "cd4001", "cd4007", "cd4011", "cd4013", "cd4069", "cd4093", "cd3066"].includes(component.type)) {
          pinCount = 14;
          pinsPerSide = 7;
        }
        
        // Draw pins with yellow dots and blue labels
        const pinSpacing = 35 / (pinsPerSide - 1); // Spacing between pins
        
        for (let i = 0; i < pinsPerSide; i++) {
          // Left side pins (1 to pinsPerSide)
          const leftY = y - 17.5 + (i * pinSpacing);
          ctx.fillStyle = "#FFD700"; // Yellow dots
          ctx.beginPath();
          ctx.arc(x - 35, leftY, 3, 0, 2 * Math.PI);
          ctx.fill();
          
          // Pin number labels (blue)
          ctx.fillStyle = "#0080FF";
          ctx.font = "7px 'Roboto Mono', monospace";
          ctx.fillText(`${i + 1}`, x - 44, leftY + 2);
          
          // Right side pins (pinCount down to pinsPerSide + 1)
          const rightY = y + 17.5 - (i * pinSpacing);
          ctx.fillStyle = "#FFD700"; // Yellow dots
          ctx.beginPath();
          ctx.arc(x + 35, rightY, 3, 0, 2 * Math.PI);
          ctx.fill();
          
          // Pin number labels (blue)
          ctx.fillStyle = "#0080FF";
          ctx.fillText(`${pinCount - i}`, x + 39, rightY + 2);
        }
        
        // Draw connection lines from pins to chip body
        ctx.strokeStyle = "var(--circuit-component)";
        ctx.lineWidth = 1;
        for (let i = 0; i < pinsPerSide; i++) {
          const leftY = y - 17.5 + (i * pinSpacing);
          const rightY = y + 17.5 - (i * pinSpacing);
          
          // Left side connections
          ctx.beginPath();
          ctx.moveTo(x - 35, leftY);
          ctx.lineTo(x - 30, leftY);
          ctx.stroke();
          
          // Right side connections
          ctx.beginPath();
          ctx.moveTo(x + 30, rightY);
          ctx.lineTo(x + 35, rightY);
          ctx.stroke();
        }
        
        // Component reference
        ctx.fillStyle = "var(--circuit-component)";
        ctx.font = "10px 'Roboto Mono', monospace";
        ctx.fillText(`${component.ref}`, x, y + 35);
        break;
        
      default:
        // Default component
        ctx.fillRect(x - 15, y - 10, 30, 20);
        ctx.fillStyle = "white";
        ctx.fillText(component.kind.toUpperCase(), x, y - 2);
        ctx.fillStyle = "var(--circuit-component)";
        ctx.fillText(`${component.ref}`, x, y + 25);
        break;
    }
    
    ctx.restore();
  }, [selectedComponent]);


  const drawConnections = useCallback((ctx: CanvasRenderingContext2D) => {
    const nets: Record<string, Array<{component: CircuitComponent, pin: string, position: {x: number, y: number}}>> = {};
    
    
    // Group pins by net
    componentsWithFailures.forEach(component => {
      if (!component.pins) return;
      
      // Use the same pin position calculation as pin detection
      const componentPins = getComponentPins(component);
      
      Object.entries(component.pins).forEach(([pin, pinData]) => {
        if (!pinData.net || pinData.net.trim() === '') return; // Skip empty nets
        
        if (!nets[pinData.net]) {
          nets[pinData.net] = [];
        }
        
        // Find the exact pin position using the same calculation as pin detection
        const pinInfo = componentPins.find(p => p.pin === pin);
        if (pinInfo) {
          nets[pinData.net].push({
            component,
            pin,
            position: pinInfo.position
          });
        }
      });
    });
    
    // Draw connections for each net
    Object.entries(nets).forEach(([netName, pins]) => {
      if (pins.length < 2) return;
      
      // Use grey color for all wire connections
      let strokeColor = "#6b7280"; // Grey color for all wires
      let lineWidth = 2;
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      
      // Create a more intelligent connection layout
      if (pins.length === 2) {
        // Simple point-to-point connection
        const startPin = pins[0];
        const endPin = pins[1];
        
        ctx.beginPath();
        ctx.moveTo(startPin.position.x, startPin.position.y);
        
        // Use L-shaped routing for cleaner layout
        if (Math.abs(startPin.position.x - endPin.position.x) > Math.abs(startPin.position.y - endPin.position.y)) {
          // Horizontal routing
          const midX = (startPin.position.x + endPin.position.x) / 2;
          ctx.lineTo(midX, startPin.position.y);
          ctx.lineTo(midX, endPin.position.y);
          ctx.lineTo(endPin.position.x, endPin.position.y);
        } else {
          // Vertical routing
          const midY = (startPin.position.y + endPin.position.y) / 2;
          ctx.lineTo(startPin.position.x, midY);
          ctx.lineTo(endPin.position.x, midY);
          ctx.lineTo(endPin.position.x, endPin.position.y);
        }
        
        ctx.stroke();
      } else {
        // Multiple connections - check if any pin belongs to an N node
        const nodePins = pins.filter(p => p.component.kind === "node");
        
        if (nodePins.length > 0) {
          // Smart N node connection logic - separate component pins from N node pins
          const componentPins = pins.filter(p => p.component.kind !== "node");
          
          // Separate N node pins by type (IN vs OUT)
          const inPins = nodePins.filter(p => p.pin === "IN");
          const outPins = nodePins.filter(p => p.pin === "OUT");
          
          // Connect component pins to N nodes intelligently
          if (componentPins.length > 0) {
            // Determine if this is signal splitting or merging based on N node pin counts
            const totalInPins = inPins.length;
            const totalOutPins = outPins.length;
            
            if (totalOutPins > totalInPins) {
              // Signal SPLITTING: Connect component pins to IN pins
              inPins.forEach(inPin => {
                componentPins.forEach(compPin => {
                  ctx.beginPath();
                  ctx.moveTo(compPin.position.x, compPin.position.y);
                  ctx.lineTo(inPin.position.x, inPin.position.y);
                  ctx.stroke();
                });
              });
            } else {
              // Signal MERGING or EQUAL: Connect component pins to OUT pins  
              outPins.forEach(outPin => {
                componentPins.forEach(compPin => {
                  ctx.beginPath();
                  ctx.moveTo(compPin.position.x, compPin.position.y);
                  ctx.lineTo(outPin.position.x, outPin.position.y);
                  ctx.stroke();
                });
              });
            }
          }
          
          // Connect multiple N nodes if they exist (N-to-N connections)
          if (inPins.length > 1) {
            // Connect all IN pins to each other
            for (let i = 0; i < inPins.length; i++) {
              for (let j = i + 1; j < inPins.length; j++) {
                ctx.beginPath();
                ctx.moveTo(inPins[i].position.x, inPins[i].position.y);
                ctx.lineTo(inPins[j].position.x, inPins[j].position.y);
                ctx.stroke();
              }
            }
          }
          
          if (outPins.length > 1) {
            // Connect all OUT pins to each other
            for (let i = 0; i < outPins.length; i++) {
              for (let j = i + 1; j < outPins.length; j++) {
                ctx.beginPath();
                ctx.moveTo(outPins[i].position.x, outPins[i].position.y);
                ctx.lineTo(outPins[j].position.x, outPins[j].position.y);
                ctx.stroke();
              }
            }
          }
        } else {
          // No N node - allow direct multi-pin connections without creating junctions
          // Check if all pins connect to a single component pin (multiple connections to one pin)
          const pinsByComponent = pins.reduce((acc, pin) => {
            const key = `${pin.component.id}:${pin.pin}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(pin);
            return acc;
          }, {} as Record<string, typeof pins>);
          
          const componentPinGroups = Object.values(pinsByComponent);
          
          if (componentPinGroups.length === 2) {
            // Simple case: direct connection between two component pins (no junction needed)
            const pin1 = pins[0];
            const pin2 = pins[1];
            ctx.beginPath();
            ctx.moveTo(pin1.position.x, pin1.position.y);
            ctx.lineTo(pin2.position.x, pin2.position.y);
            ctx.stroke();
          } else {
            // Check if we have one pin with multiple connections (the user's requested behavior)
            const singlePinGroups = componentPinGroups.filter(group => group.length === 1);
            const multiPinGroups = componentPinGroups.filter(group => group.length > 1);
            
            if (multiPinGroups.length === 1 && singlePinGroups.length > 0) {
              // Multiple connections to a single component pin - draw direct lines
              const targetPin = multiPinGroups[0][0]; // The pin receiving multiple connections
              singlePinGroups.forEach(sourceGroup => {
                const sourcePin = sourceGroup[0];
                ctx.beginPath();
                ctx.moveTo(sourcePin.position.x, sourcePin.position.y);
                ctx.lineTo(targetPin.position.x, targetPin.position.y);
                ctx.stroke();
              });
            } else {
              // Fall back to hub approach only for complex multi-component connections
              const centerX = pins.reduce((sum, p) => sum + p.position.x, 0) / pins.length;
              const centerY = pins.reduce((sum, p) => sum + p.position.y, 0) / pins.length;
              
              pins.forEach(pin => {
                ctx.beginPath();
                ctx.moveTo(pin.position.x, pin.position.y);
                ctx.lineTo(centerX, centerY);
                ctx.stroke();
              });
              
              // Draw small junction dot only for complex connections
              ctx.beginPath();
              ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
              ctx.fillStyle = strokeColor;
              ctx.fill();
            }
          }
        }
      }
      
      // Draw net label with better positioning
      if (pins.length > 0 && ['+V', 'GND', 'NOISE', 'SCOPE_OUT'].includes(netName)) {
        const centerX = pins.reduce((sum, p) => sum + p.position.x, 0) / pins.length;
        const centerY = pins.reduce((sum, p) => sum + p.position.y, 0) / pins.length;
        
        ctx.fillStyle = strokeColor;
        ctx.font = "bold 10px 'Roboto Mono', monospace";
        ctx.textAlign = "center";
        
        // Position label to avoid overlapping with components
        let labelY = centerY - 15;
        if (pins.some(p => Math.abs(p.position.y - centerY) < 20)) {
          labelY = centerY - 25;
        }
        
        ctx.fillText(netName, centerX, labelY);
      }
    });
  }, [componentsWithFailures]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan transformation
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);

    // Draw connections first (so they appear behind components)
    drawConnections(ctx);
    
    // Draw components with failure detection
    componentsWithFailures.forEach(component => {
      drawComponent(ctx, component);
    });

    // Draw wire being dragged
    if (isWiringRef.current && wireStartRef.current) {
      ctx.beginPath();
      ctx.moveTo(wireStartRef.current.position.x, wireStartRef.current.position.y);
      ctx.lineTo(wireEndPosRef.current.x, wireEndPosRef.current.y);
      ctx.strokeStyle = "#10b981"; // Green for new wire
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // Dashed line
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash pattern
      
      // Draw start pin highlight
      ctx.beginPath();
      ctx.arc(wireStartRef.current.position.x, wireStartRef.current.position.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "#10b981";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }, [componentsWithFailures, zoom, pan, drawComponent, drawConnections]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const container = containerRef.current;
      if (!container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      drawCanvas();
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, [drawCanvas]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);
  
  // Animation loop for flashing failed components when simulation is running
  useEffect(() => {
    if (!isSimulating) return;
    
    const animate = () => {
      drawCanvas();
    };
    
    const intervalId = setInterval(animate, 1000 / 30); // 30 FPS for smooth flashing
    
    return () => {
      clearInterval(intervalId);
    };
  }, [isSimulating, drawCanvas]);

  const toggleNodePin = (componentId: string, pinId: string) => {
    const component = components.find(c => c.id === componentId);
    if (!component || !component.connectionPins) return;

    const updatedConnectionPins = component.connectionPins.map(pin => 
      pin.id === pinId ? { ...pin, connected: !pin.connected } : pin
    );

    updateComponent(componentId, { connectionPins: updatedConnectionPins });
  };

  const isDoubleClick = (x: number, y: number, currentTime: number): boolean => {
    const timeDiff = currentTime - lastClickTimeRef.current;
    const distance = Math.sqrt(
      (x - lastClickPosRef.current.x) ** 2 + (y - lastClickPosRef.current.y) ** 2
    );

    if (
      timeDiff < doubleClickThresholdRef.current && 
      distance < doubleClickDistanceRef.current
    ) {
      return true;
    }

    lastClickTimeRef.current = currentTime;
    lastClickPosRef.current = { x, y };
    return false;
  };

  const isDoubleRightClick = (x: number, y: number, currentTime: number): boolean => {
    const timeDiff = currentTime - lastRightClickTimeRef.current;
    const distance = Math.sqrt(
      (x - lastRightClickPosRef.current.x) ** 2 + (y - lastRightClickPosRef.current.y) ** 2
    );

    if (
      timeDiff < doubleClickThresholdRef.current && 
      distance < doubleClickDistanceRef.current
    ) {
      return true;
    }

    lastRightClickTimeRef.current = currentTime;
    lastRightClickPosRef.current = { x, y };
    return false;
  };

  // Get pin positions for any component type
  const getComponentPins = (component: CircuitComponent): Array<{pin: string, position: {x: number, y: number}}> => {
    const pins: Array<{pin: string, position: {x: number, y: number}}> = [];
    
    if (!component.position) return pins;

    if (component.kind === "transistor") {
      pins.push(
        { pin: "C", position: { x: component.position.x + 0, y: component.position.y - 15 } },
        { pin: "B", position: { x: component.position.x - 20, y: component.position.y + 0 } },
        { pin: "E", position: { x: component.position.x + 0, y: component.position.y + 15 } }
      );
    } else if (component.kind === "resistor" || component.kind === "capacitor" || component.kind === "led" || component.kind === "battery") {
      pins.push(
        { pin: "1", position: { x: component.position.x - 25, y: component.position.y } },
        { pin: "2", position: { x: component.position.x + 25, y: component.position.y } }
      );
    } else if (component.kind === "ic") {
      // IC pins - get from the actual pin definitions
      if (component.pins) {
        Object.keys(component.pins).forEach(pin => {
          // Calculate IC pin positions based on pin number and IC layout
          const pinNum = parseInt(pin);
          if (!isNaN(pinNum)) {
            let pinCount = 8; // Default
            if (component.type && ["lm324", "cd4017", "cd4060", "cd4052", "cd4053"].includes(component.type)) {
              pinCount = 16;
            } else if (component.type && ["lm339", "cd4001", "cd4007", "cd4011", "cd4013", "cd4069", "cd4093", "cd3066"].includes(component.type)) {
              pinCount = 14;
            }
            
            const pinsPerSide = pinCount / 2;
            const pinSpacing = 35 / (pinsPerSide - 1);
            
            let pinX = 0, pinY = 0;
            if (pinNum <= pinsPerSide) {
              // Left side pins
              pinX = component.position.x - 30;
              pinY = component.position.y - 17.5 + (pinNum - 1) * pinSpacing;
            } else {
              // Right side pins
              pinX = component.position.x + 30;
              pinY = component.position.y + 17.5 - (pinNum - pinsPerSide - 1) * pinSpacing;
            }
            
            pins.push({ pin, position: { x: pinX, y: pinY } });
          }
        });
      }
    } else if (component.kind === "oscilloscope") {
      // Oscilloscope pins - CH1_TIP (input) and GND
      pins.push(
        { pin: "CH1_TIP", position: { x: component.position.x - 35, y: component.position.y } }, // Left pin (Probe)
        { pin: "GND", position: { x: component.position.x + 35, y: component.position.y } }       // Right pin (Ground)
      );
    } else if (component.kind === "node") {
      // Node component - Single input and output for signal splitting/junction
      pins.push(
        // Left side input (single pin for multiple connections)
        { pin: "IN", position: { x: component.position.x - 8, y: component.position.y } },
        // Right side output (single pin for multiple connections) 
        { pin: "OUT", position: { x: component.position.x + 8, y: component.position.y } }
      );
    }

    return pins;
  };

  // Find pin at given coordinates (prioritizes component pins over N node pins)
  const findPinAtPosition = (x: number, y: number): {componentId: string, pin: string, position: {x: number, y: number}} | null => {
    let closestPin: {componentId: string, pin: string, position: {x: number, y: number}, distance: number} | null = null;
    
    // First pass: Look for non-N-node component pins (prioritized)
    for (const component of components) {
      if (component.kind !== "node") {  // Skip N nodes in first pass
        const pins = getComponentPins(component);
        
        for (const pinData of pins) {
          const distance = Math.sqrt((x - pinData.position.x) ** 2 + (y - pinData.position.y) ** 2);
          
          if (distance < 15) { // 15px radius for easier clicking
            if (!closestPin || distance < closestPin.distance) {
              closestPin = {
                componentId: component.id,
                pin: pinData.pin,
                position: pinData.position,
                distance
              };
            }
          }
        }
      }
    }
    
    // If we found a component pin, return it (prioritized)
    if (closestPin) {
      return {
        componentId: closestPin.componentId,
        pin: closestPin.pin,
        position: closestPin.position
      };
    }
    
    // Second pass: Look for N node pins only if no component pins found
    for (const component of components) {
      if (component.kind === "node") {  // Only check N nodes in second pass
        const pins = getComponentPins(component);
        
        for (const pinData of pins) {
          const distance = Math.sqrt((x - pinData.position.x) ** 2 + (y - pinData.position.y) ** 2);
          
          if (distance < 15) { // 15px radius for easier clicking
            if (!closestPin || distance < closestPin.distance) {
              closestPin = {
                componentId: component.id,
                pin: pinData.pin,
                position: pinData.position,
                distance
              };
            }
          }
        }
      }
    }
    
    return closestPin ? {
      componentId: closestPin.componentId,
      pin: closestPin.pin,
      position: closestPin.position
    } : null;
  };

  // Connect two pins by assigning them the same net (handles net merging for multiple connections)
  const connectPins = (pin1: {componentId: string, pin: string}, pin2: {componentId: string, pin: string}) => {
    const comp1 = components.find(c => c.id === pin1.componentId);
    const comp2 = components.find(c => c.id === pin2.componentId);
    
    if (!comp1 || !comp2 || !comp1.pins || !comp2.pins) return;

    const pin1Data = comp1.pins[pin1.pin];
    const pin2Data = comp2.pins[pin2.pin];
    
    if (!pin1Data || !pin2Data) return;
    
    // Log the connection attempt
    console.log("\n🔌 CONNECTING PINS:");
    console.log(`    From: ${comp1.ref || comp1.id} Pin ${pin1.pin}`);
    console.log(`    To:   ${comp2.ref || comp2.id} Pin ${pin2.pin}`);

    const net1 = pin1Data.net?.trim() || "";
    const net2 = pin2Data.net?.trim() || "";

    let finalNet: string;

    if (!net1 && !net2) {
      // Neither pin has a net - create new one
      const existingNets = new Set<string>();
      components.forEach(comp => {
        if (comp.pins) {
          Object.values(comp.pins).forEach(pinData => {
            if (pinData.net) existingNets.add(pinData.net);
          });
        }
      });

      finalNet = `NET_${existingNets.size + 1}`;
      while (existingNets.has(finalNet)) {
        finalNet = `NET_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      }
    } else if (net1 && !net2) {
      // Pin1 has net, pin2 doesn't - use pin1's net
      finalNet = net1;
    } else if (!net1 && net2) {
      // Pin2 has net, pin1 doesn't - use pin2's net
      finalNet = net2;
    } else if (net1 === net2) {
      // Both pins already on same net - nothing to do
      return;
    } else {
      // Both pins have different nets - merge them (use net1, convert all net2 to net1)
      finalNet = net1;
      
      // Find all pins using net2 and convert them to finalNet
      components.forEach(comp => {
        if (comp.pins) {
          const updatedPins = { ...comp.pins };
          let hasChanges = false;
          
          Object.entries(comp.pins).forEach(([pinName, pinData]) => {
            if (pinData.net === net2) {
              updatedPins[pinName] = { ...pinData, net: finalNet };
              hasChanges = true;
            }
          });
          
          if (hasChanges) {
            updateComponent(comp.id, { pins: updatedPins });
          }
        }
      });
    }

    // Assign the final net to both pins
    updateComponent(comp1.id, {
      pins: {
        ...comp1.pins,
        [pin1.pin]: { ...pin1Data, net: finalNet }
      }
    });

    updateComponent(comp2.id, {
      pins: {
        ...comp2.pins,
        [pin2.pin]: { ...pin2Data, net: finalNet }
      }
    });
    
    // Log the successful connection
    console.log(`    ✅ Connected to Net: "${finalNet}"`);
    
    // Count total connections on this net
    let connectionCount = 0;
    components.forEach(comp => {
      if (comp.pins) {
        Object.values(comp.pins).forEach(pinData => {
          if (pinData.net === finalNet) connectionCount++;
        });
      }
    });
    console.log(`    📊 Total pins on this net: ${connectionCount}`);
    
    // Trigger real-time simulation update
    console.log("    🔄 Updating circuit simulation...");
    setTimeout(() => {
      import("@/utils/circuit-simulation").then(({ simulateCircuitProfessional }) => {
        simulateCircuitProfessional(components);
      });
    }, 100);
    
    drawCanvas();
  };

  const disconnectPin = (componentId: string, pin: string) => {
    const component = components.find(c => c.id === componentId);
    if (!component || !component.pins || !component.pins[pin]) {
      return;
    }

    const oldNet = component.pins[pin].net;
    
    // Log the disconnection
    console.log("\n✂️ DISCONNECTING PIN:");
    console.log(`    Component: ${component.ref || component.id}`);
    console.log(`    Pin: ${pin}`);
    console.log(`    Was connected to: "${oldNet || 'NONE'}"`);

    // Create a unique net for this pin (effectively disconnecting it)
    const uniqueNet = `DISCONNECTED_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    updateComponent(componentId, {
      pins: {
        ...component.pins,
        [pin]: { ...component.pins[pin], net: uniqueNet }
      }
    });
    
    console.log(`    ❌ Pin disconnected`);
    
    // Check if old net still has connections
    if (oldNet && !oldNet.startsWith('DISCONNECTED')) {
      let remainingConnections = 0;
      components.forEach(comp => {
        if (comp.pins) {
          Object.values(comp.pins).forEach(pinData => {
            if (pinData.net === oldNet && !(comp.id === componentId && pinData === component.pins[pin])) {
              remainingConnections++;
            }
          });
        }
      });
      console.log(`    📊 Remaining connections on net "${oldNet}": ${remainingConnections}`);
    }
    
    // Trigger real-time simulation update
    console.log("    🔄 Updating circuit simulation...");
    setTimeout(() => {
      import("@/utils/circuit-simulation").then(({ simulateCircuitProfessional }) => {
        simulateCircuitProfessional(components);
      });
    }, 100);

    // Redraw to show the disconnection
    drawCanvas();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ignore clicks during panning
    if (isPanningRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x * zoom) / zoom;
    const y = (e.clientY - rect.top - pan.y * zoom) / zoom;

    // First check if we clicked on a node pin
    for (const component of components) {
      if (component.kind === 'node' && component.connectionPins) {
        for (const pin of component.connectionPins) {
          const pinX = component.position.x + pin.position.x;
          const pinY = component.position.y + pin.position.y;
          const distance = Math.sqrt((x - pinX) ** 2 + (y - pinY) ** 2);
          
          if (distance < 6) { // Pin click radius
            // Toggle pin connection
            toggleNodePin(component.id, pin.id);
            return;
          }
        }
      }
    }

    // Check if we clicked on a component
    const clickedComponent = components.find(component => {
      const dx = x - component.position.x;
      const dy = y - component.position.y;
      return Math.abs(dx) < 25 && Math.abs(dy) < 15;
    });

    setSelectedComponent(clickedComponent || null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      isPanningRef.current = true;
      lastPanPositionRef.current = { x: e.clientX, y: e.clientY };
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }
    } else if (e.button === 0) { // Left mouse button
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x * zoom) / zoom;
      const y = (e.clientY - rect.top - pan.y * zoom) / zoom;
      const currentTime = Date.now();

      // First priority: Check for pin clicks
      const clickedPin = findPinAtPosition(x, y);
      if (clickedPin) {
        // Check for Ctrl+click to disconnect pin
        if (e.ctrlKey || e.metaKey) {
          disconnectPin(clickedPin.componentId, clickedPin.pin);
          return;
        }
        
        // Normal click starts wiring
        isWiringRef.current = true;
        wireStartRef.current = clickedPin;
        wireEndPosRef.current = { x, y };
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'crosshair';
        }
        return;
      }

      // Second priority: Check for double-click component dragging
      if (isDoubleClick(x, y, currentTime)) {
        // Check for existing components
        const clickedComponent = components.find(component => {
          const dx = x - component.position.x;
          const dy = y - component.position.y;
          
          // Adjust hit area based on component type for better UX
          let hitWidth = 30;
          let hitHeight = 20;
          
          if (component.kind === "capacitor" || component.kind === "resistor") {
            hitWidth = 35; // Wider for horizontal components
            hitHeight = 25; // Taller to include value text
          } else if (component.kind === "transistor") {
            hitWidth = 25;
            hitHeight = 30;
          } else if (component.kind === "node") {
            return false; // Nodes use double right-click instead
          }
          
          return Math.abs(dx) < hitWidth && Math.abs(dy) < hitHeight;
        });

        if (clickedComponent) {
          isDraggingComponentRef.current = true;
          dragComponentIdRef.current = clickedComponent.id;
          dragOffsetRef.current = {
            x: x - clickedComponent.position.x,
            y: y - clickedComponent.position.y
          };
          if (canvasRef.current) {
            canvasRef.current.style.cursor = 'grabbing';
          }
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x * zoom) / zoom;
    const y = (e.clientY - rect.top - pan.y * zoom) / zoom;

    if (isPanningRef.current && e.buttons === 4) { // Middle button is pressed
      const deltaX = e.clientX - lastPanPositionRef.current.x;
      const deltaY = e.clientY - lastPanPositionRef.current.y;
      
      setPan({
        x: pan.x + deltaX / zoom,
        y: pan.y + deltaY / zoom
      });
      
      lastPanPositionRef.current = { x: e.clientX, y: e.clientY };
    } else if (isWiringRef.current) {
      // Update wire end position during dragging
      wireEndPosRef.current = { x, y };
      drawCanvas(); // Redraw to show wire being dragged
    } else if (isDraggingComponentRef.current && dragComponentIdRef.current) {
      // Handle component dragging
      const newX = x - dragOffsetRef.current.x;
      const newY = y - dragOffsetRef.current.y;

      // Snap to grid for smoother movement
      const gridSize = 10;
      const snappedX = Math.round(newX / gridSize) * gridSize;
      const snappedY = Math.round(newY / gridSize) * gridSize;

      updateComponent(dragComponentIdRef.current, {
        position: { x: snappedX, y: snappedY }
      });
      
      drawCanvas(); // Redraw immediately for smooth dragging
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) { // Middle mouse button
      isPanningRef.current = false;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'crosshair';
      }
    } else if (e.button === 0) { // Left mouse button
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x * zoom) / zoom;
      const y = (e.clientY - rect.top - pan.y * zoom) / zoom;

      // Handle wire completion
      if (isWiringRef.current && wireStartRef.current) {
        const targetPin = findPinAtPosition(x, y);
        
        if (targetPin && targetPin.componentId !== wireStartRef.current.componentId) {
          // Connect the pins
          connectPins(
            { componentId: wireStartRef.current.componentId, pin: wireStartRef.current.pin },
            { componentId: targetPin.componentId, pin: targetPin.pin }
          );
        }
        
        // Reset wiring state
        isWiringRef.current = false;
        wireStartRef.current = null;
        drawCanvas(); // Redraw to remove wire preview
      }

      // Handle component dragging completion
      isDraggingComponentRef.current = false;
      dragComponentIdRef.current = null;
      
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'crosshair';
      }
    } else if (e.button === 2) { // Right mouse button
      // Handle node dragging completion (started by right-click)
      if (isDraggingComponentRef.current) {
        isDraggingComponentRef.current = false;
        dragComponentIdRef.current = null;
        
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'crosshair';
        }
      }
    }
  };

  const handleMouseLeave = () => {
    isPanningRef.current = false;
    isDraggingComponentRef.current = false;
    dragComponentIdRef.current = null;
    
    // Cancel wiring if in progress
    if (isWiringRef.current) {
      isWiringRef.current = false;
      wireStartRef.current = null;
      drawCanvas(); // Redraw to remove wire preview
    }
    
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'crosshair';
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent default context menu
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x * zoom) / zoom;
    const y = (e.clientY - rect.top - pan.y * zoom) / zoom;

    // Single right-click on nodes to start dragging
    const clickedNode = components.find(component => {
      if (component.kind !== "node") return false; // Only nodes
      
      const dx = x - component.position.x;
      const dy = y - component.position.y;
      
      const hitWidth = 8; // Smaller hit area for 70% smaller nodes
      const hitHeight = 8;
      
      return Math.abs(dx) < hitWidth && Math.abs(dy) < hitHeight;
    });

    if (clickedNode) {
      isDraggingComponentRef.current = true;
      dragComponentIdRef.current = clickedNode.id;
      dragOffsetRef.current = {
        x: x - clickedNode.position.x,
        y: y - clickedNode.position.y
      };
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x * zoom) / zoom;
      const y = (e.clientY - rect.top - pan.y * zoom) / zoom;

      // Snap to grid
      const gridSize = 20;
      const snappedX = Math.round(x / gridSize) * gridSize;
      const snappedY = Math.round(y / gridSize) * gridSize;

      addComponent(data.type as ComponentType, { x: snappedX, y: snappedY });
    } catch (error) {
      console.error("Error parsing drop data:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleZoomIn = () => setZoom(Math.min(zoom * 1.2, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom / 1.2, 0.3));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 relative bg-background grid-pattern overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      data-testid="circuit-canvas"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        data-testid="canvas-main"
      />
      
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomIn}
          data-testid="button-zoom-in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomOut}
          data-testid="button-zoom-out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleResetZoom}
          data-testid="button-reset-zoom"
        >
          <Home className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
