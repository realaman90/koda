import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Users synced from Clerk webhooks.
 */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    clerkUserId: text('clerk_user_id').notNull(),
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    imageUrl: text('image_url'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    clerkUserIdUnique: uniqueIndex('users_clerk_user_id_unique').on(table.clerkUserId),
    clerkUserIdIdx: index('idx_users_clerk_user_id').on(table.clerkUserId),
    emailIdx: index('idx_users_email').on(table.email),
  })
);

export type NewUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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
  // Optional thumbnail (legacy)
  thumbnail: text('thumbnail'),
  // Canonical preview lifecycle metadata
  thumbnailUrl: text('thumbnail_url'),
  thumbnailStatus: text('thumbnail_status').notNull().default('empty'),
  thumbnailUpdatedAt: integer('thumbnail_updated_at', { mode: 'timestamp_ms' }),
  thumbnailVersion: text('thumbnail_version'),
  thumbnailErrorCode: text('thumbnail_error_code'),
  // Timestamps stored as Unix milliseconds
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

// Type for inserting a new canvas
export type NewCanvas = typeof canvases.$inferInsert;

// Type for selecting a canvas
export type Canvas = typeof canvases.$inferSelect;

// ============================================
// ANIMATION TABLES
// ============================================

/**
 * Animation projects — one row per animation node.
 * Tracks the active sandbox, engine, plan, and current version.
 */
export const animationProjects = sqliteTable('animation_projects', {
  id: text('id').primaryKey(), // nodeId
  canvasId: text('canvas_id'),
  engine: text('engine'), // 'remotion' | 'theatre'
  plan: text('plan'), // JSON blob of AnimationPlan
  activeVersionId: text('active_version_id'),
  sandboxId: text('sandbox_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export type NewAnimationProject = typeof animationProjects.$inferInsert;
export type AnimationProject = typeof animationProjects.$inferSelect;

/**
 * Animation versions — one row per rendered version.
 * Tracks video URL, snapshot key, prompt, and metadata.
 */
export const animationVersions = sqliteTable('animation_versions', {
  id: text('id').primaryKey(), // versionId (e.g. v1738000000000)
  projectId: text('project_id').notNull(), // FK → animation_projects.id
  videoUrl: text('video_url'),
  snapshotKey: text('snapshot_key'), // R2/local key for restoring code
  thumbnailUrl: text('thumbnail_url'),
  prompt: text('prompt'),
  duration: integer('duration'), // seconds
  sizeBytes: integer('size_bytes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export type NewAnimationVersion = typeof animationVersions.$inferInsert;
export type AnimationVersion = typeof animationVersions.$inferSelect;
