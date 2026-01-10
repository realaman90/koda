# Plugin Architecture

A flexible plugin system that enables users to create custom utility nodes and allows official complex integrations.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PLUGIN SYSTEM                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     PLUGIN REGISTRY                          │   │
│  │   Manages all plugins, provides to Canvas & Execution        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│          ┌───────────────────┼───────────────────┐                 │
│          ▼                   ▼                   ▼                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐           │
│  │    SIMPLE    │   │  TRANSFORM   │   │    AGENT     │           │
│  │    PLUGIN    │   │    PLUGIN    │   │    PLUGIN    │           │
│  │              │   │              │   │              │           │
│  │  • No-code   │   │  • Code      │   │  • Sandbox   │           │
│  │  • UI created│   │  • API-based │   │  • Multi-step│           │
│  │  • AI prompt │   │  • Image ops │   │  • Canvas API│           │
│  └──────────────┘   └──────────────┘   └──────────────┘           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PLUGIN EXECUTOR                           │   │
│  │   Runs plugins based on their type & configuration          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Plugin Types

| Type | Creator | Pattern | Runs As |
|------|---------|---------|---------|
| **Simple** | Anyone (No-Code UI) | Input → AI Prompt → Output | Single node on canvas |
| **Transform** | Official / Developers | Input → API/Processing → Output | Single node on canvas |
| **Agent** | Official only | Interactive → Multi-step → Creates nodes | Opens sandbox modal |

---

## User Problems & Plugin Solutions

### 1. Pre-Production & Planning

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: "I have an idea but need to break it into visual shots"  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has:                        User needs:                       │
│  • A story idea                   • Scene breakdown                 │
│  • A script                       • Shot list                       │
│  • A concept                      • Visual prompts for each shot    │
│                                   • Storyboard                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLUGINS THAT SOLVE THIS:                                    │   │
│  │                                                              │   │
│  │  📝 Script to Scenes      "A hero enters..." → 5 scene cards │   │
│  │  🎬 Shot List Generator   Scene → camera angles, movements   │   │
│  │  🎨 Prompt Crafter        Scene → detailed image prompts     │   │
│  │  📐 Storyboard Layout     Shots → arranged storyboard grid   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Brand Consistency

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: "All my generated images need to match my brand"         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has:                        User needs:                       │
│  • Brand website                  • Extracted brand colors          │
│  • Logo files                     • Consistent style prompts        │
│  • Existing marketing             • Reusable brand "preset"         │
│                                   • Logo overlays                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLUGINS THAT SOLVE THIS:                                    │   │
│  │                                                              │   │
│  │  🎨 Brand Extractor       URL → colors, fonts, tone          │   │
│  │  🏷️ Style Preset Creator  Images → reusable style preset     │   │
│  │  ✨ Brand Prompt Injector Auto-add brand terms to prompts    │   │
│  │  🖼️ Watermark/Logo Adder  Add logo to all outputs            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Multi-Platform Adaptation

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: "I need this image in 5 different sizes for social"      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has:                        User needs:                       │
│  • One hero image                 • Instagram (1:1, 4:5, 9:16)      │
│  • One video                      • YouTube (16:9)                  │
│                                   • TikTok (9:16)                   │
│                                   • Twitter (16:9)                  │
│                                   • LinkedIn (1.91:1)               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLUGINS THAT SOLVE THIS:                                    │   │
│  │                                                              │   │
│  │  📐 Aspect Ratio Converter  1:1 → 9:16 with AI extend        │   │
│  │  📱 Social Media Kit        1 image → all platform sizes     │   │
│  │  ✂️ Smart Crop              Auto-crop to focus on subject    │   │
│  │  🔄 Batch Resizer           Process multiple at once         │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Content Variations & Testing

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: "I need 10 variations of this ad for A/B testing"        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has:                        User needs:                       │
│  • One concept                    • Color variations                │
│  • Base prompt                    • Copy variations                 │
│  • Product image                  • Style variations                │
│                                   • Layout variations               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLUGINS THAT SOLVE THIS:                                    │   │
│  │                                                              │   │
│  │  🎰 Variation Generator     1 prompt → 10 style variations   │   │
│  │  📝 Copy Variants           1 headline → 10 alternatives     │   │
│  │  🎨 Color Swapper           Apply different color schemes    │   │
│  │  🔀 A/B Test Creator        Generate test-ready variants     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Analysis & Understanding

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: "What makes this reference image work? I want similar"   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has:                        User needs:                       │
│  • Reference images               • Style breakdown                 │
│  • Competitor content             • Color analysis                  │
│  • Inspiration folder             • Composition analysis            │
│                                   • Recreate-able prompt            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLUGINS THAT SOLVE THIS:                                    │   │
│  │                                                              │   │
│  │  🔍 Image Analyzer          Image → style, colors, mood      │   │
│  │  📝 Reverse Prompt          Image → detailed prompt          │   │
│  │  🎨 Style Extractor         Image → reusable style preset    │   │
│  │  📊 Composition Analyzer    Image → rule of thirds, etc.     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 6. Text & Copy Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: "I need to add text/copy to my generated images"         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has:                        User needs:                       │
│  • Generated images               • Headlines on images             │
│  • Marketing copy                 • Captions for social             │
│  • Product info                   • Call-to-action overlays         │
│                                   • Localized versions              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLUGINS THAT SOLVE THIS:                                    │   │
│  │                                                              │   │
│  │  ✍️ Text Overlay            Add styled text to images        │   │
│  │  📝 Caption Generator       Image → social media caption     │   │
│  │  🌍 Translator              Localize text in images          │   │
│  │  💬 Quote Card Maker        Text → beautiful quote image     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 7. Product & E-commerce

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: "I need professional product photos without a photoshoot"│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has:                        User needs:                       │
│  • Basic product photos           • Lifestyle context               │
│  • White background shots         • Multiple angles                 │
│  • Product descriptions           • Seasonal variations             │
│                                   • Model holding product           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLUGINS THAT SOLVE THIS:                                    │   │
│  │                                                              │   │
│  │  🛍️ Product Scene Generator  Product → lifestyle setting    │   │
│  │  🔄 Background Swapper       Replace background with AI      │   │
│  │  👤 Model Integration        Add hands/person with product   │   │
│  │  📦 Product Mockup           Place product in mockup scene   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 8. Workflow Automation

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: "I do the same 5 steps every time, can it be automatic?" │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has:                        User needs:                       │
│  • Repetitive workflow            • One-click automation            │
│  • Standard process               • Template workflows              │
│  • Multiple similar projects      • Batch processing                │
│                                   • Scheduled runs                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLUGINS THAT SOLVE THIS:                                    │   │
│  │                                                              │   │
│  │  🔄 Workflow Template        Save & reuse node arrangements  │   │
│  │  📋 Batch Input              CSV/list → run for each row     │   │
│  │  ⏰ Scheduler                Run workflow on schedule        │   │
│  │  🔗 Webhook Trigger          External event → run workflow   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 9. Export & Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: "I need to get my outputs into other tools/platforms"    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has:                        User needs:                       │
│  • Generated content              • Direct post to social          │
│  • Final outputs                  • Export to Figma/Canva          │
│  • Approved assets                • Save to cloud storage          │
│                                   • Send to team/client            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLUGINS THAT SOLVE THIS:                                    │   │
│  │                                                              │   │
│  │  📤 Social Publisher         Direct post to IG/TikTok/etc.   │   │
│  │  🎨 Figma Exporter           Send to Figma project           │   │
│  │  ☁️ Cloud Sync               Auto-save to Drive/Dropbox      │   │
│  │  📧 Share & Deliver          Email/link to stakeholders      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 10. Character & Asset Consistency

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: "My character looks different in every generated image"  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has:                        User needs:                       │
│  • Character concept              • Same character, different poses │
│  • Brand mascot                   • Consistent features across gen  │
│  • Recurring subject              • Character in different scenes   │
│                                   • Character sheet/turnaround      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLUGINS THAT SOLVE THIS:                                    │   │
│  │                                                              │   │
│  │  👤 Character Creator        Build consistent character      │   │
│  │  🎭 Pose Variations          Same character, different poses │   │
│  │  📋 Character Sheet          Generate turnaround/model sheet │   │
│  │  🎬 Character in Scene       Place character in any context  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Problem Categories Summary

