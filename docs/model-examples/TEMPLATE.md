---
modelKey: your-model-key
modelId: provider/model-id
provider: fal
category: image # image | video
status: draft # draft | reviewed | ready
examples:
  - id: your-model-key-001
    kind: image # image | video
    source: official-docs # official-docs | curated | user-generated
    sourceUrl: https://fal.ai/models/provider/model-id
    media: https://example.com/path/to/media.png
    inputMedia: https://example.com/path/to/input.png # optional
    prompt: |
      Prompt used for this example.
    notes: Optional context
---

Free-form notes below are optional.
