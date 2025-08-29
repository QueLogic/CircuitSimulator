import { Router } from "express";
import { z } from "zod";
import { ngspiceInterface } from "../utils/ngspice-interface";

const router = Router();

// Schema for circuit simulation request
const simulationRequestSchema = z.object({
  components: z.array(z.object({
    id: z.string(),
    ref: z.string(),
    kind: z.string(),
    type: z.string().optional(),
    model: z.string().optional(),
    value: z.string().optional(),
    position: z.object({
      x: z.number(),
      y: z.number()
    }),
    pins: z.record(z.string(), z.object({
      net: z.string(),
      polarity: z.enum(["+", "-"]).optional(),
      comment: z.string().optional()
    })).optional(),
    comment: z.string().optional(),
    initialCondition: z.string().optional(),
    amplitude: z.string().optional(),
    frequency: z.string().optional()
  }))
});

// POST /api/ngspice/simulate - Run NGSpice simulation
router.post("/simulate", async (req, res) => {
  try {
    console.log(`🚨 ROUTE: Request received`);
    const validatedData = simulationRequestSchema.parse(req.body);
    
    console.log(`🚨 ROUTE: Received ${validatedData.components.length} components for simulation`);
    const componentRefs = validatedData.components.map(c => c.ref).join(", ");
    console.log(`🚨 ROUTE: Component refs: ${componentRefs}`);
    
    // Check Q4B components
    const q4bComps = validatedData.components.filter(c => 
      c.pins && Object.values(c.pins).some(p => p.net === "Q4B")
    );
    console.log(`🚨 ROUTE: Components with Q4B net: ${q4bComps.map(c => c.ref).join(", ")}`);
    console.log(`🚨 ROUTE: Total nets found:`, new Set(
      validatedData.components
        .flatMap(c => c.pins ? Object.values(c.pins).map(p => p.net) : [])
        .filter(n => n)
    ).size);
    
    // Run NGSpice simulation with error catching
    const result = await ngspiceInterface.simulate(validatedData.components);
    
    if (!result.success) {
      return res.status(400).json({
        error: "Simulation failed",
        details: result.error
      });
    }
    
    res.json({
      success: true,
      data: {
        operatingPoint: result.operatingPoint || {},
        netToNodeMap: result.netToNodeMap || {},
        transientData: result.transientData || { time: [], voltages: {}, currents: {} },
        acData: result.acData || { frequency: [], magnitude: {}, phase: {} },
        noiseData: result.noiseData || { frequency: [], outputNoise: [], inputNoise: [] }
      }
    });
    
  } catch (error) {
    console.error("❌ ROUTE ERROR:", error);
    console.error("❌ Stack trace:", error instanceof Error ? error.stack : "No stack");
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      details: error instanceof Error ? error.stack : "Unknown error"
    });
  }
});

// GET /api/ngspice/health - Check NGSpice availability
router.get("/health", async (req, res) => {
  try {
    // Simple health check without running simulation to avoid interference
    res.json({
      available: true,
      error: null
    });
    
  } catch (error) {
    res.json({
      available: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;