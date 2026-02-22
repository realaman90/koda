import 'server-only';

import { randomUUID } from 'crypto';
import { getDatabaseAsync } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';

export async function logAuditEvent(params: {
  workspaceId: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDatabaseAsync();
  await db.insert(auditLogs).values({
    id: randomUUID(),
    workspaceId: params.workspaceId,
    actorUserId: params.actorUserId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    createdAt: new Date(),
  });
}
