# Spaces Clone - Complete Project Reference

## What This Is

A **Freepik Spaces clone** - a node-based visual workflow editor for AI-powered image and video generation. Users drag nodes onto a canvas, connect them with edges, and generate AI content. Think of it as a visual programming environment for AI content creation.

## Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js (App Router) | 16.1.1 |
| Canvas | @xyflow/react (React Flow) | 12.10.0 |
| State | Zustand + persist | 5.0.9 |
| UI | Tailwind CSS + shadcn/ui | 4.0 |
| AI Generation | Fal.ai | via @fal-ai/client |
| AI Agents | Mastra + Anthropic | 0.24.9 |
| Validation | Zod | 4.3.5 |
| Notifications | Sonner | 2.0.7 |

## Architecture Pattern

**Local-First**: No database for MVP. All state lives in Zustand and persists to localStorage.

```
User Action → Zustand (instant UI) → localStorage
                    ↓
              Fal API (background polling)
                    ↓
              Update state → UI reflects
```

---

## Node Types

### 1. ImageGeneratorNode
- **Purpose**: Generate AI images from prompts
- **Inputs**: Text prompt, up to 8 reference images (via edges)
- **Outputs**: 1-4 generated images
- **Models**: flux-schnell, flux-pro, nanobanana-pro, recraft-v3, ideogram-v3, sd-3.5
- **Presets**: Character, Style, Camera Angle, Camera Lens
- **Settings**: Aspect ratio, resolution, CFG scale, steps, strength, magic prompt

### 2. VideoGeneratorNode
- **Purpose**: Generate AI videos
- **Inputs**: Text prompt, reference images (model-dependent)
- **Outputs**: Video file
- **Models**: veo-3, veo-3.1-i2v, kling-2.6-t2v/i2v, luma-ray2, minimax-video, runway-gen3
- **Settings**: Duration (4-10s), resolution (540p-1080p), audio toggle

### 3. TextNode
- **Purpose**: Text input that connects to generators
- **Features**: Auto-expanding textarea, editable name
- **Output**: Text handle for connections

### 4. MediaNode
- **Purpose**: Upload or paste images
- **Features**: Drag-drop, URL paste, base64 support
- **Output**: Image handle for connections

---

## Key Files & Locations

```
src/
├── app/
│   ├── page.tsx                    # Main canvas page (server component)
│   ├── api/
│   │   ├── generate/route.ts       # Image generation proxy
│   │   ├── generate-video/route.ts # Video generation proxy
│   │   └── agents/enhance-prompt/  # Prompt enhancement agent
├── components/
│   ├── canvas/
│   │   ├── Canvas.tsx              # React Flow wrapper
│   │   ├── NodeToolbar.tsx         # Left sidebar tools
│   │   ├── SettingsPanel.tsx       # Floating settings for nodes
│   │   ├── PresetPopover.tsx       # Preset selector modal
│   │   ├── ContextMenu.tsx         # Right-click menu
│   │   ├── KeyboardShortcuts.tsx   # Shortcuts modal
│   │   ├── nodes/
│   │   │   ├── ImageGeneratorNode.tsx
│   │   │   ├── VideoGeneratorNode.tsx
│   │   │   ├── TextNode.tsx
│   │   │   ├── MediaNode.tsx
│   │   │   └── index.ts            # Node registry
│   │   └── edges/
│   │       └── DeletableEdge.tsx   # Custom edge with delete
│   ├── layout/
│   │   └── Header.tsx              # Top bar with export
│   └── ui/                         # shadcn components
├── stores/
│   └── canvas-store.ts             # Zustand store (main state)
├── lib/
│   ├── types.ts                    # TypeScript types
│   ├── fal.ts                      # Fal client config
│   ├── model-adapters.ts           # Model → API adapters
│   └── utils.ts                    # Utilities
├── mastra/
│   ├── index.ts                    # Mastra init
│   └── agents/
│       ├── prompt-enhancer.ts      # Enhances prompts
│       └── creative-assistant.ts   # Brainstorming (not in UI yet)
└── public/assets/                  # Preset SVG images
```

---

## Canvas Store (`canvas-store.ts`)

### State Shape
```typescript
{
  nodes: AppNode[]           // All canvas nodes
  edges: AppEdge[]           // All connections
  spaceName: string          // Workflow name
  selectedNodeIds: string[]  // Selected nodes
  history: HistorySnapshot[] // Undo stack (max 50)
  historyIndex: number       // Current position
  clipboard: ClipboardData   // Copy buffer
  activeTool: 'select' | 'pan' | 'scissors'
  // + UI state (panels, menus)
}
```

