# Agent Plugin Implementation Guide

This document describes the Agent Plugin architecture implemented in GenFlow, including how to create new plugins.

## Overview

Agent Plugins are interactive plugins that can create multiple nodes on the canvas through a sandbox UI. They provide a structured way to extend GenFlow's capabilities with AI-powered features.

**Key Features:**
- Self-contained plugins with their own schemas and prompts
- Provider-agnostic AI service abstraction (easily swap LLM providers)
- Canvas API for safe interaction with the workflow canvas
- Sandbox UI modal for plugin interaction

## Architecture

```
src/
├── lib/plugins/
│   ├── types.ts                     # Plugin type definitions
│   ├── registry.ts                  # Plugin registry singleton
│   ├── canvas-api.ts                # Canvas API hook for plugins
│   ├── ai-service/
│   │   ├── types.ts                 # AIService interface (provider-agnostic)
│   │   ├── mastra-provider.ts       # Mastra implementation
│   │   └── index.ts                 # Export default provider
│   └── official/
│       └── storyboard-generator/    # Example plugin
│           ├── index.ts             # Plugin definition & registration
│           ├── StoryboardSandbox.tsx # Sandbox UI component
│           └── schema.ts            # Zod schemas + prompts
│
├── components/plugins/
│   ├── AgentSandbox/
│   │   ├── index.tsx                # Main sandbox modal
│   │   └── CanvasAPIProvider.tsx    # Canvas API context provider
│   └── PluginLauncher/
│       └── index.tsx                # Plugin launcher dropdown
│
├── app/api/plugins/
│   └── storyboard/
│       └── route.ts                 # API route for storyboard generation
│
└── hooks/
    └── useAgentSandbox.ts           # Hook for sandbox state management
```

## Creating a New Plugin

### Step 1: Create the Plugin Directory

```bash
mkdir -p src/lib/plugins/official/my-plugin
```

### Step 2: Define Schemas and Prompts

Create `schema.ts` with Zod schemas for input validation and AI output structure:

```typescript
// src/lib/plugins/official/my-plugin/schema.ts
import { z } from 'zod';

// Input validation schema
export const MyPluginInputSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  count: z.number().min(1).max(10).default(3),
});

export type MyPluginInput = z.infer<typeof MyPluginInputSchema>;

// Output schema for AI
export const MyPluginOutputSchema = z.object({
  items: z.array(z.object({
    title: z.string(),
    description: z.string(),
    prompt: z.string(),
  })),
  summary: z.string(),
});

export type MyPluginOutput = z.infer<typeof MyPluginOutputSchema>;

// System prompt for the AI
export const MY_PLUGIN_SYSTEM_PROMPT = `You are an expert at generating content.
Your task is to create high-quality outputs based on the user's request.
...`;

// Build user prompt from input
export function buildMyPluginPrompt(input: MyPluginInput): string {
  return `Generate ${input.count} items for: ${input.prompt}`;
}
```

### Step 3: Create the API Route

```typescript
// src/app/api/plugins/my-plugin/route.ts
import { NextResponse } from 'next/server';
import { AIService } from '@/lib/plugins/ai-service';
import {
  MyPluginInputSchema,
  MyPluginOutputSchema,
  MY_PLUGIN_SYSTEM_PROMPT,
  buildMyPluginPrompt,
} from '@/lib/plugins/official/my-plugin/schema';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    const parseResult = MyPluginInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const prompt = buildMyPluginPrompt(input);

    // Generate using AI service
    const aiService = new AIService();
    const result = await aiService.generateStructured(
      prompt,
      MyPluginOutputSchema,
      { systemPrompt: MY_PLUGIN_SYSTEM_PROMPT, temperature: 0.7 }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
```

### Step 4: Create the Sandbox UI

```typescript
// src/lib/plugins/official/my-plugin/MyPluginSandbox.tsx
'use client';

import * as React from 'react';
import type { AgentSandboxProps, CreateNodeInput } from '@/lib/plugins/types';
import type { MyPluginInput, MyPluginOutput } from './schema';

export function MyPluginSandbox({ canvas, onClose, notify }: AgentSandboxProps) {
  const [input, setInput] = React.useState<Partial<MyPluginInput>>({});
  const [result, setResult] = React.useState<MyPluginOutput | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/plugins/my-plugin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOnCanvas = async () => {
    if (!result) return;

    const nodeInputs: CreateNodeInput[] = result.items.map((item, index) => ({
      type: 'imageGenerator',
      position: canvas.getGridPosition(index, 3, 320),
      name: item.title,
      data: { prompt: item.prompt },
    }));

    await canvas.createNodes(nodeInputs);
    canvas.fitView();
    notify(`Created ${result.items.length} nodes`, 'success');
    onClose();
  };

  // ... render form, loading state, preview, and create button
}
```

