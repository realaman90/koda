import { isRuntimeFeatureEnabled } from '@/lib/distribution/capabilities';

export function isAuthV1Enabled() {
  return isRuntimeFeatureEnabled('authV1', 'AUTH_V1');
}

export function isWorkspacesV1Enabled() {
  return isRuntimeFeatureEnabled('workspacesV1', 'WORKSPACES_V1');
}

export function isCollabSharingV1Enabled() {
  return isRuntimeFeatureEnabled('collabSharingV1', 'COLLAB_SHARING_V1');
}