### Key Actions
- `addNode(type, position)` - Create node
- `updateNodeData(id, data)` - Update node (triggers history)
- `onNodesChange/onEdgesChange/onConnect` - React Flow handlers
- `copySelected/cutSelected/paste/duplicateSelected` - Clipboard
- `undo/redo` - History navigation
- `runAll()` - Batch generate all image nodes

### Persistence
Only `nodes`, `edges`, `spaceName` persist to localStorage key `spaces-canvas-storage`.

---

## API Routes

### POST `/api/generate`
Image generation via Fal.ai
```typescript
// Input
{ prompt, model, aspectRatio, imageCount, referenceUrl?, styleParams... }
// Output
{ success, imageUrl, imageUrls[], model }
```

### POST `/api/generate-video`
Video generation via Fal.ai
```typescript
// Input
{ prompt, model, duration, resolution, referenceUrl?, firstFrameUrl?, lastFrameUrl? }
// Output
{ success, videoUrl, model }
```

### POST `/api/agents/enhance-prompt`
Prompt enhancement via Mastra agent
```typescript
// Input
{ prompt }
// Output
{ success, originalPrompt, enhancedPrompt }
```

---

## Model Adapters

Each model has an adapter in `lib/model-adapters.ts` that:
1. Converts generic request → model-specific Fal payload
2. Extracts outputs from model-specific responses

**Image Models**: FluxSchnell, FluxPro, NanoBanana, RecraftV3, IdeogramV3, SD35

**Video Models**: Veo3, Veo31, Kling26, LumaRay2, Minimax, RunwayGen3

---

## UI Patterns

- **Dark theme**: zinc-950 background, zinc-100 text
- **Accents**: Indigo/purple for interactive elements
- **Node width**: 280px standard
- **Handles**: 10px circles, color-coded by type
- **Selection**: Ring-based indicators (ring-2 ring-indigo-500)
- **Floating panels**: Positioned relative to nodes

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z |
| Copy | Ctrl+C |
| Paste | Ctrl+V |
| Cut | Ctrl+X |
| Duplicate | Ctrl+D |
| Delete | Delete/Backspace |
| Select All | Ctrl+A |
| Pan Mode | Space (hold) |
| Fit View | F |

---

## Preset System

Located in `public/assets/`:
- **Characters**: Face/identity presets
- **Styles**: Art style presets (anime, photorealistic, etc.)
- **Camera Angles**: Shot composition presets
- **Camera Lenses**: Lens/focal length presets

Each preset has an SVG thumbnail and contributes to the final prompt.

---

## Development Commands

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm run lint     # ESLint check
```

---

## Environment Variables

```env
FAL_KEY=           # Required: Fal.ai API key
ANTHROPIC_API_KEY= # Required: For Mastra agents
OPENAI_API_KEY=    # Optional: Fallback LLM
```

---

## Adding New Features

### New Node Type
1. Create component in `src/components/canvas/nodes/`
2. Export from `src/components/canvas/nodes/index.ts`
3. Add creator function in `canvas-store.ts`
4. Add to NodeToolbar and ContextMenu
5. Define types in `lib/types.ts`

### New Image Model
1. Create adapter class in `lib/model-adapters.ts`
2. Add to model registry in adapter file
3. Update ImageModelType in `lib/types.ts`
4. Add to model selector in SettingsPanel

### New Preset Category
1. Add SVGs to `public/assets/[category]/`
2. Update PresetPopover component
3. Add to ImageGeneratorNode data type

---

## Current Status

**Complete**:
- Canvas with pan/zoom
- 4 node types (Image, Video, Text, Media)
- 6 image models, 10 video models
- Preset system (Character, Style, Camera Angle, Lens)
- Undo/redo (50 levels)
- Copy/paste/duplicate
- Export (JSON/PNG)
- Keyboard shortcuts
- Context menus
- Floating settings panel
- Batch generation (Run All)

**Planned**:
- Plugin system (architecture documented in `/docs/PLUGIN_ARCHITECTURE.md`)
- Database persistence (Supabase)
- User authentication
- Template gallery
- Collaboration features
- Assistant node (uses creativeAssistantAgent)

---

## Reference Docs
- [React Flow](https://reactflow.dev/docs)
- [Fal.ai](https://fal.ai/docs)
- [Zustand](https://zustand.docs.pmnd.rs/)
- [shadcn/ui](https://ui.shadcn.com)
- [Mastra](https://mastra.ai/docs)
