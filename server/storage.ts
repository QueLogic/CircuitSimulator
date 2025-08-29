import { type Circuit, type InsertCircuit } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getAllCircuits(): Promise<Circuit[]>;
  getCircuit(id: string): Promise<Circuit | undefined>;
  createCircuit(circuit: InsertCircuit): Promise<Circuit>;
  updateCircuit(id: string, updates: InsertCircuit): Promise<Circuit | undefined>;
  deleteCircuit(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private circuits: Map<string, Circuit>;

  constructor() {
    this.circuits = new Map();
  }

  async getAllCircuits(): Promise<Circuit[]> {
    return Array.from(this.circuits.values());
  }

  async getCircuit(id: string): Promise<Circuit | undefined> {
    return this.circuits.get(id);
  }

  async createCircuit(insertCircuit: InsertCircuit): Promise<Circuit> {
    const id = randomUUID();
    const circuit: Circuit = { 
      ...insertCircuit, 
      id,
      description: insertCircuit.description || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.circuits.set(id, circuit);
    return circuit;
  }

  async updateCircuit(id: string, updates: InsertCircuit): Promise<Circuit | undefined> {
    const existing = this.circuits.get(id);
    if (!existing) return undefined;
    
    const updated: Circuit = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.circuits.set(id, updated);
    return updated;
  }

  async deleteCircuit(id: string): Promise<boolean> {
    return this.circuits.delete(id);
  }
}

export const storage = new MemStorage();
