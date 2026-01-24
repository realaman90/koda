# Plugin Foundation

A minimal, focused guide for the plugin system. Covers what you actually need now.

---

## Template vs Plugin: The Key Distinction

| Aspect | Template | Plugin |
|--------|----------|--------|
| **What it is** | Pre-arranged canvas (nodes + edges) | Code that DOES something |
| **User effort** | User fills in the blanks manually | System does the work |
| **Dynamic?** | No - static starting point | Yes - generates/processes |
| **AI involved?** | No (just layout) | Yes (generates content) |
| **Creates nodes?** | Loaded from file | Created programmatically |

### When to Use Each

**Use a Template when:**
- You want a reusable canvas layout
- User fills in their own prompts
- No AI processing needed
- Example: "5-panel storyboard layout" (empty nodes arranged in a grid)

**Use a Plugin when:**
- System generates content based on input
- AI processes/creates something
- Multiple nodes created dynamically
- Example: "Storyboard Generator" (AI creates prompts from a concept)

---

## Your Storyboard Use Case: It's a Plugin

```
User Provides:                    System Creates:
┌─────────────────┐              ┌─────────────────────────────────┐
│ • Product       │              │  5-6 ImageGenerator nodes       │
│ • Character     │  ─────────►  │  Each with AI-written prompt    │
│ • Starting idea │              │  Connected to shared references │
│                 │              │  Arranged in storyboard grid    │
└─────────────────┘              └─────────────────────────────────┘
```

This is an **Agent Plugin** because:
1. Takes user input (product, character, concept)
2. Uses AI to generate scene prompts
3. Creates multiple nodes on canvas
4. Arranges them in a grid layout
5. Connects shared references (character, product)

A Template would just give you empty boxes. A Plugin fills them intelligently.

---

## The Three Plugin Types (Simplified)

| Type | Builds? | Creates Nodes? | Use Case |
|------|---------|----------------|----------|
| **Simple** | Anyone | No (single node) | Text/image analysis |
| **Transform** | Official | No (single node) | Image processing |
| **Agent** | Official | Yes (multi-node) | Workflow generation |

For the storyboard feature: **Agent Plugin**

---

## Storyboard Generator Plugin Spec

### Definition

```typescript
const storyboardGenerator: AgentPlugin = {
  id: "storyboard-generator",
  name: "Storyboard Generator",
  description: "Create a complete storyboard from a concept",
  icon: "🎬",
  category: "planning",
  type: "agent",

  sandbox: {
    component: "StoryboardSandbox",
    size: "large",
    title: "Create Storyboard"
  },

  capabilities: [
    "canvas:create",   // Create nodes
    "canvas:connect",  // Create edges
    "canvas:group"     // Group the storyboard
  ],

  services: ["ai"]     // Uses AI to generate prompts
};
```

### User Flow

