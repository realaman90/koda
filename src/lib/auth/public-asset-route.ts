const PUBLIC_ASSET_METHODS = new Set(['GET', 'HEAD']);

const LOCAL_ASSET_PATH_RE = /^\/api\/assets\/(?!upload$|presign$|key$)[^/]+$/;

export function isPublicAssetReadRequest(pathname: string, method: string): boolean {
  if (!PUBLIC_ASSET_METHODS.has(method.toUpperCase())) {
    return false;
  }

  return pathname.startsWith('/api/assets/key/') || LOCAL_ASSET_PATH_RE.test(pathname);
}
