# Koda - Agent Context

> Quick reference for AI agents working on this codebase.

## What This Is

A **node-based visual workflow editor** for AI content generation. Users drag nodes onto an infinite canvas, connect them with edges, and generate images/videos/audio using AI.

**Think:** Figma meets ComfyUI for AI content creation.

---

## Tech Stack (Key)

| Tech | Purpose |
|------|---------|
| Next.js 16 (App Router) | Framework |
| @xyflow/react | Canvas/node graph |
| Zustand | State management |
| Tailwind + shadcn/ui | Styling |
| Fal.ai | AI generation API |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── canvas/page.tsx       # Canvas workspace
│   └── api/
│       ├── generate/         # Image generation
│       ├── generate-video/   # Video generation
│       └── generate-audio/   # Audio generation
├── components/
│   ├── canvas/
│   │   ├── Canvas.tsx        # Main React Flow wrapper
│   │   ├── NodeToolbar.tsx   # Left sidebar (add nodes, tools)
│   │   ├── nodes/            # All node components
│   │   └── edges/            # Edge components
│   ├── dashboard/            # Dashboard UI
│   └── ui/                   # shadcn components
├── stores/
│   └── canvas-store.ts       # Main state (nodes, edges, history)
└── lib/
    ├── types.ts              # All TypeScript types
    └── model-adapters.ts     # Fal.ai model adapters
```

---

## Node Types (11 Total)

### Generator Nodes

| Node | File | Purpose | Inputs → Outputs |
|------|------|---------|------------------|
| **ImageGenerator** | `ImageGeneratorNode.tsx` | AI images | text, refs → image |
| **VideoGenerator** | `VideoGeneratorNode.tsx` | AI videos | text, frames → video |
| **MusicGenerator** | `MusicGeneratorNode.tsx` | AI music | prompt → audio |
| **Speech** | `SpeechNode.tsx` | Text-to-speech | text → audio |
| **VideoAudio** | `VideoAudioNode.tsx` | Audio for video | video, prompt → video+audio |

### Input Nodes

| Node | File | Purpose |
|------|------|---------|
| **Text** | `TextNode.tsx` | Text prompt input |
| **Media** | `MediaNode.tsx` | Image/video upload |

### Utility Nodes

| Node | File | Purpose |
|------|------|---------|
| **StickyNote** | `StickyNoteNode.tsx` | Notes (6 colors) |
| **Sticker** | `StickerNode.tsx` | Emoji decorations |
| **Group** | `GroupNode.tsx` | Visual grouping |
| **Storyboard** | `StoryboardNode.tsx` | AI storyboard generator |

---

## UI Components

### Canvas Layout

```
┌─────────────────────────────────────────────────────┐
│                      TOP BAR                         │
├────┬────────────────────────────────────────────────┤
│    │                                                │
│ T  │                                                │
│ O  │              CANVAS (React Flow)               │
│ O  │                                                │
│ L  │          [Nodes connected by edges]            │
│ B  │                                                │
│ A  │                                    ┌─────────┐ │
│ R  │                                    │ Zoom    │ │
└────┴────────────────────────────────────┴─────────┴─┘
```

### Node Toolbar (Left)

- **+** Add node (dropdown: Image Gen, Video Gen, Text, Media, Audio nodes, Utilities)
- **↖** Select tool
- **✋** Pan tool
- **✂** Scissors (cut edges)
- **↺↻** Undo/Redo
- **⚙** Shortcuts
- **🧩** Plugins

### Node Anatomy

```
┌──────────────────────────────┐
│  🖼️✨ Image Generator 1       │  ← Title (editable)
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ Prompt textarea...     │  │  ← Content area
│  └────────────────────────┘  │
├──────────────────────────────┤
│  [Model▼][Ratio▼][Count][▶]  │  ← Bottom toolbar (hover/select)
└──────────────────────────────┘
  ◯ text     (left handles)    output ◯ (right handle)
  ◯ reference
```

---

## State (canvas-store.ts)

```typescript
// Key state
nodes: AppNode[]           // All canvas nodes
edges: AppEdge[]           // Connections between nodes
selectedNodeIds: string[]  // Currently selected
history: HistorySnapshot[] // Undo stack (50 max)
activeTool: 'select' | 'pan' | 'scissors'