| Category | Core Problem | Plugin Type |
|----------|--------------|-------------|
| **Planning** | Idea → Structured visual plan | Simple (AI prompts) |
| **Brand** | Maintain consistency | Agent (E2B + extraction) |
| **Adaptation** | One asset → many formats | Transform (APIs) |
| **Variations** | One concept → many versions | Simple (AI prompts) |
| **Analysis** | Understand existing images | Simple (vision AI) |
| **Text/Copy** | Add/generate text content | Simple (AI prompts) |
| **E-commerce** | Product → professional photos | Transform (APIs) |
| **Automation** | Reduce repetitive work | Agent (system) |
| **Export** | Get content to other places | Transform (APIs) |
| **Consistency** | Same subject across outputs | Advanced (LoRA?) |

---

## Which Problems Can Users Solve with No-Code Plugins?

| Problem | User Can Build? | Why |
|---------|-----------------|-----|
| Script to Scenes | ✅ Yes | Just AI prompting |
| Shot List Generator | ✅ Yes | Just AI prompting |
| Reverse Prompt | ✅ Yes | Image → AI → text |
| Caption Generator | ✅ Yes | Image → AI → text |
| Copy Variants | ✅ Yes | Text → AI → text |
| Quote Card Maker | ⚠️ Partial | Needs text overlay |
| Brand Extractor | ❌ No | Needs E2B sandbox |
| Aspect Ratio Converter | ❌ No | Needs image API |
| Social Publisher | ❌ No | Needs OAuth/APIs |
| Batch Processing | ❌ No | System feature |

---

## Key Insight

Most **AI-powered analysis/generation** plugins can be user-created with just prompts.

Anything requiring **external APIs, file manipulation, or system integration** needs to be official.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   USER-CREATED (Prompt-based)         OFFICIAL (Code-based)        │
│   ─────────────────────────           ─────────────────────        │
│                                                                     │
│   • Analyze image                     • Extract from URL (E2B)     │
│   • Generate text from X              • Resize/crop images         │
│   • Transform text to Y               • Connect to APIs            │
│   • Categorize content                • File format conversion     │
│   • Summarize/expand                  • Publish to platforms       │
│   • Translate                         • Batch operations           │
│   • Extract info from image           • Canvas manipulation        │
│                                                                     │
│   INPUT ──→ AI ──→ OUTPUT             INPUT ──→ CODE ──→ OUTPUT    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### Base Types

