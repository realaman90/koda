/**
 * Animation DB Queries
 *
 * Query functions for animation_projects and animation_versions tables.
 * All functions are async and handle missing DB gracefully (non-critical).
 */

import 'server-only';

import { eq, desc } from 'drizzle-orm';
import { getDatabaseAsync } from './index';
import {
  animationProjects,
  animationVersions,
  type NewAnimationProject,
  type NewAnimationVersion,
} from './schema';

/**
 * Upsert an animation project (create or update).
 */
export async function upsertProject(
  data: NewAnimationProject
): Promise<void> {
  const db = await getDatabaseAsync();
  // SQLite: INSERT OR REPLACE
  await db
    .insert(animationProjects)
    .values(data)
    .onConflictDoUpdate({
      target: animationProjects.id,
      set: {
        canvasId: data.canvasId,
        engine: data.engine,
        plan: data.plan,
        activeVersionId: data.activeVersionId,
        sandboxId: data.sandboxId,
        updatedAt: data.updatedAt,
      },
    });
}

/**
 * Get an animation project by nodeId.
 */
export async function getProject(nodeId: string) {
  const db = await getDatabaseAsync();
  const rows = await db
    .select()
    .from(animationProjects)
    .where(eq(animationProjects.id, nodeId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Update the sandbox ID for a project.
 */
export async function updateProjectSandboxId(
  nodeId: string,
  sandboxId: string
): Promise<void> {
  const db = await getDatabaseAsync();
  await db
    .update(animationProjects)
    .set({ sandboxId, updatedAt: new Date() })
    .where(eq(animationProjects.id, nodeId));
}

/**
 * Add a new animation version.
 */
export async function addVersion(
  data: NewAnimationVersion
): Promise<void> {
  const db = await getDatabaseAsync();
  await db.insert(animationVersions).values(data);
}

/**
 * Get all versions for a project, newest first.
 */
export async function getVersions(projectId: string) {
  const db = await getDatabaseAsync();
  return db
    .select()
    .from(animationVersions)
    .where(eq(animationVersions.projectId, projectId))
    .orderBy(desc(animationVersions.createdAt));
}

/**
 * Get a specific version by ID.
 */
export async function getVersion(versionId: string) {
  const db = await getDatabaseAsync();
  const rows = await db
    .select()
    .from(animationVersions)
    .where(eq(animationVersions.id, versionId))
    .limit(1);
  return rows[0] ?? null;
}