```
┌──────────────────────────────────────────────────────────────┐
│  STORYBOARD GENERATOR                                    [X] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Product/Subject                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ A sleek wireless headphone, matte black finish         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Character (optional)                                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Young professional, early 30s, casual-smart attire     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Concept/Story                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Show the journey from morning commute chaos to         │ │
│  │ peaceful focus while working, ending with enjoyment    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Scenes: [4] [5] [6] [8]        Style: [Cinematic ▼]        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              🎬 Generate Storyboard                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### What It Creates on Canvas

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STORYBOARD: Headphone Journey                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                          │
│  │ Product  │    │Character │    │  Style   │                          │
│  │  [IMG]   │    │  [TXT]   │    │  [TXT]   │   ◄── Shared References  │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘                          │
│       │               │               │                                 │
│       └───────────────┼───────────────┘                                 │
│                       │                                                 │
│       ┌───────────────┼───────────────┬───────────────┐                │
│       ▼               ▼               ▼               ▼                │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│  │ Scene 1 │    │ Scene 2 │    │ Scene 3 │    │ Scene 4 │             │
│  │         │    │         │    │         │    │         │             │
│  │ "Crowded│    │ "Puts on│    │ "Deep   │    │ "Smiling│             │
│  │ subway, │    │ headpho-│    │ focus   │    │ walking │             │
│  │ chaos"  │    │ nes..." │    │ at desk"│    │ sunset" │             │
│  │         │    │         │    │         │    │         │             │
│  │ [GEN]   │    │ [GEN]   │    │ [GEN]   │    │ [GEN]   │             │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘             │
│                                                                         │
│  Scene prompts auto-generated, ready to generate images                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Logic

```typescript
async function generateStoryboard(
  canvas: CanvasAPI,
  services: { ai: AIService },
  input: {
    product: string;
    character?: string;
    concept: string;
    sceneCount: number;
    style: string;
  }
) {
  // 1. AI generates scene breakdown
  const scenes = await services.ai.generate({
    prompt: `
      Create a ${input.sceneCount}-scene storyboard for:
      Product: ${input.product}
      ${input.character ? `Character: ${input.character}` : ''}
      Concept: ${input.concept}
      Style: ${input.style}

      For each scene, provide:
      - title: Brief scene title
      - prompt: Detailed image generation prompt
      - camera: Camera angle/shot type
      - mood: Lighting/atmosphere

      Return as JSON array.
    `
  });

  // 2. Create reference nodes
  const center = canvas.getViewportCenter();

  const productNode = await canvas.createNode({
    type: 'text',
    position: { x: center.x, y: center.y - 200 },
    data: { content: input.product },
    label: 'Product Reference'
  });

  const characterNode = input.character
    ? await canvas.createNode({
        type: 'text',
        position: { x: center.x + 300, y: center.y - 200 },
        data: { content: input.character },
        label: 'Character Reference'
      })
    : null;

  // 3. Create scene nodes in a grid
  const sceneNodes: string[] = [];
  const columns = Math.ceil(Math.sqrt(input.sceneCount));

  for (let i = 0; i < scenes.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);

    const nodeId = await canvas.createNode({
      type: 'imageGenerator',
      position: {
        x: center.x + (col * 320) - ((columns - 1) * 160),
        y: center.y + (row * 400)
      },
      data: {
        prompt: scenes[i].prompt,
        model: 'flux-pro',
        aspectRatio: '16:9'
      },
      label: `Scene ${i + 1}: ${scenes[i].title}`
    });

    sceneNodes.push(nodeId);

    // Connect to references
    await canvas.createEdge(productNode, 'output', nodeId, 'reference-0');
    if (characterNode) {
      await canvas.createEdge(characterNode, 'output', nodeId, 'reference-1');
    }
  }

  // 4. Group everything
  await canvas.createGroup(
    [productNode, characterNode, ...sceneNodes].filter(Boolean),
    `Storyboard: ${input.concept.slice(0, 30)}...`
  );

  // 5. Fit view to show all
  canvas.fitView();
}
```

---

## Other Immediate Official Plugins

### 1. Social Media Kit (Agent)

**Problem**: "I have one hero image, need it in 5 platform sizes"

```
Input: 1 image
Output: 5 nodes with different aspect ratios
        - Instagram Square (1:1)
        - Instagram Story (9:16)
        - YouTube Thumbnail (16:9)
        - Twitter Header (3:1)
        - LinkedIn Post (1.91:1)
```

### 2. Character Sheet (Agent)

**Problem**: "I need my character in multiple poses/angles"

```
Input: Character description + reference image
Output: 4-6 nodes showing:
        - Front view
        - 3/4 view
        - Side profile
        - Back view
        - Expression variations
```

### 3. Product Showcase (Agent)

**Problem**: "I need product shots in different contexts"

```
Input: Product image + description
Output: 5 nodes with prompts:
        - Hero shot (clean background)
        - Lifestyle context
        - In-use scenario
        - Detail/close-up
        - Scale reference (with hands/objects)
```

---

## What About Simple Plugins?

Simple plugins are single-node utilities. Good for MVP too:

| Plugin | Input | Output |
|--------|-------|--------|
| **Reverse Prompt** | Image | Text (prompt to recreate) |
| **Caption Generator** | Image | Text (social caption) |
| **Prompt Enhancer** | Basic prompt | Detailed prompt |
| **Style Analyzer** | Image | JSON (colors, mood, style) |

These already exist as utilities - just need to package as plugins.

---

## MVP Scope

### Phase 1: Core Infrastructure
- Plugin registry (load/list plugins)
- Plugin execution context
- Agent sandbox modal
- Canvas API for agents

### Phase 2: First Official Plugins
1. **Storyboard Generator** (your use case)
2. **Prompt Enhancer** (already exists, needs wrapping)
3. **Reverse Prompt** (image → prompt)

### Phase 3: User-Created Simple Plugins
- No-code plugin builder UI
- Prompt template editor
- Plugin gallery (browse/install)

---

## Decision Summary

| Your Storyboard Feature | Answer |
|-------------------------|--------|
| Template or Plugin? | **Plugin** (Agent type) |
| Why? | Creates nodes dynamically with AI-generated prompts |
| Complexity | Medium - needs Agent sandbox + Canvas API |
| Dependencies | AI service, Canvas manipulation |

The storyboard is not a template because templates are static. You want AI to generate scene prompts based on the user's specific product/character/concept - that's inherently dynamic and requires a plugin.
