import { can, type WorkspaceAction, type WorkspaceRole } from '@/lib/permissions/matrix';

const roles: WorkspaceRole[] = ['owner', 'admin', 'editor', 'viewer'];
const actions: WorkspaceAction[] = [
  'create',
  'edit',
  'delete',
  'share',
  'export',
  'invite',
  'role-change',
  'ownership-transfer',
];

const expected: Record<WorkspaceRole, WorkspaceAction[]> = {
  owner: actions,
  admin: ['create', 'edit', 'delete', 'share', 'export', 'invite'],
  editor: ['create', 'edit', 'share', 'export'],
  viewer: ['export'],
};

for (const role of roles) {
  for (const action of actions) {
    const allowed = can(role, action);
    const shouldAllow = expected[role].includes(action);

    if (allowed !== shouldAllow) {
      throw new Error(`Permission mismatch for role=${role} action=${action}`);
    }
  }
}

if (can('viewer', 'edit')) {
  throw new Error('Viewer write permission should be denied (403)');
}

console.log('✅ Permission matrix validation passed');