```typescript
interface PluginBase {
  id: string;
  name: string;
  description: string;
  icon: string;                    // Emoji or icon name
  category: PluginCategory;
  author: PluginAuthor;
  version: string;
  visibility: 'private' | 'team' | 'public';
}

type PluginCategory =
  | 'planning'        // Pre-production, scripts, storyboards
  | 'brand'           // Brand extraction, style consistency
  | 'adaptation'      // Resizing, format conversion
  | 'analysis'        // Image understanding, reverse prompts
  | 'text'            // Captions, copy, overlays
  | 'enhancement'     // Upscaling, background removal
  | 'automation'      // Batch, templates, scheduling
  | 'export';         // Publishing, integrations

interface PluginAuthor {
  type: 'official' | 'community' | 'user';
  id?: string;
  name: string;
  verified?: boolean;
}
```

### Input/Output/Settings

```typescript
interface PluginInput {
  id: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'json' | 'any';
  required: boolean;
  description?: string;
  placeholder?: string;
  multiline?: boolean;
  multiple?: boolean;
}

interface PluginOutput {
  id: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'json';
  description?: string;
}

interface PluginSetting {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multi-select' | 'slider';
  default: any;
  options?: { label: string; value: any }[];
  min?: number;
  max?: number;
  step?: number;
  showIf?: { setting: string; equals: any };
}
```

---

## Simple Plugin

User-created, AI-powered plugins built via no-code UI.

### Type Definition

```typescript
interface SimplePlugin extends PluginBase {
  type: 'simple';

  inputs: PluginInput[];
  outputs: PluginOutput[];
  settings: PluginSetting[];

  ai: {
    model: 'claude-3.5-sonnet' | 'claude-3-opus' | 'gpt-4o' | 'gpt-4o-mini';
    prompt: string;                // Template with {{variables}}
    systemPrompt?: string;
    outputFormat: 'text' | 'json' | 'markdown';
    outputMapping: Record<string, string>;
  };
}
```

### Example: Script to Scenes

```json
{
  "id": "script-to-scenes",
  "name": "Script to Scenes",
  "description": "Break down a script or story into individual scenes with visual prompts",
  "icon": "🎬",
  "category": "planning",
  "type": "simple",
  "version": "1.0.0",
  "author": {
    "type": "user",
    "id": "user-123",
    "name": "John Doe"
  },
  "visibility": "public",

  "inputs": [
    {
      "id": "script",
      "name": "Script / Story",
      "type": "text",
      "required": true,
      "description": "Your script, story, or concept to break down",
      "multiline": true
    },
    {
      "id": "reference",
      "name": "Visual Reference",
      "type": "image",
      "required": false,
      "description": "Optional reference for visual style"
    }
  ],

  "settings": [
    {
      "id": "sceneCount",
      "name": "Number of Scenes",
      "type": "select",
      "default": "auto",
      "options": [
        { "label": "Auto-detect", "value": "auto" },
        { "label": "3 scenes", "value": "3" },
        { "label": "5 scenes", "value": "5" },
        { "label": "10 scenes", "value": "10" }
      ]
    },
    {
      "id": "style",
      "name": "Visual Style",
      "type": "select",
      "default": "cinematic",
      "options": [
        { "label": "Cinematic", "value": "cinematic" },
        { "label": "Anime", "value": "anime" },
        { "label": "Realistic", "value": "realistic" },
        { "label": "Illustrated", "value": "illustrated" }
      ]
    },
    {
      "id": "includeCamera",
      "name": "Include Camera Directions",
      "type": "boolean",
      "default": true
    }
  ],

  "outputs": [
    {
      "id": "scenes",
      "name": "Scene Breakdown",
      "type": "json"
    },
    {
      "id": "summary",
      "name": "Summary",
      "type": "text"
    }
  ],

  "ai": {
    "model": "claude-3.5-sonnet",
    "prompt": "You are a professional storyboard artist and director.\n\nBreak down this script/story into {{settings.sceneCount}} scenes:\n\n---\n{{inputs.script}}\n---\n\nFor each scene, provide:\n1. Scene number and title\n2. Brief description (what happens)\n3. Visual prompt for image generation ({{settings.style}} style)\n{{#if settings.includeCamera}}4. Camera angle and movement{{/if}}\n5. Mood/lighting\n\n{{#if inputs.reference}}Use the provided reference image as inspiration for the visual style.{{/if}}\n\nReturn as JSON:\n{\n  \"scenes\": [\n    {\n      \"number\": 1,\n      \"title\": \"...\",\n      \"description\": \"...\",\n      \"visualPrompt\": \"...\",\n      \"camera\": \"...\",\n      \"mood\": \"...\"\n    }\n  ],\n  \"summary\": \"Brief overall summary\"\n}",
    "outputFormat": "json",
    "outputMapping": {
      "scenes": "$.scenes",
      "summary": "$.summary"
    }
  }
}
```

### Example: Reverse Prompt

