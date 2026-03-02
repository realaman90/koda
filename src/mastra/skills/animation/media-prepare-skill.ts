import type { AnimationSkill } from './types';

type MediaInput = {
  path: string;
  type: 'image' | 'video';
  description?: string;
  name?: string;
};

export const mediaPrepareSkill: AnimationSkill = {
  id: 'media_prepare',
  run: async (input) => {
    const list = (input.payload?.mediaFiles as MediaInput[] | undefined) || [];
    const byPath = new Map<string, MediaInput>();

    for (const item of list) {
      if (!item.path) continue;
      const existing = byPath.get(item.path);
      if (!existing) {
        byPath.set(item.path, item);
        continue;
      }

      if (!existing.description && item.description) {
        byPath.set(item.path, item);
      }
    }

    const mediaFiles = Array.from(byPath.values()).map((item) => ({
      path: item.path,
      type: item.type,
      description: item.description || item.name || item.path.split('/').pop() || item.path,
    }));

    return {
      ok: true,
      summary: `Prepared ${mediaFiles.length} media file(s) for code generation`,
      artifacts: { mediaFiles },
      updates: { mediaCount: mediaFiles.length },
    };
  },
};
