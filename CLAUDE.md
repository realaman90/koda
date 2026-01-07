# Spaces Clone - Claude Code Context

## Project Overview
A **Freepik Spaces clone** - node-based visual workflow editor for AI-powered image generation.
Users drag nodes onto a canvas, connect them, and generate AI images.

## Tech Stack
- **Framework**: Next.js 15.3.8 (App Router)
- **Canvas**: @xyflow/react (React Flow v12)
- **State**: Zustand with persist middleware (localStorage)
- **UI**: Tailwind CSS v4 + shadcn/ui
- **AI**: Fal.ai API (Flux models)
- **Validation**: Zod
- **Hosting**: Vercel

## Architecture: Local-First
```
User Action → Zustand (instant UI) → localStorage (persist)
                    ↓
              Fal API (background)
                    ↓
              Poll for result → Update state → UI reflects
```

No database for MVP. All state is local. Fast like Linear.

## Project Structure
```
src/
├── app/
│   ├── page.tsx              # Main canvas page
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Tailwind + CSS vars
│   └── api/
│       └── generate/
│           └── route.ts      # Fal proxy endpoint
├── components/
│   ├── canvas/
│   │   ├── Canvas.tsx        # React Flow wrapper
│   │   ├── NodeToolbar.tsx   # Drag to add nodes
│   │   └── nodes/
│   │       ├── ImageGeneratorNode.tsx
│   │       └── index.ts      # Node type registry
│   └── ui/                   # shadcn components
├── stores/
│   └── canvas-store.ts       # Zustand store
└── lib/
    ├── utils.ts              # shadcn utils
    ├── fal.ts                # Fal client config
    └── types.ts              # TypeScript types
```

## Key Files

### Canvas Store (`src/stores/canvas-store.ts`)
Zustand store managing:
- `nodes`: React Flow nodes array
- `edges`: React Flow edges array
- `addNode()`: Add node at position
- `updateNodeData()`: Update node settings
- `onNodesChange()`: Handle node drag/resize
- `onEdgesChange()`: Handle edge changes
- `onConnect()`: Create new edge

Persisted to localStorage with `persist` middleware.

### Image Generator Node
**Inputs**: Prompt (text), Reference image (optional via connection)
**Outputs**: Generated image URL
**Settings**:
- Model: flux-schnell, flux-pro, nanobanana-pro
- Aspect ratio: 1:1, 16:9, 9:16, 4:3

### Fal API Route (`src/app/api/generate/route.ts`)
Proxies requests to Fal.ai. Required because Fal API key shouldn't be exposed client-side.
Uses polling pattern (not webhooks).

## Image Models Available
| Model | ID | Speed | Use |
|-------|-----|-------|-----|
| Flux Schnell | fal-ai/flux/schnell | ~2s | Dev/testing |
| Flux Pro | fal-ai/flux-pro | ~10s | Production |
| NanoBanana Pro | TBD | TBD | Alternative |

## Environment Variables
```env
FAL_KEY=your_fal_api_key
```

## Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
```

## Development Guidelines

### Adding a New Node Type
1. Create component in `src/components/canvas/nodes/`
2. Register in `src/components/canvas/nodes/index.ts`
3. Add to NodeToolbar
4. Define TypeScript types in `src/lib/types.ts`

### State Updates
Always use Zustand actions, never mutate state directly:
```ts
// Good
useCanvasStore.getState().updateNodeData(nodeId, { prompt: 'new' })

// Bad
node.data.prompt = 'new'
```

### Styling Nodes
- Use Tailwind classes
- Dark theme by default (bg-zinc-900, text-zinc-100)
- Node width: 280px standard
- Handles: 10px circles on edges

## Current MVP Scope
- [x] Canvas with pan/zoom
- [x] Image Generator node
- [ ] Text input node
- [ ] Media upload node
- [ ] Node connections working
- [ ] Generate images via Fal
- [ ] Output preview in node

## Claude Agents (Mastra)

Two agents are set up for AI-assisted features:

### Prompt Enhancer Agent
- **Purpose**: Takes basic prompts and enhances them for better image generation
- **Endpoint**: `POST /api/agents/enhance-prompt`
- **Input**: `{ prompt: string }`
- **Output**: Enhanced prompt with style, lighting, composition details

### Creative Assistant Agent
- **Purpose**: Helps brainstorm ideas, suggest prompts, plan image series
- **Location**: `src/mastra/agents/creative-assistant.ts`
- **Usage**: For Assistant node (future) or chat interface

### Adding New Agents
1. Create agent file in `src/mastra/agents/`
2. Register in `src/mastra/index.ts`
3. Create API route if needed in `src/app/api/agents/`

## Future (Post-MVP)
- Supabase DB for persistence
- User auth
- Video Generator node
- Assistant (LLM) node using creativeAssistantAgent
- Templates gallery
- Share/export

## Reference Docs
- [React Flow](https://reactflow.dev/docs)
- [Fal.ai](https://fal.ai/docs)
- [Zustand](https://zustand.docs.pmnd.rs/)
- [shadcn/ui](https://ui.shadcn.com)