### Step 5: Register the Plugin

```typescript
// src/lib/plugins/official/my-plugin/index.ts
import { pluginRegistry } from '@/lib/plugins/registry';
import type { AgentPlugin } from '@/lib/plugins/types';
import { MyPluginSandbox } from './MyPluginSandbox';

export const myPlugin: AgentPlugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  description: 'Creates nodes from AI-generated content',
  icon: '🔮',
  category: 'planning',
  author: { type: 'official', name: 'GenFlow', verified: true },
  version: '1.0.0',
  visibility: 'public',
  type: 'agent',
  sandbox: {
    component: MyPluginSandbox,
    size: 'large',
    title: 'My Plugin',
  },
  capabilities: ['canvas:create', 'canvas:read'],
  services: ['ai'],
};

// Register on import
pluginRegistry.register(myPlugin);

export { MyPluginSandbox };
```

### Step 6: Import Plugin to Register

Add the import to `NodeToolbar.tsx` to register the plugin:

```typescript
// In src/components/canvas/NodeToolbar.tsx
import '@/lib/plugins/official/my-plugin';
```

## Canvas API Reference

The Canvas API provides safe methods for plugins to interact with the canvas:

```typescript
interface CanvasAPI {
  // Read operations
  getNodes(): AppNode[];
  getSelectedNodes(): AppNode[];
  getEdges(): AppEdge[];

  // Create operations
  createNode(input: CreateNodeInput): Promise<string>;
  createNodes(inputs: CreateNodeInput[]): Promise<string[]>;
  createEdge(fromId: string, fromHandle: string, toId: string, toHandle: string): Promise<string>;

  // Position helpers
  getViewportCenter(): { x: number; y: number };
  getGridPosition(index: number, columns?: number, spacing?: number, startPosition?: { x: number; y: number }): { x: number; y: number };

  // View controls
  focusNode(nodeId: string): void;
  fitView(nodeIds?: string[]): void;
}
```

## AI Service Abstraction

The AI service provides a provider-agnostic interface for structured LLM output:

```typescript
interface AIService {
  generateStructured<T extends z.ZodType>(
    prompt: string,
    schema: T,
    options?: AIServiceOptions
  ): Promise<z.infer<T>>;
}

interface AIServiceOptions {
  systemPrompt?: string;
  model?: string;
  temperature?: number;
}
```

### Swapping Providers

To swap the LLM provider, modify `src/lib/plugins/ai-service/index.ts`:

```typescript
// Current: Mastra
export { MastraAIService as AIService } from './mastra-provider';

// Future option: Vercel AI SDK
// export { VercelAIService as AIService } from './vercel-provider';

// Future option: Direct API
// export { AnthropicDirectService as AIService } from './anthropic-provider';
```

## Plugin Categories

| Category | Description |
|----------|-------------|
| `planning` | Pre-production, storyboards, scripts |
| `brand` | Brand extraction, consistency |
| `adaptation` | Resizing, format conversion |
| `analysis` | Image understanding, reverse prompts |
| `text` | Captions, copy generation |
| `enhancement` | Upscaling, background removal |
| `automation` | Batch processing, templates |
| `export` | Publishing, integrations |

## Plugin Capabilities

| Capability | Description |
|------------|-------------|
| `canvas:read` | Read existing nodes and edges |
| `canvas:create` | Create new nodes |
| `canvas:connect` | Create edges between nodes |
| `canvas:modify` | Modify existing nodes |

## Sandbox Sizes

| Size | Dimensions |
|------|------------|
| `small` | 400px width, 500px max height |
| `medium` | 600px width, 700px max height |
| `large` | 800px width, 85vh max height |
| `fullscreen` | 90vw width, 90vh height |

## Design Decisions

1. **No Node Grouping**: Nodes are positioned visually as a group but not formally grouped. This defers complexity for future implementation.

2. **Manual Generation**: After creating nodes on canvas, users must trigger generation manually (Run All or individual buttons). No auto-generation.

3. **Self-Contained Plugins**: Plugins contain their own schemas, prompts, and UI. The AI service is just the execution layer.

4. **Provider-Agnostic**: Zod schemas are the contract. The AI provider can be swapped without changing plugin code.
