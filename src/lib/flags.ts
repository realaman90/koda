export function isAuthV1Enabled() {
  return process.env.AUTH_V1 !== 'false';
}

export function isWorkspacesV1Enabled() {
  return process.env.WORKSPACES_V1 !== 'false';
}

export function isCollabSharingV1Enabled() {
  return process.env.COLLAB_SHARING_V1 !== 'false';
}
