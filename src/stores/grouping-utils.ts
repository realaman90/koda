export interface GroupDelta {
  x: number;
  y: number;
}

/**
 * Remap explicit group memberships during clone/paste flows.
 * Any child ID that was not cloned is dropped to avoid stale ownership links.
 */
export function remapChildNodeIds(
  childNodeIds: string[] | undefined,
  idMap: Map<string, string>
): string[] | undefined {
  if (!childNodeIds) return undefined;
  return childNodeIds
    .map((childId) => idMap.get(childId))
    .filter((childId): childId is string => !!childId);
}

/**
 * Resolve movement delta for a node by walking explicit group ownership upward
 * until a moving ancestor group is found.
 */
export function resolveInheritedGroupDelta(
  nodeId: string,
  explicitOwner: Map<string, string>,
  groupDeltaById: Map<string, GroupDelta>,
  cache?: Map<string, GroupDelta | null>
): GroupDelta | null {
  const existing = cache?.get(nodeId);
  if (existing !== undefined) return existing;

  const visited = new Set<string>();
  let ownerId = explicitOwner.get(nodeId);
  while (ownerId && !visited.has(ownerId)) {
    visited.add(ownerId);

    const ownerDelta = groupDeltaById.get(ownerId);
    if (ownerDelta) {
      cache?.set(nodeId, ownerDelta);
      return ownerDelta;
    }

    ownerId = explicitOwner.get(ownerId);
  }

  cache?.set(nodeId, null);
  return null;
}
