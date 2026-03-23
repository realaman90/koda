import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import { getDatabaseAsync } from './index';
import {
  auditLogs,
  projects,
  workspaceInvites,
  workspaceMembers,
  workspaces,
  type NewAuditLog,
  type NewProject,
  type NewWorkspace,
  type NewWorkspaceInvite,
  type NewWorkspaceMember,
} from './schema';

export async function createWorkspace(input: NewWorkspace) {
  const db = await getDatabaseAsync();
  await db.insert(workspaces).values(input);
  return db.select().from(workspaces).where(eq(workspaces.id, input.id));
}

export async function addWorkspaceMember(input: NewWorkspaceMember) {
  const db = await getDatabaseAsync();
  await db.insert(workspaceMembers).values(input);
  return db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.userId)
      )
    );
}

export async function createWorkspaceInvite(input: NewWorkspaceInvite) {
  const db = await getDatabaseAsync();
  await db.insert(workspaceInvites).values(input);
  return db.select().from(workspaceInvites).where(eq(workspaceInvites.id, input.id));
}

export async function listPendingWorkspaceInvites(workspaceId: string, email?: string) {
  const db = await getDatabaseAsync();

  if (email) {
    return db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, workspaceId),
          eq(workspaceInvites.email, email),
          eq(workspaceInvites.status, 'pending')
        )
      )
      .orderBy(desc(workspaceInvites.createdAt));
  }

  return db
    .select()
    .from(workspaceInvites)
    .where(and(eq(workspaceInvites.workspaceId, workspaceId), eq(workspaceInvites.status, 'pending')))
    .orderBy(desc(workspaceInvites.createdAt));
}

export async function createProject(input: NewProject) {
  const db = await getDatabaseAsync();
  await db.insert(projects).values(input);
  return db.select().from(projects).where(eq(projects.id, input.id));
}

export async function createAuditLog(input: NewAuditLog) {
  const db = await getDatabaseAsync();
  await db.insert(auditLogs).values(input);
  return db.select().from(auditLogs).where(eq(auditLogs.id, input.id));
}
