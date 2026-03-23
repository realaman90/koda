# Model Examples Library

This folder is the source of truth for per-model example media and prompts.

## Goal

- Add an `i` info button for each model in Settings.
- Show real examples: media preview + prompt + source.
- Keep examples editable in Markdown.
- Later sync media to DEV/PROD R2 buckets for stable hosting.

## Structure

- `TEMPLATE.md`: schema reference.
- `chunks/`: rollout batches so work stays manageable.
- `models/<model-key>.md`: one file per model.

## Editing Rules

- Keep `modelKey` aligned with `src/lib/types.ts` model keys.
- Prefer `source: official-docs` first, then add internal curated examples.
- Use `status: draft` until prompt/media are reviewed.
- Use stable media URLs whenever possible.

## Next Steps

1. Fill chunk files in order.
2. Add validator + uploader script (`sync-model-examples`) to push media to R2 (`dev` / `prod`).
3. Generate runtime manifest JSON for Settings UI.
