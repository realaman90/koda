# Koda - Complete Application Specification

> A node-based visual workflow editor for AI-powered image, video, and audio generation. Think of it as a visual programming environment for AI content creation.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [User Interface](#4-user-interface)
5. [Node System](#5-node-system)
6. [AI Models](#6-ai-models)
7. [State Management](#7-state-management)
8. [API Reference](#8-api-reference)
9. [Plugin System](#9-plugin-system)
10. [Design System](#10-design-system)
11. [Interactions & Shortcuts](#11-interactions--shortcuts)
12. [Data Flow](#12-data-flow)
13. [Templates](#13-templates)
14. [Future Roadmap](#14-future-roadmap)

---

## 1. Overview

### 1.1 What is Koda?

Koda is a **Freepik Spaces clone** — a creative workflow tool that lets users:

- **Drag nodes** onto an infinite canvas
- **Connect nodes** with edges to create data flows
- **Generate AI content** (images, videos, music, speech)
- **Organize workflows** with groups, sticky notes, and annotations
- **Export outputs** for use in other tools

### 1.2 Target Users

| User Type | Use Case |
|-----------|----------|
| **Content Creators** | Generate social media visuals, thumbnails |
| **Marketers** | Create ad variations, product shots |
| **Filmmakers** | Storyboarding, concept art, video previews |
| **Designers** | Mood boards, style exploration |
| **Developers** | AI workflow prototyping |

### 1.3 Core Value Proposition

```
Traditional AI Tools:          Koda:
─────────────────────          ─────
Single prompt → Single output  Workflow → Multiple connected outputs
No context between generations Reference images flow between nodes
Manual re-prompting            Visual prompt building with presets
```

---

## 2. Tech Stack

### 2.1 Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Framework** | Next.js (App Router) | 16.1.1 | Server components, API routes |
| **Canvas** | @xyflow/react | 12.10.0 | Node graph rendering |
| **State** | Zustand + persist | 5.0.9 | Global state, localStorage |
| **UI** | Tailwind CSS + shadcn/ui | 4.0 | Styling, components |
| **AI API** | Fal.ai | 1.8.1 | Image/video/audio generation |
| **AI Agents** | Mastra + Anthropic | 0.24.9 | Prompt enhancement, analysis |
| **Rich Text** | TipTap | 3.15.3 | Text node editing |
| **Validation** | Zod | 4.3.5 | Schema validation |
| **Notifications** | Sonner | 2.0.7 | Toast messages |
| **Icons** | Lucide React | 0.562.0 | Icon library |

### 2.2 Development Tools

| Tool | Purpose |
|------|---------|
| TypeScript 5 | Type safety |
| ESLint 9 | Code linting |
| PostCSS | CSS processing |

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         KODA APPLICATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   DASHBOARD  │  │    CANVAS    │  │   SETTINGS   │          │
│  │              │  │              │  │              │          │
│  │  - Projects  │  │  - Nodes     │  │  - Theme     │          │
│  │  - Templates │  │  - Edges     │  │  - API Keys  │          │
│  │  - Showcase  │  │  - Toolbar   │  │  - Defaults  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    ZUSTAND STORES                        │   │
│  │   ┌──────────────┬──────────────┬──────────────┐        │   │
│  │   │ canvas-store │  app-store   │settings-store│        │   │
│  │   │              │              │              │        │   │
│  │   │ • nodes      │ • canvases   │ • theme      │        │   │
│  │   │ • edges      │ • current    │ • defaults   │        │   │
│  │   │ • history    │ • loading    │              │        │   │
│  │   │ • clipboard  │              │              │        │   │
│  │   └──────────────┴──────────────┴──────────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    API ROUTES                            │   │
│  │   /api/generate  │  /api/generate-video  │  /api/agents │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 EXTERNAL SERVICES                        │   │
│  │   ┌──────────────┐  ┌──────────────┐                    │   │
│  │   │    FAL.AI    │  │   ANTHROPIC  │                    │   │
│  │   │              │  │   (Mastra)   │                    │   │
│  │   │  • Images    │  │              │                    │   │
│  │   │  • Videos    │  │  • Prompts   │                    │   │
│  │   │  • Audio     │  │  • Analysis  │                    │   │
│  │   └──────────────┘  └──────────────┘                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow Pattern

```
Local-First Architecture:

User Action
     │
     ▼
┌─────────────┐
│   Zustand   │ ◄─── Instant UI update
│    Store    │
└─────────────┘
     │
     ├────────────────────────┐
     ▼                        ▼
┌─────────────┐        ┌─────────────┐
│localStorage │        │   FAL API   │ ◄─── Background polling
│  (persist)  │        │  (async)    │
└─────────────┘        └─────────────┘
                             │
                             ▼
                       Update Store
                             │
                             ▼
                        UI Reflects
```

### 3.3 File Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard (redirects or shows)
│   ├── canvas/page.tsx           # Canvas workspace
│   ├── settings/page.tsx         # Settings page
│   ├── globals.css               # Global styles + CSS variables
│   └── api/
│       ├── generate/route.ts     # Image generation
│       ├── generate-video/route.ts
│       ├── generate-audio/route.ts
│       └── agents/
│           └── enhance-prompt/route.ts
│
├── components/
│   ├── canvas/                   # Canvas-specific components
│   │   ├── Canvas.tsx            # React Flow wrapper
│   │   ├── NodeToolbar.tsx       # Left sidebar tools
│   │   ├── SettingsPanel.tsx     # Floating settings panel
│   │   ├── VideoSettingsPanel.tsx
│   │   ├── ContextMenu.tsx       # Right-click menu
│   │   ├── KeyboardShortcuts.tsx # Shortcuts modal
│   │   ├── ZoomControls.tsx      # Bottom-right zoom
│   │   ├── WelcomeOverlay.tsx    # First-time experience
│   │   ├── PresetPopover.tsx     # Preset selector
│   │   ├── nodes/                # Node components (11 types)
│   │   │   ├── index.ts          # Node registry
│   │   │   ├── ImageGeneratorNode.tsx
│   │   │   ├── VideoGeneratorNode.tsx
│   │   │   ├── TextNode.tsx
│   │   │   ├── MediaNode.tsx
│   │   │   ├── StickyNoteNode.tsx
│   │   │   ├── StickerNode.tsx
│   │   │   ├── GroupNode.tsx
│   │   │   ├── StoryboardNode.tsx
│   │   │   ├── MusicGeneratorNode.tsx
│   │   │   ├── SpeechNode.tsx
│   │   │   └── VideoAudioNode.tsx
│   │   └── edges/
│   │       ├── index.ts
│   │       └── DeletableEdge.tsx
│   │
│   ├── dashboard/                # Dashboard components
│   │   ├── DashboardPage.tsx
│   │   ├── DashboardHeader.tsx
│   │   ├── DashboardTabs.tsx
│   │   ├── ProjectsGrid.tsx
│   │   ├── CanvasCard.tsx
│   │   ├── TemplateCard.tsx
│   │   ├── TemplatesSection.tsx
│   │   └── SharedSection.tsx
│   │
│   ├── layout/                   # App shell
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── Breadcrumbs.tsx
│   │
│   ├── plugins/                  # Plugin UI
│   │   ├── PluginLauncher.tsx
│   │   └── AgentSandbox.tsx
│   │
│   ├── settings/                 # Settings sections
│   │   └── sections/
│   │
│   └── ui/                       # shadcn components
│
├── stores/
│   ├── canvas-store.ts           # Main canvas state
│   ├── app-store.ts              # App-level state
│   └── settings-store.ts         # User preferences
│
├── lib/
│   ├── types.ts                  # TypeScript definitions
│   ├── model-adapters.ts         # Model → API adapters
│   ├── utils.ts                  # Utilities (cn, etc.)
│   ├── presets.ts                # Preset definitions
│   ├── export-utils.ts           # Export functionality
│   ├── storage/                  # Storage providers
│   ├── templates/                # Built-in templates
│   └── plugins/                  # Plugin system
│       ├── types.ts
│       ├── registry.ts
│       ├── canvas-api.ts
│       └── official/
│
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   └── useAgentSandbox.ts
│
├── mastra/                       # AI agents
│   ├── index.ts
│   └── agents/
│       ├── prompt-enhancer.ts
│       └── creative-assistant.ts
│
└── public/
    └── assets/                   # Preset images
        ├── characters/
        ├── styles/
        ├── camera-angles/
        └── camera-lenses/
```

---

## 4. User Interface

### 4.1 Layout Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              TOP BAR                                     │
│  ┌────────┐  ┌─────────────────────┐                    ┌──────────────┐│
│  │  Logo  │  │    Canvas Name      │                    │ Export │ Run ││
│  └────────┘  └─────────────────────┘                    └──────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│     │                                                           │       │
│     │                                                           │       │
│  T  │                                                           │  S    │
│  O  │                                                           │  E    │
│  O  │                    CANVAS AREA                            │  T    │
│  L  │                                                           │  T    │
│  B  │              (React Flow with nodes)                      │  I    │
│  A  │                                                           │  N    │
│  R  │                                                           │  G    │
│     │                                                           │  S    │
│     │                                                           │       │
│     │                                               ┌───────────┐│       │
│     │                                               │Zoom Ctrls ││       │
├─────┴───────────────────────────────────────────────┴───────────┴───────┤
```

### 4.2 Canvas Components

#### NodeToolbar (Left Sidebar)

```
┌─────────────┐
│     +       │  ◄─── Add Node (opens dropdown)
├─────────────┤
│     ↖       │  ◄─── Select Tool (V)
│     ✋       │  ◄─── Pan Tool (H)
│     ✂       │  ◄─── Scissors Tool (X)
├─────────────┤
│     ↺       │  ◄─── Undo (⌘Z)
│     ↻       │  ◄─── Redo (⌘⇧Z)
├─────────────┤
│     ⚙       │  ◄─── Shortcuts (?)
├─────────────┤
│     🧩       │  ◄─── Plugins
└─────────────┘
```

#### Add Node Dropdown

```
┌────────────────────┐
│ NODES              │
│  🖼️✨ Image Generator │
│  🎬  Video Generator │
│  📝  Text           │
│  🖼️  Media          │
├────────────────────┤
│ AUDIO              │
│  🎵  Music Generator │
│  🎤  Speech         │
│  🎞️  Video Audio    │
├────────────────────┤
│ UTILITIES          │
│  📝  Sticky Note    │
│  😀  Sticker        │
│  📦  Group          │
└────────────────────┘
```

#### ZoomControls (Bottom Right)

```
┌───────────┐
│  −  100%  +  │  ◄─── Zoom in/out
│     🔲      │  ◄─── Fit to view
└───────────┘
```

### 4.3 Node Anatomy

#### Image Generator Node

```
┌─────────────────────────────────────────────┐
│  🖼️✨ Image Generator 1                      │  ◄─── Editable name
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │   Describe the image you want      │    │  ◄─── Prompt textarea
│  │   to generate...                    │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  [Model ▼] [1:1 ▼] [−1+] [⚙] [▶]           │  ◄─── Bottom toolbar
└─────────────────────────────────────────────┘
      │                               │
   ◯──┤ Text input              Output ├──◯
      │                               │
   ◯──┤ Reference                      │
      │                               │
```

#### Generated State

```
┌─────────────────────────────────────────────┐
│  🖼️✨ Image Generator 1                      │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │        [Generated Image]            │    │
│  │                                     │    │
│  │   ┌─────────────────────────────┐   │    │  ◄─── Hover toolbar
│  │   │ [Model▼][1:1▼][−1+][⚙] [↻] │   │    │
│  │   └─────────────────────────────┘   │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.4 Floating Panels

#### Settings Panel (Image Generator)

```
┌────────────────────────────────────┐
│  ✕  Image Generator Settings       │
├────────────────────────────────────┤
│                                    │
│  CHARACTER                         │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │ Img1 │ │ Img2 │ │  +   │       │
│  └──────┘ └──────┘ └──────┘       │
│                                    │
│  STYLE                             │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │Anime │ │Photo │ │Paint │       │
│  └──────┘ └──────┘ └──────┘       │
│                                    │
│  CAMERA ANGLE                      │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │Wide  │ │Close │ │Bird  │       │
│  └──────┘ └──────┘ └──────┘       │
│                                    │
│  CAMERA LENS                       │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │35mm  │ │50mm  │ │85mm  │       │
│  └──────┘ └──────┘ └──────┘       │
│                                    │
└────────────────────────────────────┘
```

### 4.5 Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🎨 Koda                                              [+ New Space]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [ My Spaces ]  [ Shared with me ]  [ Templates ]                       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  YOUR PROJECTS                                                          │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │              │  │              │  │              │                  │
│  │   [Preview]  │  │   [Preview]  │  │      +       │                  │
│  │              │  │              │  │   New Space  │                  │
│  │──────────────│  │──────────────│  │              │                  │
│  │ Project 1    │  │ Project 2    │  │              │                  │
│  │ 2 days ago   │  │ 5 days ago   │  │              │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  TEMPLATES                                         [View all →]         │
│                                                                         │
│  [ All ] [ Image ] [ Video ] [ Workflow ]                              │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │              │  │              │  │              │                  │
│  │   [Preview]  │  │   [Preview]  │  │   [Preview]  │                  │
│  │              │  │              │  │              │                  │
│  │──────────────│  │──────────────│  │──────────────│                  │
│  │ Mood Board   │  │ Storyboard   │  │ Product Shots│                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Node System

### 5.1 Node Types Overview

| Node Type | Category | Purpose | Input Handles | Output Handles |
|-----------|----------|---------|---------------|----------------|
| **ImageGenerator** | Generator | AI image creation | text, reference (1-14) | output (image) |
| **VideoGenerator** | Generator | AI video creation | text, reference, firstFrame, lastFrame | output (video) |
| **MusicGenerator** | Generator | AI music creation | — | output (audio) |
| **Speech** | Generator | Text-to-speech | — | output (audio) |
| **VideoAudio** | Generator | Sync audio to video | video | output (video+audio) |
| **Text** | Input | Text prompt input | — | output (text) |
| **Media** | Input | Image/video upload | — | output (image/video) |
| **StickyNote** | Utility | Notes & annotations | — | — |
| **Sticker** | Utility | Emoji decorations | — | — |
| **Group** | Utility | Visual grouping | — | — |
| **Storyboard** | Agent | AI storyboard creation | productImage, characterImage | — |

### 5.2 Node Data Structures

#### ImageGeneratorNode

```typescript
interface ImageGeneratorNodeData {
  name?: string;
  prompt: string;
  model: ImageModelType;
  aspectRatio: AspectRatio;
  imageSize?: FluxImageSize;
  resolution?: NanoBananaResolution;
  imageCount?: number;              // 1-4
  references?: ImageReference[];
  refHandleCount?: number;          // Dynamic handles (1-14)
  style?: RecraftStyle | IdeogramStyle;
  magicPrompt?: boolean;
  cfgScale?: number;
  steps?: number;
  strength?: number;
  selectedCharacter?: CharacterSelection;
  selectedStyle?: StylePreset | null;
  selectedCameraAngle?: CameraAnglePreset | null;
  selectedCameraLens?: CameraLensPreset | null;
  outputUrl?: string;
  outputUrls?: string[];
  isGenerating?: boolean;
  error?: string;
}
```

#### VideoGeneratorNode

```typescript
interface VideoGeneratorNodeData {
  name?: string;
  prompt: string;
  model: VideoModelType;
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  resolution?: VideoResolution;
  generateAudio?: boolean;
  outputUrl?: string;
  thumbnailUrl?: string;
  isGenerating?: boolean;
  progress?: number;
  error?: string;
}
```

### 5.3 Handle Types

| Handle ID | Type | Color | Purpose |
|-----------|------|-------|---------|
| `text` | target | Blue | Text input connection |
| `reference` | target | Orange | Image reference input |
| `ref1-ref14` | target | Orange | Multi-reference inputs |
| `firstFrame` | target | Purple | First frame for video |
| `lastFrame` | target | Purple | Last frame for video |
| `video` | target | Purple | Video input |
| `output` | source | Green | Node output |

### 5.4 Node Behaviors

#### On Selection

- Blue border highlight (2.5px solid)
- Shadow glow effect
- Floating toolbar appears above
- Handles become visible

#### On Hover

- Border lightens
- Handles fade in
- Bottom toolbar appears (if not generated)

#### On Generating

- Teal pulsing glow animation
- Spinner overlay
- Progress indicator
- "Generating..." status

#### On Generated

- Image fills card area
- Hover reveals overlay toolbar
- Dimension badge (top right)
- Download button (top left)
- Prompt preview (bottom)

---

## 6. AI Models

### 6.1 Image Generation Models

| Model | ID | Max Images | Input Type | Special Features |
|-------|-----|------------|------------|------------------|
| **Flux Schnell** | `flux-schnell` | 4 | text-only | Fast, 1-4 steps |
| **Flux Pro** | `flux-pro` | 4 | text+image | High quality |
| **Nano Banana Pro** | `nanobanana-pro` | 4 | text+image | Up to 14 refs, 1K-4K |
| **Recraft V3** | `recraft-v3` | 4 | text-only | 3 style modes |
| **Ideogram V3** | `ideogram-v3` | 4 | text-only | Magic prompt, text/logos |
| **SD 3.5 Large** | `sd-3.5` | 4 | text+image | CFG, steps, strength |

#### Model Capabilities

```typescript
const MODEL_CAPABILITIES = {
  'flux-schnell': {
    label: 'Flux Schnell',
    maxImages: 4,
    inputType: 'text-only',
    supportsReferences: false,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    imageSizes: ['square_hd', 'square', 'landscape_4_3', 'portrait_4_3', ...],
    description: 'Fast, 1-4 steps',
  },
  // ... other models
};
```

### 6.2 Video Generation Models

| Model | ID | Duration | Input Mode | Features |
|-------|-----|----------|------------|----------|
| **Veo 3** | `veo-3` | 4-8s | text | Audio, 720p-1080p |
| **Veo 3.1 I2V** | `veo-3.1-i2v` | 4-8s | single-image | Audio |
| **Veo 3.1 Multi-Ref** | `veo-3.1-ref` | 8s | multi-reference (3) | Audio |
| **Veo 3.1 FLF** | `veo-3.1-flf` | 4-8s | first-last-frame | Audio |
| **Kling 2.6 T2V** | `kling-2.6-t2v` | 5-10s | text | Audio |
| **Kling 2.6 I2V** | `kling-2.6-i2v` | 5-10s | first-last-frame | Audio, optional end |
| **Luma Ray 2** | `luma-ray2` | 5-9s | single-image | Cinematic, 540p-1080p |
| **Minimax** | `minimax-video` | 5s | single-image | Fast |
| **Runway Gen-3** | `runway-gen3` | 5-10s | single-image | Premium |

### 6.3 Audio Models

| Model | ID | Type | Features |
|-------|-----|------|----------|
| **ACE-Step** | `ace-step` | Music | 5-240s, instrumental toggle |
| **ElevenLabs TTS** | `elevenlabs-tts` | Speech | 20+ voices, speed/stability |
| **MMAudio V2** | `mmaudio-v2` | Video Audio | Prompt-based sync, 1-30s |

### 6.4 Model Adapter Pattern

Each model has an adapter that:
1. Converts generic request → model-specific Fal payload
2. Extracts outputs from model-specific responses
3. Optionally provides dynamic model IDs

```typescript
interface ModelAdapter {
  buildInput(request: GenerateRequest): Record<string, unknown>;
  extractImageUrls(result): string[];
  getModelId?(request): string;  // Optional dynamic routing
}
```

---

## 7. State Management

### 7.1 Canvas Store

```typescript
interface CanvasState {
  // Canvas data
  nodes: AppNode[];
  edges: AppEdge[];
  
  // Selection
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  
  // History (50 levels max)
  history: HistorySnapshot[];
  historyIndex: number;
  
  // Clipboard
  clipboard: ClipboardData | null;
  
  // UI state
  activeTool: 'select' | 'pan' | 'scissors';
  settingsPanelNodeId: string | null;
  settingsPanelPosition: { x: number; y: number } | null;
  videoSettingsPanelNodeId: string | null;
  videoSettingsPanelPosition: { x: number; y: number } | null;
  contextMenu: { x: number; y: number; type: 'node' | 'canvas' } | null;
  showShortcuts: boolean;
  isRunningAll: boolean;
  isReadOnly: boolean;
  
  // React Flow instance
  reactFlowInstance: ReactFlowInstance | null;
}
```

### 7.2 Key Actions

| Action | Description | Triggers History |
|--------|-------------|------------------|
| `addNode` | Create new node | ✅ |
| `updateNodeData` | Update node data | ✅ |
| `deleteNode` | Delete node + edges | ✅ |
| `onNodesChange` | React Flow changes | ✅ (on drag end) |
| `onEdgesChange` | Edge changes | ✅ (on remove) |
| `onConnect` | Create edge | ✅ |
| `copySelected` | Copy to clipboard | ❌ |
| `cutSelected` | Cut to clipboard | ✅ |
| `paste` | Paste from clipboard | ✅ |
| `duplicateSelected` | Clone selection | ✅ |
| `undo` | Restore previous | ❌ (navigates) |
| `redo` | Restore next | ❌ (navigates) |
| `runAll` | Batch generate | ❌ |

### 7.3 Persistence

Only these fields persist to localStorage (`spaces-canvas-storage`):

- `nodes`
- `edges`
- `spaceName`

---

## 8. API Reference

### 8.1 Image Generation

**POST `/api/generate`**

```typescript
// Request
{
  prompt: string;
  model: ImageModelType;
  aspectRatio: AspectRatio;
  imageSize?: FluxImageSize;
  resolution?: NanoBananaResolution;
  imageCount?: number;           // 1-4
  referenceUrl?: string;
  referenceUrls?: string[];      // Up to 14
  style?: RecraftStyle | IdeogramStyle;
  magicPrompt?: boolean;
  cfgScale?: number;
  steps?: number;
  strength?: number;
}

// Response
{
  success: boolean;
  imageUrl: string;              // First image (backwards compat)
  imageUrls: string[];           // All generated images
  model: string;
}
```

### 8.2 Video Generation

**POST `/api/generate-video`**

```typescript
// Request
{
  prompt: string;
  model: VideoModelType;
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  resolution?: VideoResolution;
  referenceUrl?: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls?: string[];
  generateAudio?: boolean;
}

// Response
{
  success: boolean;
  videoUrl: string;
  model: string;
}
```

### 8.3 Audio Generation

**POST `/api/generate-audio`**

```typescript
// Music Request
{
  type: 'music';
  prompt: string;
  duration: MusicDuration;
  instrumental: boolean;
  guidanceScale: number;
}

// Speech Request
{
  type: 'speech';
  text: string;
  voice: ElevenLabsVoice;
  speed: number;
  stability: number;
}

// Video Audio Request
{
  type: 'video-audio';
  prompt: string;
  videoUrl: string;
  duration: number;
  cfgStrength: number;
  negativePrompt?: string;
}

// Response
{
  success: boolean;
  audioUrl: string;  // or videoUrl for mmaudio
  model: string;
}
```

### 8.4 Prompt Enhancement

**POST `/api/agents/enhance-prompt`**

```typescript
// Request
{
  prompt: string;
}

// Response
{
  success: boolean;
  originalPrompt: string;
  enhancedPrompt: string;
}
```

---

## 9. Plugin System

### 9.1 Plugin Types

| Type | Creator | Execution | Example |
|------|---------|-----------|---------|
| **Simple** | Anyone (no-code) | Input → AI → Output | Script to Scenes |
| **Transform** | Official | Input → API → Output | Aspect Ratio Converter |
| **Agent** | Official | Interactive → Multi-step | Brand Extractor |

### 9.2 Plugin Definition

```typescript
interface PluginBase {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: PluginCategory;
  author: PluginAuthor;
  version: string;
  visibility: 'private' | 'team' | 'public';
}

type PluginCategory =
  | 'planning'
  | 'brand'
  | 'adaptation'
  | 'analysis'
  | 'text'
  | 'enhancement'
  | 'automation'
  | 'export';
```

### 9.3 Canvas API (for Agents)

```typescript
interface CanvasAPI {
  // Read
  getNodes(): CanvasNode[];
  getSelectedNodes(): CanvasNode[];
  getEdges(): CanvasEdge[];
  
  // Create
  createNode(input: CreateNodeInput): Promise<string>;
  createNodes(inputs: CreateNodeInput[]): Promise<string[]>;
  createEdge(from, fromHandle, to, toHandle): Promise<string>;
  createGroup(nodeIds: string[], label: string): Promise<string>;
  
  // Position
  getViewportCenter(): { x: number; y: number };
  getGridPosition(index: number, columns?: number): { x: number; y: number };
  
  // Focus
  focusNode(nodeId: string): void;
  fitView(nodeIds?: string[]): void;
}
```

---

## 10. Design System

### 10.1 Color Palette

#### Dark Mode (Default)

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#09090b` | App background |
| `--foreground` | `#fafafa` | Primary text |
| `--card` | `#18181b` | Card backgrounds |
| `--muted` | `#27272a` | Muted backgrounds |
| `--muted-foreground` | `#71717a` | Secondary text |
| `--border` | `rgba(255,255,255,0.1)` | Borders |
| `--primary` | `#fafafa` | Primary actions |
| `--destructive` | `#ef4444` | Delete actions |

#### Accent Colors

| Purpose | Color | Token |
|---------|-------|-------|
| Selection | `#6366f1` (Indigo) | `--node-border-selected` |
| Image nodes | `#14b8a6` (Teal) | `--node-title-image` |
| Video nodes | `#a855f7` (Purple) | `--node-title-video` |
| Text nodes | `#fcd34d` (Amber) | `--node-title-text` |
| Media nodes | `#818cf8` (Indigo) | `--node-title-media` |
| Music nodes | `#fb923c` (Orange) | `--node-title-music` |
| Speech nodes | `#22d3ee` (Cyan) | `--node-title-speech` |

### 10.2 Typography

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| H1 | 24px | 700 | Page titles |
| H2 | 18px | 600 | Section headers |
| H3 | 16px | 500 | Card titles |
| Body | 14px | 400 | Primary text |
| Small | 12px | 400 | Labels, hints |
| Tiny | 10px | 500 | Badges, tags |

### 10.3 Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Icon gaps |
| `sm` | 8px | Tight spacing |
| `md` | 12px | Default padding |
| `lg` | 16px | Section gaps |
| `xl` | 24px | Major sections |
| `2xl` | 32px | Page margins |

### 10.4 Shadows

```css
/* Node card */
--node-card-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
--node-card-shadow-hover: 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03);

/* Selection */
--node-shadow-selected: 0 0 0 3px rgba(99,102,241,0.25);

/* Toolbar */
--toolbar-shadow: 0 4px 12px rgba(0,0,0,0.4);
```

### 10.5 Node Dimensions

| Measurement | Value |
|-------------|-------|
| Node width | 420px |
| Handle size | 24px |
| Border radius | 16px (2xl) |
| Inner content radius | 12px |
| Minimum height | 200px (empty) |

---

## 11. Interactions & Shortcuts

### 11.1 Keyboard Shortcuts

| Action | Shortcut | Context |
|--------|----------|---------|
| Undo | `⌘Z` | Global |
| Redo | `⌘⇧Z` | Global |
| Copy | `⌘C` | With selection |
| Paste | `⌘V` | Global |
| Cut | `⌘X` | With selection |
| Duplicate | `⌘D` | With selection |
| Delete | `Delete` / `Backspace` | With selection |
| Select All | `⌘A` | Global |
| Pan Mode | `Space` (hold) | Canvas |
| Fit View | `F` | Canvas |
| Select Tool | `V` | Canvas |
| Pan Tool | `H` | Canvas |
| Scissors | `X` | Canvas |

### 11.2 Mouse Interactions

| Action | Behavior |
|--------|----------|
| Click node | Select |
| Click canvas | Deselect all |
| Drag node | Move |
| Drag selection | Move multiple |
| Shift+Click | Add to selection |
| Right-click | Context menu |
| Double-click name | Edit name |
| Scroll | Zoom |
| Click+drag (empty) | Selection box |
| Drag handle | Create connection |

### 11.3 Tool Modes

| Tool | Cursor | Behavior |
|------|--------|----------|
| Select | Default | Click to select, drag to move |
| Pan | Grab | Drag to pan canvas |
| Scissors | Crosshair | Select edges to delete |

---

## 12. Data Flow

### 12.1 Node Connection Flow

```
┌────────────┐     edge      ┌────────────┐
│  TextNode  │─────────────▶│  ImageGen  │
│            │   (text)      │            │
│  content   │              │  prompt    │
└────────────┘              └────────────┘
                                  │
                                  │ output
                                  ▼
                            ┌────────────┐
                            │  VideoGen  │
                            │            │
                            │ reference  │
                            └────────────┘
```

### 12.2 Generation Flow

```
1. User clicks Generate
         │
         ▼
2. updateNodeData({ isGenerating: true })
         │
         ▼
3. Build prompt from:
   - Node prompt
   - Connected TextNode content
   - Preset modifiers
         │
         ▼
4. Collect reference URLs from connected nodes
         │
         ▼
5. Call /api/generate
         │
         ▼
6. Model adapter builds Fal payload
         │
         ▼
7. Fal API generates (polling)
         │
         ▼
8. Adapter extracts image URLs
         │
         ▼
9. updateNodeData({ outputUrl, isGenerating: false })
         │
         ▼
10. If multiple images: spawn MediaNodes
```

### 12.3 Connected Inputs Resolution

```typescript
getConnectedInputs(nodeId: string) {
  // Find all incoming edges to this node
  const incomingEdges = edges.filter(e => e.target === nodeId);
  
  // Resolve each handle type
  return {
    textContent: resolveTextHandle(incomingEdges),
    referenceUrl: resolveReferenceHandle(incomingEdges),
    firstFrameUrl: resolveFirstFrameHandle(incomingEdges),
    lastFrameUrl: resolveLastFrameHandle(incomingEdges),
    referenceUrls: resolveMultiRefHandles(incomingEdges),
    productImageUrl: resolveProductHandle(incomingEdges),
    characterImageUrl: resolveCharacterHandle(incomingEdges),
    videoUrl: resolveVideoHandle(incomingEdges),
  };
}
```

---

## 13. Templates

### 13.1 Built-in Templates

| Template | Category | Description | Nodes |
|----------|----------|-------------|-------|
| Blank | — | Empty canvas | — |
| Mood Board | Image | Visual inspiration collection | Media, StickyNote |
| Brand Identity | Image | Brand asset workflow | ImageGen, Media |
| Image Workflow | Image | Multi-step image generation | ImageGen, Text |
| Model Swap | Image | Character consistency | ImageGen, Media |
| Product Variations | Image | Product shot variants | ImageGen, Media |
| Storyboard | Video | Scene breakdown | Storyboard, ImageGen |
| Video Production | Video | Video generation workflow | VideoGen, ImageGen |

### 13.2 Template Structure

```typescript
interface Template {
  id: string;
  name: string;
  description: string;
  category: 'image' | 'video' | 'workflow';
  thumbnail: string;
  nodes: AppNode[];
  edges: AppEdge[];
}
```

---

## 14. Future Roadmap

### 14.1 Planned Features

| Feature | Status | Priority |
|---------|--------|----------|
| Plugin system | Spec complete | High |
| Database persistence (Supabase) | Planned | High |
| User authentication | Planned | High |
| Real-time collaboration | Planned | Medium |
| Custom presets | Planned | Medium |
| Workflow templates marketplace | Planned | Medium |
| Assistant node (AI agent) | Planned | Low |
| Mobile support | Planned | Low |

### 14.2 Technical Debt

- [ ] Migrate all inline styles to CSS variables
- [ ] Extract common node patterns to shared component
- [ ] Add comprehensive error boundaries
- [ ] Implement optimistic updates for generation
- [ ] Add generation queue management
- [ ] Improve large canvas performance

---

## Environment Variables

```env
# Required
FAL_KEY=           # Fal.ai API key
ANTHROPIC_API_KEY= # For Mastra agents

# Optional
OPENAI_API_KEY=    # Fallback LLM
```

---

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

---

*Last updated: January 2026*