// Key actions
addNode(node)              // Create node
updateNodeData(id, data)   // Update node (triggers history)
deleteNode(id)             // Delete node + connected edges
onConnect(connection)      // Create edge
undo() / redo()            // History navigation
runAll()                   // Batch generate all ImageGenerator nodes
getConnectedInputs(nodeId) // Get connected text/image from edges
```

---

## AI Models

### Image (6 models)

| Model | Key Feature |
|-------|-------------|
| `flux-schnell` | Fast, text-only |
| `flux-pro` | High quality, supports refs |
| `nanobanana-pro` | Up to 14 references |
| `recraft-v3` | Style modes (realistic/digital/vector) |
| `ideogram-v3` | Best for text/logos |
| `sd-3.5` | CFG, steps, strength control |

### Video (10 models)

| Model | Input Type |
|-------|------------|
| `veo-3` | Text only |
| `veo-3.1-i2v` | Single image |
| `veo-3.1-flf` | First + last frame |
| `kling-2.6-t2v/i2v` | Text or image |
| `luma-ray2` | Single image |
| `minimax-video` | Single image |
| `runway-gen3` | Single image |

### Audio (3 models)

| Model | Purpose |
|-------|---------|
| `ace-step` | Music generation |
| `elevenlabs-tts` | Text-to-speech |
| `mmaudio-v2` | Video audio sync |

---

## API Routes

```typescript
// Image
POST /api/generate
{ prompt, model, aspectRatio, imageCount, referenceUrl?, ... }
→ { imageUrl, imageUrls[] }

// Video
POST /api/generate-video
{ prompt, model, duration, firstFrameUrl?, lastFrameUrl?, ... }
→ { videoUrl }

// Audio
POST /api/generate-audio
{ type: 'music'|'speech'|'video-audio', ...params }
→ { audioUrl }
```

---

## Design Tokens

| Token | Dark Value |
|-------|------------|
| `--background` | `#09090b` |
| `--foreground` | `#fafafa` |
| `--card` | `#18181b` |
| `--border` | `rgba(255,255,255,0.1)` |
| `--node-border-selected` | `#6366f1` (indigo) |

### Node Colors

| Node Type | Color |
|-----------|-------|
| Image | Teal `#14b8a6` |
| Video | Purple `#a855f7` |
| Text | Amber `#fcd34d` |
| Music | Orange `#fb923c` |
| Speech | Cyan `#22d3ee` |

---

## Key Patterns

### Adding a New Node Type

1. Create component in `src/components/canvas/nodes/`
2. Export from `src/components/canvas/nodes/index.ts`
3. Add types in `src/lib/types.ts`
4. Add creator function in `src/stores/canvas-store.ts`
5. Add to NodeToolbar menu
6. Add to ContextMenu

### Node Component Structure

```tsx
function MyNode({ id, data, selected }: NodeProps<MyNodeType>) {
  const updateNodeData = useCanvasStore(s => s.updateNodeData);
  const deleteNode = useCanvasStore(s => s.deleteNode);
  
  return (
    <div className={`node-card ${selected ? 'node-card-selected' : ''}`}>
      {/* Handles */}
      <Handle type="target" position={Position.Left} id="input" />
      
      {/* Content */}
      <div>...</div>
      
      {/* Output handle */}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
}
```

### Generation Pattern

```typescript
async function handleGenerate() {
  const connectedInputs = getConnectedInputs(id);
  updateNodeData(id, { isGenerating: true });
  
  const response = await fetch('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: data.prompt || connectedInputs.textContent,
      referenceUrl: connectedInputs.referenceUrl,
      // ...
    })
  });
  
  const result = await response.json();
  updateNodeData(id, { outputUrl: result.imageUrl, isGenerating: false });
}
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `⌘C/V/X` | Copy/Paste/Cut |
| `⌘D` | Duplicate |
| `Delete` | Delete selected |
| `Space` | Pan (hold) |
| `V` | Select tool |
| `H` | Pan tool |
| `X` | Scissors tool |

---

## Files to Know

| What | Where |
|------|-------|
| Main canvas | `src/components/canvas/Canvas.tsx` |
| All node types | `src/components/canvas/nodes/` |
| State/actions | `src/stores/canvas-store.ts` |
| Type definitions | `src/lib/types.ts` |
| Model adapters | `src/lib/model-adapters.ts` |
| API routes | `src/app/api/` |
| Global styles | `src/app/globals.css` |
