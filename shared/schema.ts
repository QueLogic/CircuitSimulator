import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const circuits = pgTable("circuits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCircuitSchema = createInsertSchema(circuits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCircuit = z.infer<typeof insertCircuitSchema>;
export type Circuit = typeof circuits.$inferSelect;

// Circuit component schemas
export const componentSchema = z.object({
  ref: z.string(),
  kind: z.enum(['transistor', 'resistor', 'capacitor', 'led', 'battery', 'ic', 'node', 'oscilloscope']),
  model: z.string().optional(),
  value: z.string().optional(),
  type: z.string().optional(),
  pins: z.record(z.string(), z.object({
    net: z.string(),
    polarity: z.enum(['+', '-']).optional(),
    comment: z.string().optional()
  })),
  comment: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number()
  })
});

export const netSchema = z.object({
  name: z.string(),
  nodes: z.array(z.object({
    ref: z.string(),
    pin: z.string(),
    polarity: z.enum(['+', '-']).optional(),
    note: z.string().optional()
  }))
});

export const billOfMaterialsSchema = z.object({
  ref: z.string(),
  type: z.string(),
  model: z.string(),
  value: z.string().optional(),
  pinout: z.string().optional()
});

export const circuitDataSchema = z.object({
  design: z.string(),
  version: z.string(),
  notes: z.array(z.string()).optional(),
  billOfMaterials: z.array(billOfMaterialsSchema),
  components: z.array(componentSchema),
  nets: z.array(netSchema)
});

export type Component = z.infer<typeof componentSchema>;
export type Net = z.infer<typeof netSchema>;
export type BillOfMaterials = z.infer<typeof billOfMaterialsSchema>;
export type CircuitData = z.infer<typeof circuitDataSchema>;