```json
{
  "id": "reverse-prompt",
  "name": "Reverse Prompt",
  "description": "Analyze an image and generate a detailed prompt to recreate it",
  "icon": "🔍",
  "category": "analysis",
  "type": "simple",

  "inputs": [
    {
      "id": "image",
      "name": "Image to Analyze",
      "type": "image",
      "required": true
    }
  ],

  "settings": [
    {
      "id": "detail",
      "name": "Detail Level",
      "type": "select",
      "default": "detailed",
      "options": [
        { "label": "Brief", "value": "brief" },
        { "label": "Detailed", "value": "detailed" },
        { "label": "Exhaustive", "value": "exhaustive" }
      ]
    },
    {
      "id": "includeStyle",
      "name": "Include Style Analysis",
      "type": "boolean",
      "default": true
    },
    {
      "id": "includeColors",
      "name": "Include Color Palette",
      "type": "boolean",
      "default": true
    }
  ],

  "outputs": [
    {
      "id": "prompt",
      "name": "Generated Prompt",
      "type": "text"
    },
    {
      "id": "analysis",
      "name": "Full Analysis",
      "type": "json"
    }
  ],

  "ai": {
    "model": "claude-3.5-sonnet",
    "prompt": "Analyze this image and create a {{settings.detail}} prompt that could recreate it.\n\n{{#if settings.includeStyle}}Include analysis of artistic style, medium, and technique.{{/if}}\n{{#if settings.includeColors}}Include the main color palette.{{/if}}\n\nReturn as JSON:\n{\n  \"prompt\": \"A detailed prompt for image generation...\",\n  \"analysis\": {\n    \"subject\": \"...\",\n    \"style\": \"...\",\n    \"colors\": [...],\n    \"mood\": \"...\",\n    \"composition\": \"...\"\n  }\n}",
    "outputFormat": "json",
    "outputMapping": {
      "prompt": "$.prompt",
      "analysis": "$.analysis"
    }
  }
}
```

### Example: Caption Generator

```json
{
  "id": "caption-generator",
  "name": "Caption Generator",
  "description": "Generate social media captions for images",
  "icon": "💬",
  "category": "text",
  "type": "simple",

  "inputs": [
    {
      "id": "image",
      "name": "Image",
      "type": "image",
      "required": true
    },
    {
      "id": "context",
      "name": "Additional Context",
      "type": "text",
      "required": false,
      "description": "Brand info, campaign details, etc."
    }
  ],

  "settings": [
    {
      "id": "platform",
      "name": "Platform",
      "type": "select",
      "default": "instagram",
      "options": [
        { "label": "Instagram", "value": "instagram" },
        { "label": "Twitter/X", "value": "twitter" },
        { "label": "LinkedIn", "value": "linkedin" },
        { "label": "TikTok", "value": "tiktok" }
      ]
    },
    {
      "id": "tone",
      "name": "Tone",
      "type": "select",
      "default": "casual",
      "options": [
        { "label": "Casual", "value": "casual" },
        { "label": "Professional", "value": "professional" },
        { "label": "Playful", "value": "playful" },
        { "label": "Inspirational", "value": "inspirational" }
      ]
    },
    {
      "id": "includeHashtags",
      "name": "Include Hashtags",
      "type": "boolean",
      "default": true
    },
    {
      "id": "includeEmojis",
      "name": "Include Emojis",
      "type": "boolean",
      "default": true
    }
  ],

  "outputs": [
    {
      "id": "caption",
      "name": "Caption",
      "type": "text"
    },
    {
      "id": "hashtags",
      "name": "Hashtags",
      "type": "text"
    }
  ],

  "ai": {
    "model": "claude-3.5-sonnet",
    "prompt": "Generate a {{settings.tone}} social media caption for {{settings.platform}} based on this image.\n\n{{#if inputs.context}}Context: {{inputs.context}}{{/if}}\n\nRequirements:\n- Platform: {{settings.platform}}\n- Tone: {{settings.tone}}\n{{#if settings.includeEmojis}}- Include relevant emojis{{/if}}\n{{#if settings.includeHashtags}}- Suggest relevant hashtags{{/if}}\n\nReturn as JSON:\n{\n  \"caption\": \"The main caption text...\",\n  \"hashtags\": \"#hashtag1 #hashtag2 ...\"\n}",
    "outputFormat": "json",
    "outputMapping": {
      "caption": "$.caption",
      "hashtags": "$.hashtags"
    }
  }
}
```

---

## Transform Plugin

Official plugins with API integrations for image/video processing.

### Type Definition

```typescript
interface TransformPlugin extends PluginBase {
  type: 'transform';

  inputs: PluginInput[];
  outputs: PluginOutput[];
  settings: PluginSetting[];

  execution: {
    service: TransformService;
    config: Record<string, any>;
  };
}

type TransformService =
  | 'fal-outpaint'        // Aspect ratio with AI extend
  | 'fal-upscale'         // Image upscaling
  | 'fal-remove-bg'       // Background removal
  | 'fal-inpaint'         // Inpainting
  | 'sharp'               // Image processing (resize, format)
  | 'ffmpeg'              // Video processing
  | 'custom';             // Custom handler
```

### Example: Aspect Ratio Converter

