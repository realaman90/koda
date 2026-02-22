# Workspace API Permission Matrix (Issue #19)

## Roles

- `owner`
- `admin`
- `editor`
- `viewer`

## Action matrix

| Action | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|
| create | ✅ | ✅ | ✅ | ❌ |
| edit | ✅ | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ❌ | ❌ |
| share | ✅ | ✅ | ✅ | ❌ |
| export | ✅ | ✅ | ✅ | ✅ |
| invite | ✅ | ✅ | ❌ | ❌ |
| role-change | ✅ | ❌ | ❌ | ❌ |
| ownership-transfer | ✅ | ❌ | ❌ | ❌ |

## Enforcement notes

- Workspace membership is always resolved on the server (`requireWorkspaceActor`).
- Viewer mutation attempts return `403`.
- Missing workspace membership or cross-workspace probing returns `404`.
- Sensitive operations emit audit logs (`invite.create`, `member.role_change`, `canvas.*`).
- APIs never trust client-submitted owner identifiers for authorization.
