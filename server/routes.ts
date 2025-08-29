import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCircuitSchema } from "@shared/schema";
import ngspiceRouter from "./routes/ngspice-simulation";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all circuits
  app.get("/api/circuits", async (_req, res) => {
    try {
      const circuits = await storage.getAllCircuits();
      res.json(circuits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch circuits" });
    }
  });

  // Get circuit by ID
  app.get("/api/circuits/:id", async (req, res) => {
    try {
      const circuit = await storage.getCircuit(req.params.id);
      if (!circuit) {
        return res.status(404).json({ message: "Circuit not found" });
      }
      res.json(circuit);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch circuit" });
    }
  });

  // Create new circuit
  app.post("/api/circuits", async (req, res) => {
    try {
      const validatedData = insertCircuitSchema.parse(req.body);
      const circuit = await storage.createCircuit(validatedData);
      res.status(201).json(circuit);
    } catch (error) {
      res.status(400).json({ message: "Invalid circuit data" });
    }
  });

  // Update circuit
  app.put("/api/circuits/:id", async (req, res) => {
    try {
      const validatedData = insertCircuitSchema.parse(req.body);
      const circuit = await storage.updateCircuit(req.params.id, validatedData);
      if (!circuit) {
        return res.status(404).json({ message: "Circuit not found" });
      }
      res.json(circuit);
    } catch (error) {
      res.status(400).json({ message: "Invalid circuit data" });
    }
  });

  // Delete circuit
  app.delete("/api/circuits/:id", async (req, res) => {
    try {
      const success = await storage.deleteCircuit(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Circuit not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete circuit" });
    }
  });

  // Register NGSpice simulation routes
  app.use("/api/ngspice", ngspiceRouter);

  const httpServer = createServer(app);
  return httpServer;
}