```typescript
// src/lib/plugins/official/transform/aspect-ratio.ts

export const aspectRatioConverter: TransformPlugin = {
  id: "aspect-ratio-converter",
  name: "Aspect Ratio Converter",
  description: "Convert images to different aspect ratios with AI-powered extend",
  icon: "📐",
  category: "adaptation",
  type: "transform",
  version: "1.0.0",
  author: {
    type: "official",
    name: "Koda Team",
    verified: true
  },
  visibility: "public",

  inputs: [
    {
      id: "image",
      name: "Source Image",
      type: "image",
      required: true
    }
  ],

  outputs: [
    {
      id: "image",
      name: "Converted Image",
      type: "image"
    }
  ],

  settings: [
    {
      id: "targetRatio",
      name: "Target Ratio",
      type: "select",
      default: "16:9",
      options: [
        { label: "Square (1:1)", value: "1:1" },
        { label: "Landscape (16:9)", value: "16:9" },
        { label: "Portrait (9:16)", value: "9:16" },
        { label: "Classic (4:3)", value: "4:3" },
        { label: "Tall (4:5)", value: "4:5" },
        { label: "Ultra-wide (21:9)", value: "21:9" }
      ]
    },
    {
      id: "method",
      name: "Fill Method",
      type: "select",
      default: "ai-extend",
      options: [
        { label: "AI Extend (Outpaint)", value: "ai-extend" },
        { label: "Smart Crop", value: "crop" },
        { label: "Letterbox (Black bars)", value: "letterbox" },
        { label: "Blur Fill", value: "blur" }
      ]
    }
  ],

  execution: {
    service: "fal-outpaint",
    config: {
      model: "fal-ai/outpaint"
    }
  }
};

// Execution handler
export async function executeAspectRatio(
  ctx: TransformContext
): Promise<TransformResult> {
  const { image } = ctx.inputs;
  const { targetRatio, method } = ctx.settings;

  ctx.onProgress(10, "Analyzing image...");

  if (method === "ai-extend") {
    const result = await ctx.services.fal.run("fal-ai/outpaint", {
      image_url: image,
      target_aspect_ratio: targetRatio,
    });

    ctx.onProgress(90, "Uploading result...");
    const uploadedUrl = await ctx.services.storage.upload(result.image);

    return {
      success: true,
      outputs: { image: uploadedUrl }
    };

  } else if (method === "crop") {
    const cropped = await ctx.services.sharp(image)
      .resize({ aspectRatio: targetRatio, fit: "cover" })
      .toBuffer();

    const uploadedUrl = await ctx.services.storage.upload(cropped);

    return {
      success: true,
      outputs: { image: uploadedUrl }
    };

  } else if (method === "letterbox") {
    const letterboxed = await ctx.services.sharp(image)
      .resize({ aspectRatio: targetRatio, fit: "contain", background: "#000000" })
      .toBuffer();

    const uploadedUrl = await ctx.services.storage.upload(letterboxed);

    return {
      success: true,
      outputs: { image: uploadedUrl }
    };
  }

  throw new Error(`Unknown method: ${method}`);
}
```

### Example: Background Remover

```typescript
export const backgroundRemover: TransformPlugin = {
  id: "background-remover",
  name: "Background Remover",
  description: "Remove background from images using AI",
  icon: "✂️",
  category: "enhancement",
  type: "transform",
  version: "1.0.0",
  author: {
    type: "official",
    name: "Koda Team",
    verified: true
  },
  visibility: "public",

  inputs: [
    {
      id: "image",
      name: "Source Image",
      type: "image",
      required: true
    }
  ],

  outputs: [
    {
      id: "image",
      name: "Image (No Background)",
      type: "image"
    },
    {
      id: "mask",
      name: "Mask",
      type: "image"
    }
  ],

  settings: [
    {
      id: "outputFormat",
      name: "Output Format",
      type: "select",
      default: "png",
      options: [
        { label: "PNG (Transparent)", value: "png" },
        { label: "WebP (Transparent)", value: "webp" }
      ]
    },
    {
      id: "refinement",
      name: "Edge Refinement",
      type: "select",
      default: "normal",
      options: [
        { label: "Fast", value: "fast" },
        { label: "Normal", value: "normal" },
        { label: "High Quality", value: "high" }
      ]
    }
  ],

  execution: {
    service: "fal-remove-bg",
    config: {
      model: "fal-ai/remove-bg"
    }
  }
};
```

---

## Agent Plugin

Official interactive plugins that open a sandbox and can manipulate the canvas.

### Type Definition

```typescript
interface AgentPlugin extends PluginBase {
  type: 'agent';

  sandbox: {
    component: string;             // Path to React component
    size: 'small' | 'medium' | 'large' | 'fullscreen';
    title: string;
  };

  capabilities: AgentCapability[];
  services: AgentService[];
}

type AgentCapability =
  | 'canvas:read'         // Read existing nodes
  | 'canvas:create'       // Create new nodes
  | 'canvas:connect'      // Create edges
  | 'canvas:group'        // Group nodes
  | 'canvas:modify'       // Modify existing nodes
  | 'storage:upload'      // Upload files
  | 'storage:download';   // Download files

type AgentService =
  | 'ai'                  // AI generation/analysis
  | 'e2b'                 // E2B browser sandbox
  | 'storage'             // File storage
  | 'external-api';       // External API calls
```

### Canvas API (Available to Agents)

```typescript
interface CanvasAPI {
  // Read
  getNodes(): CanvasNode[];
  getSelectedNodes(): CanvasNode[];
  getEdges(): CanvasEdge[];

  // Create
  createNode(input: CreateNodeInput): Promise<string>;
  createNodes(inputs: CreateNodeInput[]): Promise<string[]>;
  createEdge(from: string, fromHandle: string, to: string, toHandle: string): Promise<string>;
  createGroup(nodeIds: string[], label: string): Promise<string>;

  // Position helpers
  getViewportCenter(): { x: number; y: number };
  getGridPosition(index: number, columns?: number): { x: number; y: number };

  // Focus
  focusNode(nodeId: string): void;
  fitView(nodeIds?: string[]): void;
}

interface CreateNodeInput {
  type: string;                    // 'text', 'media', 'imageGenerator', etc.
  position?: { x: number; y: number };
  data: Record<string, unknown>;
  label?: string;
}
```

