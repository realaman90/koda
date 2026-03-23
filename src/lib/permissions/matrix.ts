export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type WorkspaceAction =
  | 'create'
  | 'edit'
  | 'delete'
  | 'share'
  | 'export'
  | 'invite'
  | 'role-change'
  | 'ownership-transfer';

const PERMISSION_MATRIX: Record<WorkspaceRole, WorkspaceAction[]> = {
  owner: ['create', 'edit', 'delete', 'share', 'export', 'invite', 'role-change', 'ownership-transfer'],
  admin: ['create', 'edit', 'delete', 'share', 'export', 'invite'],
  editor: ['create', 'edit', 'share', 'export'],
  viewer: ['export'],
};

export function can(role: WorkspaceRole, action: WorkspaceAction) {
  return PERMISSION_MATRIX[role]?.includes(action) ?? false;
}

export function assertCan(role: WorkspaceRole, action: WorkspaceAction) {
  if (!can(role, action)) {
    const error = new Error(`Forbidden: role '${role}' cannot perform '${action}'`);
    error.name = 'PermissionDenied';
    throw error;
  }
}
