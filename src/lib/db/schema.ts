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

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug'),
    type: text('type').notNull().default('personal'), // personal | team
    ownerUserId: text('owner_user_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex('workspaces_slug_unique').on(table.slug),
    ownerIdx: index('idx_workspaces_owner').on(table.ownerUserId),
    typeIdx: index('idx_workspaces_type').on(table.type),
  })
);

export type NewWorkspace = typeof workspaces.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;

export const workspaceMembers = sqliteTable(
  'workspace_members',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull().default('viewer'), // owner | admin | editor | viewer
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    workspaceUserUnique: uniqueIndex('workspace_members_workspace_user_unique').on(
      table.workspaceId,
      table.userId
    ),
    workspaceRoleIdx: index('idx_workspace_members_workspace_role').on(table.workspaceId, table.role),
    userIdx: index('idx_workspace_members_user').on(table.userId),
  })
);

export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;

export const workspaceInvites = sqliteTable(
  'workspace_invites',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull().default('viewer'),
    status: text('status').notNull().default('pending'), // pending | accepted | declined | revoked | expired
    token: text('token').notNull(),
    invitedByUserId: text('invited_by_user_id').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    tokenUnique: uniqueIndex('workspace_invites_token_unique').on(table.token),
    workspaceEmailStatusIdx: index('idx_workspace_invites_workspace_email_status').on(
      table.workspaceId,
      table.email,
      table.status
    ),
    workspaceStatusIdx: index('idx_workspace_invites_workspace_status').on(table.workspaceId, table.status),
    emailStatusIdx: index('idx_workspace_invites_email_status').on(table.email, table.status),
  })
);

export type NewWorkspaceInvite = typeof workspaceInvites.$inferInsert;
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id'),
    ownerUserId: text('owner_user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    workspaceIdx: index('idx_projects_workspace').on(table.workspaceId),
    ownerIdx: index('idx_projects_owner').on(table.ownerUserId),
  })
);

export type NewProject = typeof projects.$inferInsert;
export type Project = typeof projects.$inferSelect;

/**
 * Canvases table - stores canvas metadata and JSON blobs for nodes/edges
 *
 * Using JSON blob storage for nodes/edges:
 * - Simpler schema, no migrations when node types change
 * - Single query loads entire canvas
 * - Direct compatibility with localStorage format
 */
export const canvases = sqliteTable(
  'canvases',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id'),
    ownerUserId: text('owner_user_id'),
    projectId: text('project_id'),
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
  },
  (table) => ({
    workspaceIdx: index('idx_canvases_workspace').on(table.workspaceId),
    workspaceUpdatedIdx: index('idx_canvases_workspace_updated').on(table.workspaceId, table.updatedAt),
    ownerIdx: index('idx_canvases_owner').on(table.ownerUserId),
    projectIdx: index('idx_canvases_project').on(table.projectId),
  })
);

// Type for inserting a new canvas
export type NewCanvas = typeof canvases.$inferInsert;

// Type for selecting a canvas
export type Canvas = typeof canvases.$inferSelect;

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    metadata: text('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    workspaceCreatedIdx: index('idx_audit_logs_workspace_created').on(table.workspaceId, table.createdAt),
    actorIdx: index('idx_audit_logs_actor').on(table.actorUserId),
    targetIdx: index('idx_audit_logs_target').on(table.targetType, table.targetId),
    actionIdx: index('idx_audit_logs_action').on(table.action),
  })
);

export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;

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