### Example: Brand Extractor Agent

```typescript
// src/lib/plugins/official/agents/brand-extractor/index.ts

export const brandExtractorAgent: AgentPlugin = {
  id: "brand-extractor",
  name: "Brand Extractor",
  description: "Extract brand colors, fonts, and style from websites or images",
  icon: "🎨",
  category: "brand",
  type: "agent",
  version: "1.0.0",
  author: {
    type: "official",
    name: "Koda Team",
    verified: true
  },
  visibility: "public",

  sandbox: {
    component: "@official/agents/brand-extractor/Sandbox",
    size: "large",
    title: "Brand Extractor"
  },

  capabilities: [
    "canvas:create",
    "canvas:group",
    "storage:upload"
  ],

  services: ["ai", "e2b", "storage"]
};
```

### Brand Extractor Sandbox Component

```tsx
// src/lib/plugins/official/agents/brand-extractor/Sandbox.tsx

interface BrandExtractionResult {
  brandName?: string;
  colors: {
    hex: string;
    name: string;
    role: 'primary' | 'secondary' | 'accent' | 'neutral';
    source: 'css-variable' | 'computed' | 'analyzed';
  }[];
  fonts: {
    family: string;
    weights: string[];
    role: 'heading' | 'body' | 'accent';
    source: 'stylesheet' | 'analyzed';
  }[];
  logo: {
    url: string;
    type: 'svg' | 'png' | 'ico';
    location: 'header' | 'favicon' | 'og-image';
  } | null;
  toneOfVoice: {
    description: string;
    keywords: string[];
    examples: string[];
  };
  promptTemplate: string;
}

export function BrandExtractorSandbox({
  canvas,
  services,
  onClose,
  notify
}: AgentSandboxProps) {
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<BrandExtractionResult | null>(null);
  const [selectedOutputs, setSelectedOutputs] = useState({
    colors: true,
    fonts: true,
    logo: true,
    styleGuide: true,
    promptTemplate: true
  });

  // Extract from URL using E2B
  async function extractFromUrl(url: string) {
    const extracted = await services.e2b.run('puppeteer', `
      const puppeteer = require('puppeteer');

      async function extract() {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto('${url}', { waitUntil: 'networkidle2' });

        // Extract CSS colors
        const colors = await page.evaluate(() => {
          const styles = getComputedStyle(document.documentElement);
          const cssVars = [];
          for (const prop of styles) {
            if (prop.startsWith('--') && styles.getPropertyValue(prop).match(/#|rgb/)) {
              cssVars.push({
                variable: prop,
                value: styles.getPropertyValue(prop).trim()
              });
            }
          }
          return cssVars;
        });

        // Extract fonts
        const fonts = await page.evaluate(() => {
          const fontLinks = Array.from(document.querySelectorAll('link[href*="fonts"]'));
          return fontLinks.map(l => l.href);
        });

        // Extract logos
        const logos = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return imgs
            .filter(img => /logo|brand/i.test(img.src + img.alt + img.className))
            .map(img => ({ src: img.src, alt: img.alt }));
        });

        // Take screenshot
        const screenshot = await page.screenshot({ encoding: 'base64' });

        await browser.close();

        return { colors, fonts, logos, screenshot };
      }

      extract();
    `);

    return extracted;
  }

  // Main extraction handler
  async function handleExtract() {
    setIsExtracting(true);

    try {
      let rawData;

      if (mode === 'url') {
        // Use E2B to scrape website
        rawData = await extractFromUrl(url);
      } else {
        // Upload files for analysis
        const uploadedUrls = await Promise.all(
          files.map(f => services.storage.upload(f))
        );
        rawData = { images: uploadedUrls };
      }

      // Analyze with AI
      const analysis = await services.ai.generate({
        model: 'claude-3.5-sonnet',
        prompt: `Analyze this brand data and extract:
          1. Color palette with roles (primary, secondary, accent, neutral)
          2. Typography (fonts, weights, usage)
          3. Tone of voice (professional? playful? technical?)
          4. Generate a prompt template for creating on-brand images

          Data: ${JSON.stringify(rawData)}

          Return as JSON matching BrandExtractionResult schema.`,
        images: rawData.screenshot ? [rawData.screenshot] : rawData.images
      });

      setResult(JSON.parse(analysis));

    } catch (error) {
      notify(`Extraction failed: ${error.message}`, 'error');
    } finally {
      setIsExtracting(false);
    }
  }

  // Create nodes on canvas
  async function handleCreateNodes() {
    if (!result) return;

    const center = canvas.getViewportCenter();
    const createdNodeIds: string[] = [];
    let index = 0;

    // Color palette node
    if (selectedOutputs.colors && result.colors.length > 0) {
      const position = canvas.getGridPosition(index++, 2);
      const content = result.colors
        .map(c => `${c.role.toUpperCase()}: ${c.hex} (${c.name})`)
        .join('\n');

      const nodeId = await canvas.createNode({
        type: 'text',
        position: { x: center.x + position.x, y: center.y + position.y },
        data: { content },
        label: 'Brand Colors'
      });
      createdNodeIds.push(nodeId);
    }

    // Fonts node
    if (selectedOutputs.fonts && result.fonts.length > 0) {
      const position = canvas.getGridPosition(index++, 2);
      const content = result.fonts
        .map(f => `${f.role}: ${f.family} (${f.weights.join(', ')})`)
        .join('\n');

      const nodeId = await canvas.createNode({
        type: 'text',
        position: { x: center.x + position.x, y: center.y + position.y },
        data: { content },
        label: 'Brand Typography'
      });
      createdNodeIds.push(nodeId);
    }

    // Logo node
    if (selectedOutputs.logo && result.logo) {
      const position = canvas.getGridPosition(index++, 2);
      const nodeId = await canvas.createNode({
        type: 'media',
        position: { x: center.x + position.x, y: center.y + position.y },
        data: { url: result.logo.url, type: 'image' },
        label: 'Brand Logo'
      });
      createdNodeIds.push(nodeId);
    }

    // Style guide node
    if (selectedOutputs.styleGuide && result.toneOfVoice) {
      const position = canvas.getGridPosition(index++, 2);
      const content = `TONE OF VOICE\n${result.toneOfVoice.description}\n\nKEYWORDS\n${result.toneOfVoice.keywords.join(', ')}`;

      const nodeId = await canvas.createNode({
        type: 'text',
        position: { x: center.x + position.x, y: center.y + position.y },
        data: { content },
        label: 'Brand Style Guide'
      });
      createdNodeIds.push(nodeId);
    }

    // Prompt template node
    if (selectedOutputs.promptTemplate && result.promptTemplate) {
      const position = canvas.getGridPosition(index++, 2);
      const nodeId = await canvas.createNode({
        type: 'text',
        position: { x: center.x + position.x, y: center.y + position.y },
        data: { content: result.promptTemplate },
        label: 'Brand Prompt Template'
      });
      createdNodeIds.push(nodeId);
    }

    // Group all nodes
    if (createdNodeIds.length > 1) {
      await canvas.createGroup(
        createdNodeIds,
        `Brand: ${result.brandName || 'Extracted'}`
      );
    }

    canvas.fitView(createdNodeIds);
    notify(`Created ${createdNodeIds.length} nodes`, 'success');
    onClose();
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          🎨 Brand Extractor
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!result ? (
          /* Extraction Form */
          <div className="space-y-6">
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode('url')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  mode === 'url'
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <div className="text-2xl mb-2">🌐</div>
                <div className="font-medium">Website URL</div>
                <div className="text-sm text-zinc-400">Extract from live site</div>
              </button>
              <button
                onClick={() => setMode('upload')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  mode === 'upload'
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <div className="text-2xl mb-2">📁</div>
                <div className="font-medium">Upload Files</div>
                <div className="text-sm text-zinc-400">Analyze images</div>
              </button>
            </div>

            {/* URL Input */}
            {mode === 'url' && (
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full p-4 bg-zinc-800 border border-zinc-700 rounded-xl"
              />
            )}

            {/* File Upload */}
            {mode === 'upload' && (
              <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="text-4xl mb-2">📁</div>
                  <div>Drop images or click to upload</div>
                  <div className="text-sm text-zinc-400">
                    Logos, screenshots, marketing materials
                  </div>
                </label>
              </div>
            )}

            {/* Extract Button */}
            <button
              onClick={handleExtract}
              disabled={isExtracting || (mode === 'url' ? !url : files.length === 0)}
              className="w-full py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-xl font-medium"
            >
              {isExtracting ? '🔄 Extracting...' : '🚀 Extract Brand'}
            </button>
          </div>
        ) : (
          /* Results */
          <div className="space-y-6">
            {/* Colors */}
            <div className="p-4 bg-zinc-800 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">🎨 Colors</h3>
                <input
                  type="checkbox"
                  checked={selectedOutputs.colors}
                  onChange={(e) => setSelectedOutputs(s => ({ ...s, colors: e.target.checked }))}
                />
              </div>
              <div className="flex gap-2">
                {result.colors.map((color, i) => (
                  <div key={i} className="text-center">
                    <div
                      className="w-12 h-12 rounded-lg mb-1"
                      style={{ backgroundColor: color.hex }}
                    />
                    <div className="text-xs text-zinc-400">{color.role}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fonts */}
            <div className="p-4 bg-zinc-800 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">🔤 Typography</h3>
                <input
                  type="checkbox"
                  checked={selectedOutputs.fonts}
                  onChange={(e) => setSelectedOutputs(s => ({ ...s, fonts: e.target.checked }))}
                />
              </div>
              {result.fonts.map((font, i) => (
                <div key={i} className="text-sm">
                  <span className="text-zinc-400">{font.role}:</span> {font.family}
                </div>
              ))}
            </div>

            {/* Logo */}
            {result.logo && (
              <div className="p-4 bg-zinc-800 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">🖼 Logo</h3>
                  <input
                    type="checkbox"
                    checked={selectedOutputs.logo}
                    onChange={(e) => setSelectedOutputs(s => ({ ...s, logo: e.target.checked }))}
                  />
                </div>
                <img src={result.logo.url} alt="Logo" className="h-16 object-contain" />
              </div>
            )}

            {/* Tone of Voice */}
            <div className="p-4 bg-zinc-800 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">💬 Tone of Voice</h3>
                <input
                  type="checkbox"
                  checked={selectedOutputs.styleGuide}
                  onChange={(e) => setSelectedOutputs(s => ({ ...s, styleGuide: e.target.checked }))}
                />
              </div>
              <p className="text-sm text-zinc-300">{result.toneOfVoice.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {result.toneOfVoice.keywords.map((kw, i) => (
                  <span key={i} className="px-2 py-1 bg-zinc-700 rounded text-xs">{kw}</span>
                ))}
              </div>
            </div>

            {/* Create Nodes Button */}
            <button
              onClick={handleCreateNodes}
              className="w-full py-4 bg-teal-600 hover:bg-teal-500 rounded-xl font-medium"
            >
              ✨ Create {Object.values(selectedOutputs).filter(Boolean).length} Nodes on Canvas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Database Schema

```sql
-- Plugins table
CREATE TABLE plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('simple', 'transform', 'agent')),

  -- Full configuration (JSON)
  config JSONB NOT NULL,

  -- Author
  author_type TEXT NOT NULL CHECK (author_type IN ('official', 'community', 'user')),
  author_id UUID REFERENCES users(id),
  author_name TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,

  -- Visibility
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  team_id UUID REFERENCES teams(id),

  -- Stats
  version TEXT DEFAULT '1.0.0',
  installs INTEGER DEFAULT 0,
  rating DECIMAL(2,1),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- User installed plugins
