import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Canvases table - stores canvas metadata and JSON blobs for nodes/edges
 * 
 * Using JSON blob storage for nodes/edges:
 * - Simpler schema, no migrations when node types change
 * - Single query loads entire canvas
 * - Direct compatibility with localStorage format
 */
export const canvases = sqliteTable('canvases', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // JSON blobs for nodes and edges (stored as text)
  nodes: text('nodes'),
  edges: text('edges'),
  // Optional thumbnail (base64 or URL)
  thumbnail: text('thumbnail'),
  // Timestamps stored as Unix milliseconds
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

// Type for inserting a new canvas
export type NewCanvas = typeof canvases.$inferInsert;

// Type for selecting a canvas
export type Canvas = typeof canvases.$inferSelect;