CREATE TABLE user_plugins (
  user_id UUID NOT NULL REFERENCES users(id),
  plugin_id UUID NOT NULL REFERENCES plugins(id),
  enabled BOOLEAN DEFAULT true,
  settings_override JSONB,
  installed_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, plugin_id)
);

-- Plugin ratings
CREATE TABLE plugin_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id),
  user_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (plugin_id, user_id)
);

-- Indexes
CREATE INDEX idx_plugins_category ON plugins(category);
CREATE INDEX idx_plugins_type ON plugins(type);
CREATE INDEX idx_plugins_author ON plugins(author_type, author_id);
CREATE INDEX idx_plugins_visibility ON plugins(visibility);
CREATE INDEX idx_plugins_status ON plugins(status);
```

---

## File Structure

```
src/lib/plugins/
├── types.ts                     # All type definitions
├── registry.ts                  # Plugin registry
├── executor/
│   ├── index.ts                 # Main executor
│   ├── simple.ts                # Simple plugin executor
│   ├── transform.ts             # Transform plugin executor
│   └── context.ts               # Execution context
├── template/
│   ├── parser.ts                # {{variable}} parser
│   └── conditionals.ts          # {{#if}} handler
├── validation/
│   ├── schema.ts                # Zod schemas
│   └── validate.ts              # Plugin validation
│
├── official/                    # Official plugins
│   ├── index.ts                 # Register all official
│   │
│   ├── simple/                  # Pre-built simple plugins
│   │   ├── reverse-prompt.ts
│   │   └── caption-generator.ts
│   │
│   ├── transform/               # Transform plugins
│   │   ├── aspect-ratio.ts
│   │   ├── background-remover.ts
│   │   ├── upscaler.ts
│   │   └── watermark.ts
│   │
│   └── agents/                  # Agent plugins
│       ├── brand-extractor/
│       │   ├── index.ts
│       │   ├── Sandbox.tsx
│       │   └── e2b-script.ts
│       ├── social-media-kit/
│       │   ├── index.ts
│       │   └── Sandbox.tsx
│       └── batch-processor/
│           ├── index.ts
│           └── Sandbox.tsx
│
├── hooks/
│   ├── usePlugin.ts
│   ├── usePlugins.ts
│   ├── usePluginExecution.ts
│   └── useAgentSandbox.ts
│
└── api/
    ├── create.ts
    ├── update.ts
    ├── delete.ts
    ├── install.ts
    └── execute.ts

src/components/plugins/
├── PluginNode.tsx               # Render plugin as canvas node
├── PluginSettings.tsx           # Settings panel for plugins
├── PluginStore/                 # Browse & install
│   ├── index.tsx
│   ├── PluginCard.tsx
│   ├── PluginDetails.tsx
│   └── CategoryFilter.tsx
├── PluginCreator/               # No-code plugin builder
│   ├── index.tsx
│   ├── steps/
│   │   ├── BasicInfo.tsx
│   │   ├── Inputs.tsx
│   │   ├── Settings.tsx
│   │   ├── Prompt.tsx
│   │   ├── Outputs.tsx
│   │   └── Preview.tsx
│   └── PromptEditor.tsx
└── AgentSandbox/
    ├── index.tsx                # Sandbox modal wrapper
    └── CanvasAPI.tsx            # Canvas API provider
```

---

## Summary

| Type | Creator | How It Works | Examples |
|------|---------|--------------|----------|
| **Simple** | Anyone via UI | Input → AI Prompt → Output | Script to Scenes, Reverse Prompt, Caption Generator |
| **Transform** | Official | Input → API/Code → Output | Aspect Ratio, Background Remover, Upscaler |
| **Agent** | Official | Interactive sandbox → Creates nodes | Brand Extractor, Social Media Kit, Batch Processor |

---

## What Users Can Create (No-Code)

Any plugin that follows this pattern:
```
Text/Image Input → AI Analysis/Generation → Text/JSON Output
```

Examples:
- Analyze image and extract information
- Generate text from prompts
- Transform text to another format
- Categorize or tag content
- Summarize or expand content
- Translate content

## What Requires Official Plugins

- Image manipulation (resize, crop, format conversion)
- External API integrations (social media, cloud storage)
- File processing (video, audio)
- Complex multi-step workflows
- Canvas manipulation (creating multiple nodes)
- Browser automation (E2B)
