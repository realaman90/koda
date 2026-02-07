# KODA Animation System — Complete Technical Specification

> Detailed architecture and design specification for the Animation Generator system, covering agent design, tool system, sandbox architecture, and deployment modes.

---

## Table of Contents

1. [Animation Agent Architecture](#part-1-animation-agent-architecture)
2. [Tool System Design](#part-2-tool-system-design)
3. [Sandbox Architecture](#part-3-sandbox-architecture)
4. [Self-Hosted Deployment](#part-4-self-hosted-deployment)
5. [Cloud Deployment](#part-5-cloud-deployment)
6. [Data Flow & State Management](#part-6-data-flow--state-management)
7. [Rendering Pipeline](#part-7-rendering-pipeline)
8. [Session, Persistence & Checkpointing](#part-8-session-persistence--checkpointing)
9. [Plugin Integration](#part-9-plugin-integration)
10. [Mastra Agent Implementation](#part-10-mastra-agent-implementation)
10. [Mastra Agent Implementation](#part-10-mastra-agent-implementation)

---

# Part 1: Animation Agent Architecture

## 1.1 Agent Overview

The Animation Agent is an LLM-powered system that transforms natural language descriptions into production-quality Theatre.js animations. It operates as a multi-phase conversational agent with tool-use capabilities.

### Core Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│                      Animation Agent                            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Interpret  │  │    Plan     │  │        Execute          │ │
│  │             │  │             │  │                         │ │
│  │ Understand  │  │ Break into  │  │ Generate Theatre.js     │ │
│  │ user intent │  │ scenes      │  │ code, write files,      │ │
│  │ + style     │  │ + timing    │  │ run in sandbox          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Iterate   │  │   Render    │  │       Deliver           │ │
│  │             │  │             │  │                         │ │
│  │ Modify code │  │ Trigger     │  │ Return final video      │ │
│  │ based on    │  │ Puppeteer + │  │ URL to user             │ │
│  │ feedback    │  │ FFmpeg      │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 Agent Phases Detailed

### Phase 1: Intent Analysis & Clarification

**Purpose**: Determine if the user's request is clear enough to proceed, or if clarification is needed.

**Decision Logic**:

```
INPUT: User prompt (e.g., "Create a bouncing ball animation")

ANALYSIS:
├── Is the subject clear?
│   └── "bouncing ball" → YES
├── Is the style specified or inferrable?
│   └── "bouncing" implies playful → INFERRABLE
├── Is duration specified?
│   └── Not specified → USE DEFAULT (5-10s for simple)
├── Are there technical requirements?
│   └── None specified → STANDARD

DECISION: Style is inferrable but not explicit
ACTION: Ask style clarification question
```

**When to Skip Question**:
- User specifies style explicitly: "smooth, minimal bouncing ball"
- User provides reference: "like the Stripe website animations"
- User's prompt is highly specific: "ball bounces 3 times with easeOutBack, squash on landing"

**Question Generation Strategy**:

The agent generates ONE focused question. Questions should:
- Be mutually exclusive options
- Map directly to animation parameters
- Include an "other" option with free text

**Style-to-Parameters Mapping**:

| Style | Easing | Motion | Timing |
|-------|--------|--------|--------|
| Playful & bouncy | easeOutBack, easeOutElastic | Overshoot, squash-stretch | Fast, snappy |
| Smooth & minimal | easeInOutCubic, easeOutQuint | Subtle, flowing | Slower, deliberate |
| Cinematic & dramatic | easeInOutQuart, custom bezier | Camera moves, depth | Building tension |

---

### Phase 2: Animation Planning

**Purpose**: Create a structured plan the user can review before execution begins.

**Planning Process**:

```
INPUT: 
- User prompt: "Create a bouncing ball animation"
- Style: "Playful & bouncy"

PLANNING STEPS:

1. DECOMPOSE INTO SCENES
   ├── What are the distinct visual moments?
   ├── What's the narrative arc (if any)?
   └── Where are natural transition points?

2. ASSIGN TIMING
   ├── How long should each scene be?
   ├── What's the total duration?
   └── Where should emphasis/pauses be?

3. DESCRIBE ANIMATIONS
   ├── What elements move in each scene?
   ├── What easing/technique for each movement?
   └── How do elements enter/exit?

OUTPUT:
Scene 1 — Intro (0:00–0:02)
  Ball fades in from center, soft bounce with easeOutBack
  
Scene 2 — Loop (0:02–0:04)  
  Continuous bounce cycle, shadow scales with height
  
Scene 3 — Outro (0:04–0:05)
  Ball settles with squash effect, fade out
```

**Scene Structure Rules**:

1. **Minimum scene duration**: 1.5 seconds (enough for animation + hold)
2. **Maximum scenes**: 5-7 for videos under 30s, 10-15 for longer
3. **Overlap allowed**: Scenes can have overlapping elements
4. **Every scene needs**: Entry animation, hold time, exit animation

**Todo Generation**:

From the plan, the agent generates a todo list that will be tracked during execution:

```
Todos (derived from plan):
1. Set up Theatre.js project
2. Create Scene 1 (Intro) keyframes
3. Create Scene 2 (Loop) keyframes  
4. Create Scene 3 (Outro) keyframes
5. Add post-processing (shadows, etc.)
6. Render preview
```

---

### Phase 3: Execution

**Purpose**: Generate Theatre.js code and run it in a sandbox environment.

**Execution Strategy**:

The agent follows a strict pattern for code generation:

```
EXECUTION LOOP:

FOR EACH todo:
    1. SIGNAL: Update todo status to "active"
    2. THINK: Determine what code/files needed
    3. GENERATE: Write complete, working code
    4. WRITE: Use sandbox_write_file tool
    5. SIGNAL: Update thinking message
    6. SIGNAL: Update todo status to "done"

AFTER ALL todos:
    1. RUN: Install dependencies if needed
    2. RUN: Start development server
    3. WAIT: Server ready
    4. RENDER: Generate preview video
    5. SIGNAL: Transition to preview state
```

**Code Generation Principles**:

1. **Complete files only**: Never write partial code or placeholders
2. **Follow Theatre.js patterns**: Use patterns from SYSTEM_INSTRUCTIONS exactly
3. **Deterministic rendering**: All animation state derived from currentTime
4. **Self-contained**: Each file should work without modifications

**File Generation Order**:

```
1. package.json (if not using template)
2. vite.config.ts
3. src/theatre/project.ts (SEQUENCE_TIMINGS, duration, fps)
4. src/utils/easing.ts (easing functions)
5. src/components/*.tsx (animation components)
6. src/scenes/MainScene.tsx (scene compositor)
7. src/App.tsx (root component)
8. src/main.tsx (entry point)
9. scripts/export-video.cjs (render script)
```

---

### Phase 4: Iteration

**Purpose**: Handle user feedback during or after execution without starting over.

**Iteration Triggers**:

1. User sends message during execution
2. User rejects preview with feedback
3. User asks for modifications after completion

**Iteration Strategy**:

```
INPUT:
- User feedback: "Make the bounce higher"
- Current project files: { ... }
- Execution state: { todos, messages }

ANALYSIS:
├── What needs to change?
│   └── Bounce height parameter
├── Which files are affected?
│   └── src/components/BouncingBall.tsx
├── Is structural change needed?
│   └── NO, just parameter adjustment
└── Does timing change?
    └── NO

ACTION:
1. Identify: Line with bounce height value
2. Calculate: New value (1.5x current)
3. Modify: Only the affected file
4. Re-render: Generate new preview
```

**Iteration Rules**:

1. **Minimal changes**: Only modify files that need changes
2. **Preserve working code**: Don't rewrite things that work
3. **Explain changes**: Update thinking message with what changed
4. **Re-render always**: Every iteration produces new preview

**Handling Conflicting Feedback**:

```
User: "Make it faster but also smoother"

AGENT REASONING:
- "Faster" → shorter durations, snappier easing
- "Smoother" → longer transitions, gentler easing
- These conflict

AGENT RESPONSE:
"I'll make the overall animation faster while using smoother 
easing curves. The ball will move quickly but without abrupt 
changes. Let me know if you'd like to adjust the balance."

Then proceeds with reasonable interpretation.
```

---

## 1.3 Agent Decision Tree

```
                            ┌─────────────────┐
                            │  Receive Input  │
                            └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │  Analyze Prompt │
                            └────────┬────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              ┌─────▼─────┐   ┌──────▼──────┐  ┌─────▼─────┐
              │  Clear &  │   │   Needs     │  │  Invalid  │
              │  Specific │   │ Clarify     │  │  Request  │
              └─────┬─────┘   └──────┬──────┘  └─────┬─────┘
                    │                │                │
                    │         ┌──────▼──────┐        │
                    │         │   Generate  │        │
                    │         │   Question  │        │
                    │         └──────┬──────┘        │
                    │                │                │
                    │         ┌──────▼──────┐        │
                    │         │    Wait     │        │
                    │         │   Answer    │        │
                    │         └──────┬──────┘        │
                    │                │                │
                    └───────┬────────┘                │
                            │                         │
                   ┌────────▼────────┐               │
                   │  Generate Plan  │               │
                   └────────┬────────┘               │
                            │                         │
              ┌─────────────┼─────────────┐          │
              │             │             │          │
        ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐   │
        │  Accept   │ │  Modify   │ │  Reject   │   │
        │           │ │           │ │           │   │
        └─────┬─────┘ └─────┬─────┘ └─────┬─────┘   │
              │             │             │          │
              │      ┌──────▼──────┐      │          │
              │      │  Regenerate │      │          │
              │      │    Plan     │◄─────┘          │
              │      └──────┬──────┘                 │
              │             │                        │
              └──────┬──────┘                        │
                     │                               │
            ┌────────▼────────┐                      │
            │     Execute     │◄─── User Message ───┤
            │    (Loop)       │     (Iteration)     │
            └────────┬────────┘                      │
                     │                               │
            ┌────────▼────────┐                      │
            │  Render Preview │                      │
            └────────┬────────┘                      │
                     │                               │
       ┌─────────────┼─────────────┐                │
       │             │             │                │
 ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐         │
 │  Accept   │ │  Modify   │ │  Reject   │         │
 │           │ │           │ │           │         │
 └─────┬─────┘ └─────┬─────┘ └─────┬─────┘         │
       │             │             │                │
       │      ┌──────▼──────┐      │                │
       │      │   Iterate   │◄─────┘                │
       │      │  & Re-render│                       │
       │      └──────┬──────┘                       │
       │             │                              │
       └──────┬──────┘                              │
              │                                     │
     ┌────────▼────────┐                           │
     │  Render Final   │                           │
     └────────┬────────┘                           │
              │                                     │
     ┌────────▼────────┐                           │
     │    Complete     │                           │
     └─────────────────┘                           │
```

---

## 1.4 Agent Context Management

The agent maintains context across the entire session. Here's what's included at each phase:

### Context Window Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT CONTEXT WINDOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SYSTEM PROMPT (Fixed)                                          │
│  ├── Agent Identity & Role                                      │
│  ├── Phase-specific Instructions                                │
│  ├── Theatre.js Knowledge (SYSTEM_INSTRUCTIONS.md)              │
│  └── Tool Definitions                                           │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  SESSION CONTEXT (Accumulated)                                  │
│  ├── Original User Prompt                                       │
│  ├── Style Selection (after question)                           │
│  ├── Accepted Plan                                              │
│  ├── Generated Files (as reference)                             │
│  └── Conversation History                                       │
│      ├── User messages                                          │
│      ├── Agent responses                                        │
│      └── Tool calls & results                                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  CURRENT STATE                                                  │
│  ├── Phase: question | plan | executing | preview               │
│  ├── Todos: [{ id, label, status }]                             │
│  └── Current Request (latest user message)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Context Pruning Strategy

As conversations grow, older context is summarized:

```
CONTEXT LIMITS:
- System prompt: Always full (~15k tokens for Theatre.js knowledge)
- Current files: Always full (needed for iteration)
- Recent messages: Last 10 full
- Older messages: Summarized

PRUNING RULES:
1. Never prune: System prompt, current files, last user message
2. Summarize: Completed execution phases → "Generated bouncing ball with 3 scenes"
3. Remove: Tool call details after completion
4. Preserve: User preferences mentioned anywhere
```

---

## 1.5 Agent Error Handling

### Error Categories & Responses

| Error Type | Agent Behavior |
|------------|---------------|
| Code syntax error | Self-correct, regenerate file, retry |
| Sandbox command fails | Check error, adjust command, retry up to 3x |
| Render fails | Check video duration, memory, retry with lower quality |
| Timeout | Save state, inform user, offer retry |
| User request unclear | Ask clarifying question |
| Impossible request | Explain limitation, suggest alternative |

### Self-Correction Loop

```
GENERATE CODE
     │
     ▼
WRITE TO SANDBOX
     │
     ▼
RUN/BUILD ──────► ERROR?
     │              │
     │              ▼
     │         ANALYZE ERROR
     │              │
     │              ▼
     │         IDENTIFY FIX
     │              │
     │              ▼
     │         REGENERATE
     │              │
     │              ▼
     │         RETRY (max 3x)
     │              │
     ▼              │
SUCCESS ◄──────────┘
```

---

# Part 2: Tool System Design

## 2.1 Tool Philosophy

Tools are the agent's hands. Each tool has:
- **Single responsibility**: Does one thing well
- **Clear contract**: Defined inputs, predictable outputs
- **Error transparency**: Reports failures clearly
- **Idempotency where possible**: Same input → same result

## 2.2 Complete Tool Catalog

### Sandbox Lifecycle Tools

#### `sandbox_create`

**Purpose**: Create or connect to a sandbox environment for this session.

**When Used**: 
- Start of execution phase
- After sandbox timeout/crash

**Behavior**:
```
INPUT:
  reuse_existing: boolean  // Try to reuse existing sandbox for this session

PROCESS:
  1. Check if session has active sandbox
     ├── YES + reuse_existing → Return existing sandbox ID
     └── NO or !reuse_existing → Continue
  2. Check provider (E2B or Docker)
  3. Create new sandbox from template
  4. Wait for sandbox ready (dev environment initialized)
  5. Store sandbox ID in session
  6. Return sandbox ID and status

OUTPUT:
  sandbox_id: string       // "sbx_abc123" or container ID
  status: "created" | "reused"
  
ERRORS:
  - QUOTA_EXCEEDED: User/system sandbox limit reached
  - TEMPLATE_NOT_FOUND: Sandbox template missing
  - PROVIDER_ERROR: E2B/Docker unavailable
```

**Timeout**: 60 seconds (sandbox creation can be slow)

---

#### `sandbox_destroy`

**Purpose**: Clean up sandbox when done or on error.

**When Used**:
- Node deleted
- Explicit cleanup
- Error recovery

**Behavior**:
```
INPUT:
  sandbox_id: string
  save_state: boolean      // Save project state before destroying

PROCESS:
  1. If save_state → Sync files to storage
  2. Stop any running processes
  3. Destroy sandbox
  4. Clear session reference

OUTPUT:
  success: boolean
  
ERRORS:
  - SANDBOX_NOT_FOUND: Already destroyed
  - SAVE_FAILED: Could not save state
```

---

### File Operation Tools

#### `sandbox_write_file`

**Purpose**: Write a file to the sandbox filesystem.

**When Used**:
- Writing generated code
- Writing configuration files
- Writing asset files

**Behavior**:
```
INPUT:
  path: string             // Relative to project root, e.g., "src/App.tsx"
  content: string          // File content (code, JSON, etc.)
  encoding: "utf8" | "base64"  // Default: utf8

PROCESS:
  1. Validate path (no escape, no dangerous locations)
  2. Create parent directories if needed
  3. Write file content
  4. Return success

OUTPUT:
  success: boolean
  path: string             // Normalized path
  size_bytes: number
  
ERRORS:
  - INVALID_PATH: Path escapes project or targets system files
  - WRITE_FAILED: Disk full, permissions, etc.
  - SANDBOX_NOT_FOUND: Sandbox doesn't exist
```

**Path Validation Rules**:
- Must be relative (no leading `/`)
- Cannot contain `..`
- Cannot write to `/etc`, `/usr`, etc.
- Allowed prefixes: `src/`, `public/`, `scripts/`, config files in root

---

#### `sandbox_read_file`

**Purpose**: Read a file from the sandbox filesystem.

**When Used**:
- Checking current file state before modification
- Reading error logs
- Verifying writes

**Behavior**:
```
INPUT:
  path: string

PROCESS:
  1. Validate path
  2. Check file exists
  3. Read content
  4. Return content

OUTPUT:
  content: string
  size_bytes: number
  
ERRORS:
  - FILE_NOT_FOUND: File doesn't exist
  - READ_FAILED: Permissions, etc.
```

---

#### `sandbox_list_files`

**Purpose**: List files in a directory.

**When Used**:
- Understanding current project state
- Finding files to modify

**Behavior**:
```
INPUT:
  path: string             // Directory path, e.g., "src/components"
  recursive: boolean       // Include subdirectories

OUTPUT:
  files: [
    { path: string, type: "file" | "directory", size_bytes: number }
  ]
```

---

### Command Execution Tools

#### `sandbox_run_command`

**Purpose**: Execute a shell command in the sandbox.

**When Used**:
- Installing dependencies (`bun install`)
- Starting dev server (`bun run dev`)
- Running build (`bun run build`)
- Running custom scripts

**Behavior**:
```
INPUT:
  command: string          // Shell command to run
  background: boolean      // Run in background (for servers)
  timeout_ms: number       // Max execution time (default: 30000)
  working_dir: string      // Directory to run in (default: project root)

PROCESS:
  1. Validate command (no dangerous operations)
  2. Execute in sandbox shell
  3. If background → Return immediately with process ID
  4. If foreground → Wait for completion or timeout
  5. Capture stdout, stderr, exit code

OUTPUT:
  stdout: string
  stderr: string
  exit_code: number
  pid: number              // If background
  
ERRORS:
  - COMMAND_BLOCKED: Dangerous command rejected
  - TIMEOUT: Command exceeded timeout
  - EXECUTION_FAILED: Command crashed
```

**Blocked Commands**:
- `rm -rf /`
- `sudo` anything
- Network commands to external hosts (except package registries)
- Anything modifying system files

**Background Process Handling**:
- Background processes are tracked by PID
- When sandbox destroyed, all processes killed
- Dev server typically runs in background

---

### Preview & Visual Tools

#### `sandbox_start_preview`

**Purpose**: Start the development server and get a URL for live preview.

**When Used**:
- After initial code generation
- After iterations

**Behavior**:
```
INPUT:
  (none)

PROCESS:
  1. Kill any existing dev server
  2. Run `bun run dev` in background
  3. Wait for server ready (port 5173 responding)
  4. Get stream URL (E2B) or localhost URL (Docker)
  5. Return URL

OUTPUT:
  stream_url: string       // URL embeddable in iframe
  dev_server_url: string   // Direct localhost URL (for internal use)
  
ERRORS:
  - SERVER_FAILED: Dev server crashed
  - PORT_UNAVAILABLE: Port 5173 in use
  - TIMEOUT: Server didn't start in time
```

**Stream URL Behavior**:
- **E2B**: Returns authenticated stream URL from E2B's VNC service
- **Docker**: Returns localhost URL proxied through backend

---

#### `sandbox_screenshot`

**Purpose**: Capture the current visual state of the animation.

**When Used**:
- Debugging rendering issues
- Progress verification
- Thumbnail generation

**Behavior**:
```
INPUT:
  seek_to: number          // Seek animation to this time (seconds) before capture
  width: number            // Screenshot width (default: 1920)
  height: number           // Screenshot height (default: 1080)

PROCESS:
  1. If seek_to specified → Call window.__exportSeekTo(seek_to)
  2. Wait for frame settle (2 RAF cycles)
  3. Capture screenshot via Puppeteer
  4. Return as base64 or upload and return URL

OUTPUT:
  image_url: string        // URL or base64 data URL
  timestamp: number        // Animation time captured
  
ERRORS:
  - CAPTURE_FAILED: Screenshot failed
  - SEEK_FAILED: Animation not responding
```

---

### Rendering Tools

#### `render_preview`

**Purpose**: Generate a low-quality, fast preview video.

**When Used**:
- After execution complete
- After iterations

**Behavior**:
```
INPUT:
  duration: number         // Video duration in seconds

PROCESS:
  1. Configure Puppeteer for 640x360 @ 15fps
  2. Navigate to app with ?export flag
  3. For each frame (0 to duration * 15):
     a. Seek to frame time
     b. Wait for render
     c. Capture frame
  4. Stitch frames with FFmpeg (fast preset)
  5. Upload to storage
  6. Return URL

OUTPUT:
  video_url: string
  thumbnail_url: string
  duration: number
  render_time_ms: number
  
TIMING:
  - ~5 second video → ~15-20 seconds to render
  - ~30 second video → ~60-90 seconds to render
  
ERRORS:
  - RENDER_FAILED: Frame capture failed
  - ENCODE_FAILED: FFmpeg failed
  - STORAGE_FAILED: Upload failed
```

---

#### `render_final`

**Purpose**: Generate high-quality final video.

**When Used**:
- After preview accepted

**Behavior**:
```
INPUT:
  duration: number
  resolution: "720p" | "1080p" | "4k"
  fps: 30 | 60
  format: "mp4" | "webm"

PROCESS:
  1. Configure Puppeteer for full resolution
  2. Navigate to app with ?export flag
  3. For each frame:
     a. Seek to frame time
     b. Wait for render (longer settle time)
     c. Capture PNG frame
  4. Stitch with FFmpeg (high quality, CRF 18)
  5. Upload to storage
  6. Generate thumbnail at midpoint
  7. Return URLs

OUTPUT:
  video_url: string
  thumbnail_url: string
  duration: number
  file_size_bytes: number
  render_time_ms: number
  
TIMING:
  - 5s @ 1080p/60fps → ~2-3 minutes
  - 30s @ 1080p/60fps → ~10-15 minutes
  
ERRORS:
  - RENDER_FAILED
  - OUT_OF_MEMORY: Video too long/high res
  - TIMEOUT: Render taking too long
```

---

### UI Communication Tools

#### `update_todo`

**Purpose**: Update the status of a todo item in the UI.

**When Used**:
- Starting work on a todo
- Completing a todo

**Behavior**:
```
INPUT:
  todo_id: string
  status: "pending" | "active" | "done"

PROCESS:
  1. Validate todo exists
  2. Update status
  3. Emit update event to frontend

OUTPUT:
  success: boolean
```

**UI Effect**:
- `pending`: Empty circle icon
- `active`: Spinning indicator
- `done`: Checkmark icon

---

#### `set_thinking`

**Purpose**: Update the "thinking" message shown to user.

**When Used**:
- Communicating current activity
- Showing progress within a todo

**Behavior**:
```
INPUT:
  message: string          // Short message, e.g., "Adjusting bounce height..."

PROCESS:
  1. Emit thinking event to frontend

OUTPUT:
  success: boolean

GUIDELINES:
  - Keep under 50 characters
  - Be specific: "Writing App.tsx" not "Working..."
  - Update frequently during long operations
```

---

#### `add_message`

**Purpose**: Add a message to the execution chat thread.

**When Used**:
- Agent needs to communicate something substantial
- Explaining a decision or limitation

**Behavior**:
```
INPUT:
  content: string
  
PROCESS:
  1. Create message with assistant role
  2. Add to execution history
  3. Emit to frontend

OUTPUT:
  message_id: string
```

---

## 2.3 Tool Execution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent (Claude)                           │
│                                                                 │
│  "I need to write the App.tsx file"                            │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              TOOL CALL                                   │   │
│  │  sandbox_write_file({                                    │   │
│  │    path: "src/App.tsx",                                  │   │
│  │    content: "import React from 'react'..."               │   │
│  │  })                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Tool Executor                               │
│                                                                 │
│  1. Validate tool name exists                                   │
│  2. Validate input against schema                               │
│  3. Check permissions (sandbox exists, etc.)                    │
│  4. Route to appropriate service                                │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Sandbox Service                             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   E2B Provider                             │ │
│  │                        OR                                  │ │
│  │                 Docker Provider                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Execute: sandbox.files.write("src/App.tsx", content)          │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Tool Result                                │
│                                                                 │
│  {                                                              │
│    success: true,                                               │
│    path: "src/App.tsx",                                         │
│    size_bytes: 1847                                             │
│  }                                                              │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Agent (Claude)                           │
│                                                                 │
│  "File written successfully. Now I'll update the todo..."      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# Part 3: Sandbox Architecture

## 3.1 What is a Sandbox?

A sandbox is an isolated environment where the animation code runs. It contains:

- Complete Node.js/Bun runtime
- Theatre.js and all dependencies pre-installed
- Chromium browser for rendering
- FFmpeg for video encoding
- File system for project files
- Network access (limited to package registries)

## 3.2 Sandbox Lifecycle

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ CREATED │────▶│  READY  │────▶│  BUSY   │────▶│ STOPPED │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │
     │               │               │               │
     ▼               ▼               ▼               ▼
  Template      Waiting for      Executing       Destroyed
  loading,      commands         commands,        or timed
  deps warm                      rendering        out
```

**State Transitions**:

| From | To | Trigger |
|------|-----|---------|
| - | CREATED | `sandbox_create` called |
| CREATED | READY | Template loaded, deps installed |
| READY | BUSY | Command or render started |
| BUSY | READY | Command completed |
| READY/BUSY | STOPPED | Timeout, explicit destroy, error |

**Timeout Behavior**:
- **E2B**: 30 minutes default, extendable with keepalive
- **Docker**: No automatic timeout (managed by backend)

## 3.3 Sandbox Contents

```
/home/user/project/
├── package.json              # Pre-configured with all deps
├── bun.lockb                 # Locked dependencies
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript config
├── index.html                # HTML entry point
│
├── src/
│   ├── main.tsx              # React entry
│   ├── App.tsx               # Root component (agent writes)
│   ├── theatre/
│   │   └── project.ts        # Theatre.js setup (agent writes)
│   ├── scenes/
│   │   └── *.tsx             # Scene components (agent writes)
│   ├── components/
│   │   └── *.tsx             # Animation components (agent writes)
│   └── utils/
│       └── easing.ts         # Easing functions (template)
│
├── public/
│   ├── images/               # User assets
│   └── audio/                # Audio files
│
├── scripts/
│   └── export-video.cjs      # Puppeteer export script (template)
│
├── exports/                   # Frame output during render
│   ├── frame_00000.png
│   └── ...
│
└── node_modules/              # Pre-installed dependencies
```

## 3.4 Pre-installed Dependencies

The sandbox template has these packages pre-installed to avoid installation time:

**Core Animation**:
- `@theatre/core` - Animation engine
- `@theatre/studio` - Visual editor
- `@theatre/r3f` - React Three Fiber integration
- `@react-three/fiber` - React renderer for Three.js
- `@react-three/drei` - Useful helpers
- `three` - 3D engine

**UI & Assets**:
- `react`, `react-dom` - UI framework
- `lucide-react` - Icons
- `recharts` - Charts (if needed)

**Build & Export**:
- `vite` - Build tool
- `typescript` - Type checking
- `puppeteer` - Frame capture

**System**:
- `chromium-browser` - For rendering
- `ffmpeg` - Video encoding
- `bun` - Fast runtime and package manager

## 3.5 Sandbox Communication

### E2B Communication Flow

```
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   Backend    │          │   E2B API    │          │   Sandbox    │
│              │          │              │          │   (Cloud)    │
└──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │
       │  Create Sandbox         │                         │
       │────────────────────────▶│                         │
       │                         │  Provision VM           │
       │                         │────────────────────────▶│
       │                         │                         │
       │                         │  Ready                  │
       │                         │◀────────────────────────│
       │  Sandbox ID             │                         │
       │◀────────────────────────│                         │
       │                         │                         │
       │  Write File             │                         │
       │────────────────────────▶│                         │
       │                         │  Write to filesystem    │
       │                         │────────────────────────▶│
       │                         │                         │
       │  Success                │                         │
       │◀────────────────────────│                         │
       │                         │                         │
       │  Run Command            │                         │
       │────────────────────────▶│                         │
       │                         │  Execute bash           │
       │                         │────────────────────────▶│
       │                         │                         │
       │  stdout/stderr          │                         │
       │◀────────────────────────│                         │
       │                         │                         │
       │  Start Stream           │                         │
       │────────────────────────▶│                         │
       │                         │  Setup VNC stream       │
       │                         │────────────────────────▶│
       │                         │                         │
       │  Stream URL             │                         │
       │◀────────────────────────│                         │
       │                         │                         │
```

### Docker Communication Flow

```
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   Backend    │          │  Docker API  │          │  Container   │
│              │          │   (Local)    │          │   (Local)    │
└──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │
       │  Create Container       │                         │
       │────────────────────────▶│                         │
       │                         │  docker run             │
       │                         │────────────────────────▶│
       │                         │                         │
       │  Container ID           │                         │
       │◀────────────────────────│                         │
       │                         │                         │
       │  Exec Write File        │                         │
       │────────────────────────▶│                         │
       │                         │  docker exec cat >      │
       │                         │────────────────────────▶│
       │                         │                         │
       │  Success                │                         │
       │◀────────────────────────│                         │
       │                         │                         │
       │  Exec Command           │                         │
       │────────────────────────▶│                         │
       │                         │  docker exec bash -c    │
       │                         │────────────────────────▶│
       │                         │                         │
       │  stdout/stderr          │                         │
       │◀────────────────────────│                         │
       │                         │                         │
       │  Port Forward           │                         │
       │  localhost:5173         │                         │
       │────────────────────────▶│────────────────────────▶│
       │                         │                         │
```

---

# Part 4: Self-Hosted Deployment

## 4.1 Overview

Self-hosted mode runs entirely on the user's machine using Docker containers.

```
┌─────────────────────────────────────────────────────┐
│                  YOUR MACHINE                        │
│                                                     │
│  ┌─────────────┐    ┌─────────────────────────┐    │
│  │  Koda App   │───▶│  Docker Container       │    │
│  │  (Docker)   │    │  (Sandbox)              │    │
│  └──────┬──────┘    │                         │    │
│         │           │  Theatre.js + Chrome    │    │
│         │           │  + FFmpeg               │    │
│         │           └─────────────────────────┘    │
│         │                                          │
│         ▼                                          │
│  ┌─────────────────────────────────────────────┐  │
│  │  ./data/                                     │  │
│  │  ├── koda.db        (SQLite)                │  │
│  │  └── storage/       (Files)                 │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 4.2 Component Details

### Koda App Container

**Responsibilities**:
- Serve web UI (Next.js)
- Run API server (Hono)
- Run agent (Claude API calls)
- Manage sandbox containers
- Serve static files (storage)

**Exposed Ports**:
- `3000` - Web UI and API

**Volumes**:
- `./data:/app/data` - Persistent storage and database
- `/var/run/docker.sock:/var/run/docker.sock` - Docker control

### Sandbox Container

**Responsibilities**:
- Run Theatre.js project
- Execute Puppeteer rendering
- Encode video with FFmpeg

**Image**: `koda/animation-sandbox:latest`

**Resources**:
- CPU: 2 cores recommended
- RAM: 4GB minimum (Chrome is hungry)
- Disk: 5GB for temp files during render

**Exposed Ports** (internal network only):
- `5173` - Vite dev server

### Local Storage

**Structure**:
```
./data/
├── storage/
│   ├── projects/
│   │   └── {projectId}/
│   │       ├── files/          # Project source files
│   │       └── state.json      # Execution state
│   ├── assets/
│   │   └── {userId}/
│   │       ├── images/
│   │       └── audio/
│   └── renders/
│       └── {renderId}/
│           ├── video.mp4
│           └── thumbnail.jpg
│
└── koda.db                      # SQLite database
```

### SQLite Database

**Tables**:
- `users` - User accounts (optional, single-user mode by default)
- `projects` - Animation projects
- `assets` - Uploaded files
- `renders` - Render history
- `sessions` - Active sandbox sessions

## 4.3 Self-Hosted Data Flow

### Creating an Animation

```
1. USER: "Create bouncing ball"
        │
        ▼
2. API receives request
        │
        ▼
3. Create project in SQLite
        │
        ▼
4. Agent generates plan
        │
        ▼
5. User accepts plan
        │
        ▼
6. Docker: Start sandbox container
   docker run -d \
     --name sandbox-{projectId} \
     --network koda-network \
     koda/animation-sandbox
        │
        ▼
7. Agent generates code, writes via Docker exec
   docker exec sandbox-{projectId} bash -c "cat > /project/src/App.tsx << 'EOF'
   ... code ...
   EOF"
        │
        ▼
8. Start dev server in container
   docker exec -d sandbox-{projectId} bash -c "cd /project && bun run dev"
        │
        ▼
9. Return preview URL: http://localhost:3000/proxy/{projectId}
   (Backend proxies to container's port 5173)
        │
        ▼
10. User views preview, requests changes
        │
        ▼
11. Agent modifies code, re-renders
        │
        ▼
12. User accepts, trigger final render
    docker exec sandbox-{projectId} node scripts/export-video.cjs
        │
        ▼
13. Copy video to storage
    docker cp sandbox-{projectId}:/project/output.mp4 ./data/storage/renders/{renderId}/
        │
        ▼
14. Destroy sandbox
    docker rm -f sandbox-{projectId}
        │
        ▼
15. Return video URL: http://localhost:3000/storage/renders/{renderId}/video.mp4
```

## 4.4 Self-Hosted Networking

```
┌─────────────────────────────────────────────────────────────┐
│                    koda-network (bridge)                     │
│                                                             │
│  ┌─────────────────┐         ┌─────────────────────────┐   │
│  │   koda-app      │         │   sandbox-proj123       │   │
│  │                 │         │                         │   │
│  │  172.20.0.2     │◀───────▶│  172.20.0.3             │   │
│  │                 │         │                         │   │
│  │  :3000 exposed  │         │  :5173 internal only    │   │
│  └─────────────────┘         └─────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
            │
            │ Port 3000 mapped to host
            ▼
┌─────────────────────────────────────────────────────────────┐
│                        HOST                                  │
│                                                             │
│   http://localhost:3000  ─────────────────▶  Koda UI        │
│   http://localhost:3000/api  ─────────────▶  API Server     │
│   http://localhost:3000/proxy/{id}  ──────▶  Sandbox proxy  │
│   http://localhost:3000/storage  ─────────▶  Static files   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Preview Proxy**:

The backend proxies preview requests to sandbox containers:

```
User requests: GET /proxy/proj123/
Backend: Forward to http://sandbox-proj123:5173/
Response: Proxied back to user
```

This avoids exposing container ports directly to host.

## 4.5 Docker Image for Self-Hosted

You need a **Docker image** for self-hosted, just like you need an **E2B template** for cloud. They're the same concept — a pre-built environment with everything installed.

### Sandbox Dockerfile

```dockerfile
# templates/sandbox/Dockerfile

FROM node:20-slim

# System deps
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-liberation \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Bun (faster than npm)
RUN npm install -g bun

# Puppeteer config (use installed Chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Project directory
WORKDIR /project

# Pre-install dependencies (cached layer)
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy template files
COPY template/ ./

# Default command: keep container alive
CMD ["tail", "-f", "/dev/null"]
```

### Template package.json

```json
{
  "name": "koda-animation-sandbox",
  "private": true,
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "export": "node scripts/export-video.cjs"
  },
  "dependencies": {
    "@theatre/core": "^0.7.2",
    "@theatre/studio": "^0.7.2",
    "@theatre/r3f": "^0.7.2",
    "@react-three/fiber": "^8.17.0",
    "@react-three/drei": "^9.117.0",
    "three": "^0.169.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "puppeteer": "^24.0.0",
    "vite": "^6.0.0"
  }
}
```

### Template Files Structure

```
templates/sandbox/
├── Dockerfile
├── package.json
├── bun.lockb
├── vite.config.ts
├── tsconfig.json
├── index.html
│
├── template/                    # Copied into container
│   ├── src/
│   │   ├── main.tsx            # Entry point (static)
│   │   ├── App.tsx             # Placeholder (agent replaces)
│   │   └── utils/
│   │       └── easing.ts       # Easing functions (static)
│   │
│   ├── scripts/
│   │   └── export-video.cjs    # Render script (static)
│   │
│   └── public/
│       └── .gitkeep
│
└── README.md
```

---

# Part 5: Cloud Deployment

## 5.1 Overview

Cloud mode uses managed services for scalability and reliability.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Cloudflare     │     │       E2B        │     │     Turso        │
│                  │     │                  │     │                  │
│  Workers (API)   │────▶│  Sandbox VM      │     │  Database        │
│  Pages (UI)      │     │                  │     │                  │
│  R2 (Storage)    │     │  Theatre.js      │     │  LibSQL          │
│                  │     │  + Chrome        │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │                        │
         └────────────────────────┴────────────────────────┘
                    All connected via APIs
```

## 5.2 Component Details

### Cloudflare Workers (API)

**Why Workers**:
- Edge deployment (low latency globally)
- Auto-scaling
- No cold starts (after first request)
- Integrated with R2 and other CF services

**Limitations**:
- 30 second request timeout (use streaming for long operations)
- No persistent connections (WebSocket via Durable Objects)
- Memory limits (128MB)

### Cloudflare R2

**Why R2**:
- S3-compatible API
- No egress fees (huge for video delivery)
- Global CDN integration
- Integrated with Workers

**Bucket Structure**:
```
koda-storage/
├── users/{userId}/
│   ├── projects/{projectId}/
│   │   ├── files/               # Project source (synced from sandbox)
│   │   │   ├── src/
│   │   │   └── public/
│   │   └── state.json           # Execution state
│   ├── assets/
│   │   ├── {assetId}.jpg
│   │   └── {assetId}.mp3
│   └── renders/
│       └── {renderId}/
│           ├── video.mp4
│           ├── video_preview.mp4
│           └── thumbnail.jpg
│
└── templates/                    # Shared assets
    ├── fonts/
    └── stock/
```

**Access Patterns**:
- **Upload**: Presigned URLs from Worker → Direct upload to R2
- **Download**: Public bucket URL or presigned URL
- **Sync**: Sandbox syncs project files to R2 periodically

### Turso (LibSQL)

**Why Turso**:
- SQLite compatibility (same schema as self-hosted)
- Edge replicas (low latency reads)
- Serverless (no connection management)
- Reasonable free tier

**Schema**: Same as SQLite in self-hosted mode

**Connection**:
```
DATABASE_URL=libsql://koda-{org}.turso.io
DATABASE_AUTH_TOKEN=eyJ...
```

### E2B Desktop

**Why E2B**:
- Managed sandbox VMs
- Built-in VNC streaming
- Pre-built templates
- Auto-cleanup on timeout

**Template**: `koda-animation` (custom template with Theatre.js pre-installed)

**Capabilities**:
- Full Linux VM (Ubuntu)
- Desktop environment (for Chrome)
- Persistent filesystem during session
- Network access (limited)
- Stream desktop via VNC

**Pricing Considerations**:
- Per-minute billing (~$0.10/hour)
- Template creation is one-time
- Sandboxes auto-destroy after timeout

## 5.3 Cloud Data Flow

### Creating an Animation (Cloud)

```
1. USER: "Create bouncing ball"
   │
   ▼
2. Request hits Cloudflare Worker at edge
   │
   ▼
3. Worker creates project in Turso
   │
   ▼
4. Worker calls Anthropic API for plan generation
   │
   ▼
5. Plan returned to user via streaming response
   │
   ▼
6. User accepts plan
   │
   ▼
7. Worker calls E2B API to create sandbox
   POST https://api.e2b.dev/sandboxes
   {
     "template": "koda-animation",
     "timeout": 1800
   }
   │
   ▼
8. E2B returns sandbox ID and endpoints
   {
     "sandboxId": "sbx_abc123",
     "clientId": "...",
     ...
   }
   │
   ▼
9. Worker stores sandbox ID in Turso (sessions table)
   │
   ▼
10. Agent executes, calling E2B SDK for each tool:
    - sandbox.files.write("src/App.tsx", code)
    - sandbox.commands.run("bun run dev &")
    │
    ▼
11. Start VNC stream from E2B
    sandbox.stream.start()
    Returns: wss://stream.e2b.dev/sbx_abc123?token=...
    │
    ▼
12. Return stream URL to frontend
    (Frontend embeds in iframe)
    │
    ▼
13. User views preview, requests changes
    │
    ▼
14. Agent modifies via E2B SDK
    │
    ▼
15. User accepts, trigger render
    sandbox.commands.run("node scripts/export-video.cjs")
    │
    ▼
16. Upload video from sandbox to R2
    - Read from sandbox: sandbox.files.read("/project/output.mp4")
    - Upload to R2: r2.put("users/{userId}/renders/{renderId}/video.mp4", data)
    │
    ▼
17. Destroy sandbox
    sandbox.kill()
    │
    ▼
18. Return R2 video URL
    https://storage.koda.video/users/{userId}/renders/{renderId}/video.mp4
```

## 5.4 E2B Stream Integration

### How VNC Streaming Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │     │   E2B Edge   │     │   Sandbox    │
│   (User)     │     │   Servers    │     │   VM         │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. iframe src=     │                    │
       │    stream URL      │                    │
       │───────────────────▶│                    │
       │                    │                    │
       │ 2. WebSocket       │                    │
       │    connection      │                    │
       │◀──────────────────▶│                    │
       │                    │ 3. VNC protocol    │
       │                    │◀──────────────────▶│
       │                    │                    │
       │ 4. Rendered        │                    │
       │    frames          │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ 5. Mouse/keyboard  │                    │
       │    events          │                    │
       │───────────────────▶│                    │
       │                    │───────────────────▶│
       │                    │                    │
```

### Preview Options

For Koda, we **proxy the dev server** rather than showing the full desktop:

**Docker (self-hosted)**:
```
User browser → Backend proxy → Container port 5173
```

**E2B (cloud)**:
```
User browser → iframe → E2B VNC stream → Sandbox browser showing localhost:5173
```

The user sees the animation preview, not the entire desktop.

---

# Part 6: Data Flow & State Management

## 6.1 State Machine

The Animation Node maintains a state machine that coordinates all activities.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Animation Node State                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Core State                            │   │
│  │                                                          │   │
│  │  nodeId: string          # Unique identifier             │   │
│  │  userId: string          # Owner                         │   │
│  │  projectId: string       # Associated project            │   │
│  │  phase: Phase            # Current phase                 │   │
│  │  createdAt: Date                                         │   │
│  │  updatedAt: Date                                         │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Phase-Specific State                   │   │
│  │                                                          │   │
│  │  question?: { text, options, selectedId }                │   │
│  │  plan?: { scenes, totalDuration, style }                 │   │
│  │  execution?: { todos, messages, currentThinking,         │   │
│  │               sandboxId, files }                         │   │
│  │  preview?: { videoUrl, streamUrl }                       │   │
│  │  output?: { videoUrl, thumbnailUrl, duration }           │   │
│  │  error?: { message, code, canRetry }                     │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 6.2 State Transitions

### Valid Transitions

```
init ──────────────────────────────▶ question
init ──────────────────────────────▶ plan        (if style inferrable)
question ──────────────────────────▶ plan        (on answer submit)
plan ──────────────────────────────▶ executing   (on accept)
plan ──────────────────────────────▶ question    (on reject)
executing ─────────────────────────▶ preview     (on render complete)
executing ─────────────────────────▶ error       (on failure)
preview ───────────────────────────▶ complete    (on accept)
preview ───────────────────────────▶ executing   (on reject with feedback)
complete ──────────────────────────▶ executing   (on edit request)
error ─────────────────────────────▶ executing   (on retry)
any ───────────────────────────────▶ error       (on unrecoverable failure)
```

### Transition Actions

| Transition | Actions Performed |
|------------|-------------------|
| `init → question` | Generate question via agent, store question |
| `init → plan` | Skip question, generate plan via agent |
| `question → plan` | Store answer, generate plan via agent |
| `plan → executing` | Create sandbox, start execution loop |
| `plan → question` | Clear plan, regenerate question with feedback |
| `executing → preview` | Store preview URL, emit preview event |
| `executing → error` | Store error, cleanup sandbox if needed |
| `preview → complete` | Trigger final render, store output, cleanup sandbox |
| `preview → executing` | Continue execution with feedback |
| `error → executing` | Retry execution from last checkpoint |

## 6.3 Event System

### Event Types

```
STATE_CHANGE          Phase transition
├── phase: Phase
└── state: NodeState

TODO_UPDATE           Todo status changed
├── todoId: string
└── status: pending | active | done

THINKING              Current activity message
└── message: string

MESSAGE               Chat message added
├── role: user | assistant
└── content: string

FILE_WRITTEN          File created/updated
├── path: string
└── size: number

PREVIEW_READY         Preview video available
└── url: string

RENDER_PROGRESS       Final render progress
├── percent: number
└── stage: capturing | encoding | uploading

ERROR                 Error occurred
├── code: string
└── message: string
```

### Event Delivery

**Self-Hosted**: Server-Sent Events (SSE)
```
GET /api/nodes/{nodeId}/events
Accept: text/event-stream

Response:
event: TODO_UPDATE
data: {"todoId": "todo-1", "status": "active"}

event: THINKING
data: {"message": "Writing bounce animation..."}
```

**Cloud**: WebSocket via Durable Objects
```
WebSocket: wss://api.koda.video/nodes/{nodeId}/ws

{
  "type": "TODO_UPDATE",
  "payload": {"todoId": "todo-1", "status": "active"}
}
```

---

# Part 7: Rendering Pipeline

## 7.1 Rendering Overview

The rendering process converts a running Theatre.js animation into a video file.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rendering Pipeline                           │
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │ Prepare │───▶│ Capture │───▶│ Encode  │───▶│ Upload  │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│                                                                 │
│  - Navigate     - Seek frame   - FFmpeg       - To R2 or       │
│    to export    - Wait settle  - H.264/VP9      local storage  │
│    mode         - Screenshot   - CRF 18       - Generate URL   │
│  - Wait ready   - Repeat                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 7.2 Frame Capture Process

### Step-by-Step

```
1. PREPARE
   │
   ├── Launch Puppeteer with headless Chrome
   │   puppeteer.launch({
   │     headless: true,
   │     args: ['--no-sandbox', '--disable-gpu']
   │   })
   │
   ├── Set viewport to target resolution
   │   page.setViewport({ width: 1920, height: 1080 })
   │
   ├── Navigate to app with export flag
   │   page.goto('http://localhost:5173?export')
   │
   ├── Wait for app ready signal
   │   page.waitForFunction(() => window.__exportReady === true)
   │
   └── Preload all assets (5 second delay)

2. CAPTURE LOOP
   │
   │  For frame = 0 to (duration * fps):
   │
   │  ├── Calculate time: time = frame / fps
   │  │
   │  ├── Seek animation to time
   │  │   page.evaluate((t) => window.__exportSeekTo(t), time)
   │  │
   │  ├── Wait for frame settle (2 RAF cycles)
   │  │   page.evaluate(() => new Promise(resolve => {
   │  │     requestAnimationFrame(() => {
   │  │       requestAnimationFrame(() => resolve())
   │  │     })
   │  │   }))
   │  │
   │  ├── Capture screenshot
   │  │   page.screenshot({
   │  │     path: `exports/frame_${frame.toString().padStart(5, '0')}.png`,
   │  │     type: 'png'
   │  │   })
   │  │
   │  └── Report progress
   │
   └── All frames captured

3. ENCODE
   │
   ├── Run FFmpeg
   │   ffmpeg -framerate {fps} -i exports/frame_%05d.png \
   │     -c:v libx264 -pix_fmt yuv420p -crf 18 \
   │     output.mp4
   │
   └── Output video file

4. UPLOAD
   │
   ├── Read video file
   ├── Upload to storage (R2 or local)
   ├── Generate thumbnail (ffmpeg frame at midpoint)
   └── Return URLs
```

## 7.3 Quality Presets

### Preview Quality

**Purpose**: Fast iteration during editing

| Setting | Value |
|---------|-------|
| Resolution | 640 × 360 |
| FPS | 15 |
| Codec | H.264 |
| CRF | 28 (lower quality, smaller file) |

**Timing**: ~3-4 seconds per second of video

### Final Quality

**Purpose**: Production output

| Setting | Value |
|---------|-------|
| Resolution | 1920 × 1080 |
| FPS | 60 |
| Codec | H.264 |
| CRF | 18 (visually lossless) |

**Timing**: ~10-15 seconds per second of video

### Platform Presets

| Platform | Resolution | FPS | Duration Limit |
|----------|-----------|-----|----------------|
| YouTube | 1920 × 1080 | 60 | None |
| Instagram Reels | 1080 × 1920 | 30 | 90s |
| TikTok | 1080 × 1920 | 30 | 180s |
| Twitter | 1920 × 1080 | 30 | 140s |

---

# Part 8: Session, Persistence & Checkpointing

## 8.1 The Core Principle

**The sandbox is ephemeral. Storage is permanent.**

Sandboxes (Docker containers or E2B VMs) can die at any time — timeout, crash, shutdown, user closes browser. The user's work must survive.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   EPHEMERAL (can die anytime)      PERSISTENT (survives)        │
│                                                                 │
│   ┌─────────────────────┐         ┌─────────────────────┐      │
│   │                     │         │                     │      │
│   │   Sandbox           │ ═══════▶│   Storage           │      │
│   │   (Docker or E2B)   │  sync   │   (Disk or R2)      │      │
│   │                     │         │                     │      │
│   │   - Running code    │         │   - Checkpointed    │      │
│   │   - Dev server      │         │     code            │      │
│   │   - Browser         │         │   - Execution state │      │
│   │                     │         │   - Rendered videos │      │
│   │   Can die anytime   │         │   Survives forever  │      │
│   │                     │         │                     │      │
│   └─────────────────────┘         └─────────────────────┘      │
│                                                                 │
│   If sandbox dies → Restore from storage into new sandbox       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8.2 Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│    ACTIVE                    SUSPENDED                 CLOSED   │
│   ┌──────┐                   ┌──────┐                 ┌──────┐ │
│   │      │                   │      │                 │      │ │
│   │ Sand │───── idle 5m ────▶│ No   │──── delete ────▶│ No   │ │
│   │ box  │      checkpoint   │ Sand │    project      │ data │ │
│   │ alive│      destroy      │ box  │                 │      │ │
│   │      │                   │      │                 │      │ │
│   │      │◀──── resume ──────│ Data │                 │      │ │
│   │      │   create sandbox  │ in   │                 │      │ │
│   │      │   restore files   │ stor │                 │      │ │
│   │      │                   │ age  │                 │      │ │
│   └──────┘                   └──────┘                 └──────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

State Transitions:
- ACTIVE → SUSPENDED: User idle 5 min, or sandbox timeout (E2B 30 min)
- SUSPENDED → ACTIVE: User returns, new sandbox created, files restored
- SUSPENDED → CLOSED: User deletes project, or retention period expires
- ACTIVE → CLOSED: User explicitly deletes while working
```

---

## 8.3 Session Data (Database)

```
sessions table:
│
├── id              string      Unique session ID
├── nodeId          string      Animation node this belongs to
├── userId          string      Owner
├── projectId       string      Project being edited
│
├── status          string      "active" | "suspended" | "closed"
├── sandboxId       string?     Docker container ID or E2B sandbox ID
├── sandboxType     string      "docker" | "e2b"
│
├── streamUrl       string?     Preview stream URL (when active)
├── devServerUrl    string?     Dev server URL (when active)
│
├── lastCheckpoint  timestamp   When last checkpoint was saved
├── lastActivity    timestamp   Last user interaction
├── createdAt       timestamp
└── updatedAt       timestamp
```

---

## 8.4 Checkpoint Triggers

Checkpoints are saved to storage at these moments:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHECKPOINT TRIGGERS                          │
│                                                                 │
│  1. AFTER FILE WRITES (debounced 5 seconds)                    │
│     Agent writes App.tsx                                        │
│     Wait 5 seconds (debounce)                                   │
│     No more writes? → Checkpoint                                │
│                                                                 │
│  2. AFTER EACH TODO COMPLETES                                   │
│     Todo status changes to "done"                               │
│     → Immediate checkpoint                                      │
│     This is a safe resume point                                 │
│                                                                 │
│  3. HEARTBEAT (every 30 seconds)                                │
│     While session is active                                     │
│     → Periodic checkpoint                                       │
│     Catches anything missed                                     │
│                                                                 │
│  4. BEFORE PREVIEW SHOWN                                        │
│     Execution complete                                          │
│     → Full checkpoint                                           │
│     User might leave after seeing preview                       │
│                                                                 │
│  5. USER IDLE 5 MINUTES                                         │
│     No mouse/keyboard/messages                                  │
│     → Checkpoint + destroy sandbox                              │
│     Saves resources                                             │
│                                                                 │
│  6. WEBSOCKET DISCONNECTS                                       │
│     User closes tab, network drops                              │
│     → Immediate checkpoint                                      │
│     Last chance to save                                         │
│                                                                 │
│  7. BEFORE SANDBOX DESTROY                                      │
│     Any intentional sandbox destruction                         │
│     → Checkpoint first, then destroy                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8.5 Checkpoint Contents

What gets saved to storage:

```
Storage Structure:
│
├── projects/{projectId}/
│   │
│   ├── files/                          # All generated code
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   ├── theatre/
│   │   │   │   └── project.ts
│   │   │   ├── components/
│   │   │   │   └── Ball.tsx
│   │   │   ├── scenes/
│   │   │   │   └── MainScene.tsx
│   │   │   └── utils/
│   │   │       └── easing.ts
│   │   ├── public/
│   │   │   └── (user uploaded assets)
│   │   └── package.json
│   │
│   ├── state.json                      # Execution state
│   │   │
│   │   ├── nodeState: {
│   │   │     phase: "executing",       # Current phase
│   │   │     todos: [
│   │   │       { id: "1", label: "Setup project", status: "done" },
│   │   │       { id: "2", label: "Create keyframes", status: "active" },
│   │   │       { id: "3", label: "Add effects", status: "pending" },
│   │   │       { id: "4", label: "Render preview", status: "pending" }
│   │   │     ]
│   │   │   }
│   │   │
│   │   ├── plan: {                     # Accepted plan
│   │   │     scenes: [...],
│   │   │     totalDuration: 5,
│   │   │     style: "playful"
│   │   │   }
│   │   │
│   │   ├── messages: [                 # Chat history
│   │   │     { role: "user", content: "Create bouncing ball" },
│   │   │     { role: "assistant", content: "I'll create..." }
│   │   │   ]
│   │   │
│   │   ├── theatreState: {...}         # Theatre.js project state
│   │   │
│   │   └── lastCheckpoint: {
│   │         todoIndex: 1,             # Resume from here
│   │         timestamp: "2024-...",
│   │         sandboxId: null           # Cleared when sandbox dies
│   │       }
│   │
│   └── renders/                        # Preview videos
│       └── preview.mp4
```

---

## 8.6 Self-Hosted (Docker) Checkpoint Flow

### Normal Operation

```
USER: "Create bouncing ball"
        │
        ▼
┌─────────────────┐
│ Create project  │
│ in database     │
│ projectId: xyz  │
└────────┬────────┘
        │
        ▼
┌─────────────────┐      ┌─────────────────────────────────┐
│ Start Docker    │      │  ./data/storage/projects/xyz/   │
│ container       │      │  (empty initially)              │
└────────┬────────┘      └─────────────────────────────────┘
        │                              ▲
        ▼                              │
┌─────────────────┐                    │
│ Agent writes    │                    │
│ files to        │─────── sync ───────┘
│ container       │     (every 5s)
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│ User sees       │
│ preview         │
└─────────────────┘
```

### After Crash / Restart

```
USER: Opens project xyz (next day)
        │
        ▼
┌─────────────────┐
│ Load project    │
│ from database   │
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│ Check: sandbox  │────── NO (container dead)
│ still alive?    │
└────────┬────────┘
        │
        ▼
┌─────────────────┐      ┌─────────────────────────────────┐
│ Create NEW      │      │  ./data/storage/projects/xyz/   │
│ container       │      │  ├── files/src/App.tsx          │
└────────┬────────┘      │  ├── files/src/components/...   │
        │                │  └── state.json                 │
        │                └──────────────┬──────────────────┘
        ▼                              │
┌─────────────────┐                    │
│ Copy files FROM │◀────── restore ────┘
│ storage INTO    │
│ new container   │
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│ Read state.json │
│ Resume from     │
│ lastCheckpoint  │
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│ Continue:       │
│ Todo 2 of 4     │
│ "Create         │
│  keyframes"     │
└─────────────────┘
```

---

## 8.7 Cloud (E2B) Checkpoint Flow

### Normal Operation

```
USER: "Create bouncing ball"
        │
        ▼
┌─────────────────┐      ┌─────────────────────────────────┐
│ E2B creates     │      │  R2: koda-bucket/projects/xyz/  │
│ sandbox VM      │      │  (empty initially)              │
│ sbx_abc123      │      └─────────────────────────────────┘
└────────┬────────┘                     ▲
        │                              │
        ▼                              │
┌─────────────────┐                    │
│ Agent writes    │                    │
│ files via       │─────── sync ───────┘
│ E2B SDK         │    (backend pulls from sandbox,
└────────┬────────┘     uploads to R2)
        │
        ▼
┌─────────────────┐
│ User sees       │
│ preview via     │
│ E2B stream      │
└─────────────────┘


⏰ 30 MINUTES LATER (E2B timeout)
        │
        ▼
┌─────────────────┐
│ E2B auto-       │
│ destroys        │
│ sandbox         │
└─────────────────┘

But R2 still has all the files! ✓
```

### After E2B Timeout / User Returns

```
USER: Opens project xyz (next day)
        │
        ▼
┌─────────────────┐
│ Load project    │
│ from Turso      │
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│ Check: sandbox  │────── NO (E2B destroyed it)
│ sbx_abc123      │
│ still alive?    │
└────────┬────────┘
        │
        ▼
┌─────────────────┐      ┌─────────────────────────────────┐
│ E2B creates     │      │  R2: koda-bucket/projects/xyz/  │
│ NEW sandbox     │      │  ├── files/src/App.tsx          │
│ sbx_def456      │      │  ├── files/src/components/...   │
└────────┬────────┘      │  └── state.json                 │
        │                └──────────────┬──────────────────┘
        ▼                              │
┌─────────────────┐                    │
│ Download files  │◀────── restore ────┘
│ from R2         │
│ Write to new    │
│ sandbox         │
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│ Parse state.json│
│ Resume from     │
│ where user      │
│ left off        │
└─────────────────┘
```

---

## 8.8 The Sync Process (Implementation)

### Checkpoint (Save)

```
CHECKPOINT PROCESS:

1. List files in sandbox
   sandbox.files.list("/project/src")
   → ["App.tsx", "components/Ball.tsx", ...]

2. Read each file
   sandbox.files.read("/project/src/App.tsx")
   → "import React from 'react'..."

3. Build state.json
   {
     nodeState: getCurrentNodeState(),
     theatreState: getTheatreState(),
     messages: getMessages(),
     lastCheckpoint: {
       todoIndex: 2,
       timestamp: Date.now()
     }
   }

4. Upload to storage
   storage.upload("projects/xyz/files/src/App.tsx", content)
   storage.upload("projects/xyz/files/src/components/Ball.tsx", content)
   storage.upload("projects/xyz/state.json", stateJson)

5. Update database
   db.updateProject(xyz, { lastCheckpoint: Date.now() })
```

### Restore

```
RESTORE PROCESS:

1. Check sandbox alive
   try { sandbox.connect(oldSandboxId) }
   catch { sandboxDead = true }

2. If dead, create new sandbox
   newSandbox = sandbox.create()

3. List files in storage
   storage.list("projects/xyz/files/")
   → ["src/App.tsx", "src/components/Ball.tsx", ...]

4. Download and write each file
   for each file:
     content = storage.download(file)
     sandbox.writeFile(file, content)

5. Read state.json
   state = JSON.parse(storage.download("projects/xyz/state.json"))

6. Restore node state
   node.phase = state.nodeState.phase
   node.todos = state.nodeState.todos
   node.messages = state.messages

7. If was mid-execution, resume
   if (state.nodeState.phase === "executing") {
     resumeFromTodo(state.lastCheckpoint.todoIndex)
   }

8. Start dev server
   sandbox.run("bun run dev")

9. Show preview to user
```

---

## 8.9 Cleanup Rules

### Sandbox Cleanup

| Condition | Action |
|-----------|--------|
| User idle > 5 min | Save to storage, destroy sandbox |
| Session closed | Save to storage, destroy sandbox |
| Render complete | Keep sandbox 5 more min for iterations |
| E2B timeout (30 min) | Auto-destroyed by E2B, recover from storage |
| Error | Save what possible, destroy sandbox |

### Storage Cleanup

| Condition | Action |
|-----------|--------|
| Project deleted | Delete project folder from storage |
| Render deleted | Delete render files from storage |
| User deleted | Delete all user data |
| Preview video (after 24h) | Delete preview, keep only final |

### Database Cleanup

| Condition | Action |
|-----------|--------|
| Session closed | Mark session as closed |
| Sessions > 30 days old | Delete session records |
| Orphaned sessions | Daily job to cleanup |

---

# Part 9: Plugin Integration

The Animation Generator integrates with Koda's plugin system as an **Agent Plugin (Node-based)**. This section covers how it fits into the broader plugin architecture.

## 9.1 Plugin System Context

### Plugin Types Overview

| Type | Creator | Creates Nodes? | Use Case |
|------|---------|----------------|----------|
| **Simple** | Anyone (No-Code) | No (single node) | Text/image analysis with AI |
| **Transform** | Official | No (single node) | Image processing via APIs |
| **Agent** | Official | Yes (multi-node) | Complex workflows, sandboxes |

The Animation Generator is an **Agent Plugin** because it:
- Requires a persistent sandbox environment
- Has multi-phase workflow with state
- Produces output files (video)
- Needs long-running execution with checkpointing

### How Animation Generator Differs from Other Agents

| Aspect | Storyboard Generator | Brand Extractor | Animation Generator |
|--------|---------------------|-----------------|---------------------|
| **Rendering** | Modal | Modal | Canvas Node |
| **Sandbox** | None (AI calls only) | E2B Browser | Theatre.js (Docker/E2B) |
| **Duration** | Seconds | Seconds | Minutes |
| **State** | Stateless | Stateless | Phased + Checkpointed |
| **Preview** | None | None | Live stream + Video |
| **Output** | Creates nodes | Creates nodes | Video file |
| **Resumable** | No | No | Yes |

---

## 9.2 Extended Type Definitions

### New Capabilities & Services

```typescript
// Extended from base plugin types

type AgentCapability =
  | 'canvas:read'           // Read existing nodes
  | 'canvas:create'         // Create new nodes
  | 'canvas:connect'        // Create edges
  | 'canvas:group'          // Group nodes
  | 'canvas:modify'         // Modify existing nodes
  | 'storage:upload'        // Upload files
  | 'storage:download'      // Download files
  | 'sandbox:persistent';   // NEW: Long-running sandbox with checkpointing

type AgentService =
  | 'ai'                    // AI generation/analysis
  | 'e2b'                   // E2B browser sandbox
  | 'theatre-sandbox'       // NEW: Theatre.js sandbox (Docker or E2B)
  | 'render'                // NEW: Video render pipeline
  | 'storage'               // File storage
  | 'external-api';         // External API calls
```

### Agent Plugin Extended Interface

```typescript
interface AgentPlugin extends PluginBase {
  type: 'agent';

  // Rendering mode
  rendering: {
    mode: 'node' | 'modal';
    component: string;                    // React component name
    defaultSize?: { width: number; height: number | 'auto' };
    resizable?: boolean;
    collapsible?: boolean;
  };

  // For modal-based agents
  modalConfig?: {
    size: 'small' | 'medium' | 'large' | 'fullscreen';
    title: string;
  };

  // For persistent sandbox agents (NEW)
  sandboxConfig?: PersistentSandboxConfig;

  // Phased workflow definition (NEW)
  phases?: PhaseDefinition[];

  // Canvas connection handles (for node-based)
  handles?: PluginHandles;

  capabilities: AgentCapability[];
  services: AgentService[];
}
```

### Persistent Sandbox Configuration

```typescript
interface PersistentSandboxConfig {
  type: 'theatre' | 'code' | 'e2b-browser';
  template: string;               // Docker image or E2B template ID
  timeout: number;                // Max lifetime in seconds
  checkpointInterval: number;     // Sync to storage every N seconds
  idleTimeout: number;            // Destroy after N seconds idle
  resources?: {
    cpu?: number;
    memory?: string;
  };
}
```

### Phase Definitions

```typescript
interface PhaseDefinition {
  id: string;
  label: string;
  initial?: boolean;              // Starting phase
  terminal?: boolean;             // End phases (complete, error)
  skippable?: boolean;            // Can be auto-skipped by agent
  requiresApproval?: boolean;     // Needs user action to proceed
  showProgress?: boolean;         // Show progress UI (todos, thinking)
}
```

### Plugin Handles (Canvas Connections)

```typescript
interface PluginHandles {
  inputs: PluginHandle[];
  outputs: PluginHandle[];
}

interface PluginHandle {
  id: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'media' | 'json' | 'any';
  required?: boolean;
  multiple?: boolean;
  optional?: boolean;
}
```

---

## 9.3 Animation Generator Plugin Definition

```typescript
// src/lib/plugins/official/agents/animation-generator/index.ts

import { AgentPlugin } from '@/lib/plugins/types';

export const animationGeneratorPlugin: AgentPlugin = {
  id: "animation-generator",
  name: "Animation Generator",
  description: "Create Theatre.js animations from text descriptions",
  icon: "🎬",
  category: "generation",
  type: "agent",
  version: "1.0.0",
  author: {
    type: "official",
    name: "Koda Team",
    verified: true
  },
  visibility: "public",

  // ─────────────────────────────────────────────────────────────
  // RENDERING: Node-based (renders directly on canvas)
  // ─────────────────────────────────────────────────────────────
  rendering: {
    mode: "node",
    component: "AnimationNode",
    defaultSize: { width: 420, height: "auto" },
    resizable: true,
    collapsible: true
  },

  // ─────────────────────────────────────────────────────────────
  // CAPABILITIES: What this plugin can do
  // ─────────────────────────────────────────────────────────────
  capabilities: [
    "canvas:read",              // Read connected input nodes
    "storage:upload",           // Upload rendered videos
    "sandbox:persistent"        // Long-running sandbox with state
  ],

  // ─────────────────────────────────────────────────────────────
  // SERVICES: What infrastructure it needs
  // ─────────────────────────────────────────────────────────────
  services: [
    "ai",                       // Claude for planning/code generation
    "theatre-sandbox",          // Theatre.js sandbox environment
    "render",                   // Puppeteer + FFmpeg pipeline
    "storage"                   // Video/asset storage
  ],

  // ─────────────────────────────────────────────────────────────
  // SANDBOX: Persistent Theatre.js environment
  // ─────────────────────────────────────────────────────────────
  sandboxConfig: {
    type: "theatre",
    template: "koda-animation-sandbox",   // Docker image or E2B template
    timeout: 1800,                        // 30 min max lifetime
    checkpointInterval: 30,               // Sync every 30 seconds
    idleTimeout: 300,                     // Destroy after 5 min idle
    resources: {
      cpu: 2,
      memory: "4GB"
    }
  },

  // ─────────────────────────────────────────────────────────────
  // PHASES: Multi-step workflow states
  // ─────────────────────────────────────────────────────────────
  phases: [
    { id: "idle", label: "Ready", initial: true },
    { id: "question", label: "Style Selection", skippable: true },
    { id: "plan", label: "Planning", requiresApproval: true },
    { id: "executing", label: "Creating", showProgress: true },
    { id: "preview", label: "Preview", requiresApproval: true },
    { id: "complete", label: "Complete", terminal: true },
    { id: "error", label: "Error", terminal: true }
  ],

  // ─────────────────────────────────────────────────────────────
  // HANDLES: Canvas input/output connections
  // ─────────────────────────────────────────────────────────────
  handles: {
    inputs: [
      { id: "prompt", name: "Prompt", type: "text", required: true },
      { id: "style", name: "Style", type: "text", optional: true },
      { id: "assets", name: "Assets", type: "media", multiple: true, optional: true }
    ],
    outputs: [
      { id: "video", name: "Video", type: "video" },
      { id: "thumbnail", name: "Thumbnail", type: "image" }
    ]
  }
};
```

---

## 9.4 Runtime State Shape

The Animation Node maintains this state structure during execution:

```typescript
interface AnimationNodeState {
  // ─────────────────────────────────────────────────────────────
  // CORE STATE
  // ─────────────────────────────────────────────────────────────
  nodeId: string;
  projectId: string;
  phase: 'idle' | 'question' | 'plan' | 'executing' | 'preview' | 'complete' | 'error';

  // ─────────────────────────────────────────────────────────────
  // PHASE-SPECIFIC DATA
  // ─────────────────────────────────────────────────────────────

  // Question Phase
  question?: {
    text: string;
    options: {
      id: string;
      label: string;
      description?: string;
    }[];
    customInput?: boolean;
  };

  // Plan Phase
  plan?: {
    scenes: {
      number: number;
      title: string;
      duration: number;
      description: string;
      animationNotes: string;
    }[];
    totalDuration: number;
    style: string;
    fps: number;
  };

  // Executing Phase
  execution?: {
    todos: {
      id: string;
      label: string;
      status: 'pending' | 'active' | 'done';
    }[];
    thinking: string;                    // Current activity message
    messages: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }[];
    files: string[];                     // List of generated files
  };

  // Preview Phase
  preview?: {
    videoUrl: string;                    // Preview video URL
    streamUrl?: string;                  // Live dev server stream
    duration: number;
  };

  // Complete Phase
  output?: {
    videoUrl: string;
    thumbnailUrl: string;
    duration: number;
    resolution: string;
    fileSize: number;
  };

  // Error Phase
  error?: {
    message: string;
    code: string;
    canRetry: boolean;
    details?: string;
  };

  // ─────────────────────────────────────────────────────────────
  // SANDBOX STATE
  // ─────────────────────────────────────────────────────────────
  sandboxId?: string;                    // Docker container or E2B sandbox ID
  sandboxStatus?: 'creating' | 'ready' | 'busy' | 'destroyed';
  lastCheckpoint?: string;               // ISO timestamp

  // ─────────────────────────────────────────────────────────────
  // TIMESTAMPS
  // ─────────────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
  startedAt?: string;                    // When execution started
  completedAt?: string;                  // When finished
}
```

---

## 9.5 File Structure

```
src/lib/plugins/official/agents/animation-generator/
│
├── index.ts                          # Plugin definition (exported)
│
├── AnimationNode.tsx                 # Main canvas node component
│   │
│   └── Renders phase-specific UI:
│       ├── IdleState      → Input form
│       ├── QuestionState  → Style selection
│       ├── PlanState      → Plan review
│       ├── ExecutingState → Progress + chat
│       ├── PreviewState   → Video player
│       ├── CompleteState  → Final output
│       └── ErrorState     → Error + retry
│
├── phases/                           # Phase UI components
│   ├── IdlePhase.tsx
│   ├── QuestionPhase.tsx
│   ├── PlanPhase.tsx
│   ├── ExecutingPhase.tsx
│   └── PreviewPhase.tsx
│
├── agent/                            # Agent logic
│   ├── system-prompt.ts              # SYSTEM_INSTRUCTIONS for Claude
│   ├── tools.ts                      # Tool definitions
│   ├── executor.ts                   # Agent execution loop
│   └── phases/                       # Phase-specific agent logic
│       ├── question.ts
│       ├── plan.ts
│       ├── execute.ts
│       └── iterate.ts
│
├── sandbox/                          # Sandbox management
│   ├── adapter.ts                    # Docker/E2B abstraction
│   ├── checkpoint.ts                 # Save/restore logic
│   ├── sync.ts                       # File sync to storage
│   └── template/                     # Sandbox template files
│       ├── Dockerfile
│       ├── package.json
│       └── template/
│           ├── src/
│           ├── scripts/
│           └── public/
│
├── render/                           # Rendering pipeline
│   ├── pipeline.ts                   # Puppeteer + FFmpeg orchestration
│   ├── frame-capture.ts              # Frame capture logic
│   ├── encode.ts                     # FFmpeg encoding
│   └── presets.ts                    # Quality presets
│
├── hooks/                            # React hooks
│   ├── useAnimationNode.ts           # Main state hook
│   ├── useAgentExecution.ts          # Agent communication
│   ├── useSandbox.ts                 # Sandbox lifecycle
│   └── usePreview.ts                 # Preview streaming
│
└── api/                              # API routes (if needed)
    ├── start.ts                      # Start execution
    ├── iterate.ts                    # Send feedback
    ├── render.ts                     # Trigger render
    └── events.ts                     # SSE/WebSocket events
```

---

## 9.6 Integration with Plugin Registry

### Registration

```typescript
// src/lib/plugins/official/index.ts

import { animationGeneratorPlugin } from './agents/animation-generator';
import { storyboardGeneratorPlugin } from './agents/storyboard-generator';
import { brandExtractorPlugin } from './agents/brand-extractor';
// ... other plugins

export const officialPlugins = [
  // Agent plugins
  animationGeneratorPlugin,
  storyboardGeneratorPlugin,
  brandExtractorPlugin,

  // Transform plugins
  aspectRatioConverterPlugin,
  backgroundRemoverPlugin,

  // Simple plugins
  reversePromptPlugin,
  captionGeneratorPlugin,
];
```

### Canvas Node Rendering

```typescript
// src/components/canvas/nodes/PluginNode.tsx

import { AnimationNode } from '@/lib/plugins/official/agents/animation-generator/AnimationNode';
import { StoryboardNode } from '@/lib/plugins/official/agents/storyboard-generator/StoryboardNode';

const PLUGIN_COMPONENTS: Record<string, React.ComponentType<PluginNodeProps>> = {
  'animation-generator': AnimationNode,
  'storyboard-generator': StoryboardNode,
  // ... other node-based plugins
};

export function PluginNode({ pluginId, ...props }: PluginNodeProps) {
  const Component = PLUGIN_COMPONENTS[pluginId];
  if (!Component) {
    return <GenericPluginNode pluginId={pluginId} {...props} />;
  }
  return <Component {...props} />;
}
```

### Service Injection

```typescript
// src/lib/plugins/executor/context.ts

interface AgentExecutionContext {
  // Standard services
  ai: AIService;
  storage: StorageService;
  canvas: CanvasAPI;

  // Specialized services (injected based on plugin.services)
  theatreSandbox?: TheatreSandboxService;
  render?: RenderService;
  e2b?: E2BService;

  // Utilities
  onProgress: (percent: number, message: string) => void;
  onPhaseChange: (phase: string) => void;
  notify: (message: string, type: 'info' | 'success' | 'error') => void;
}

// Service injection based on plugin definition
function createExecutionContext(plugin: AgentPlugin): AgentExecutionContext {
  const context: AgentExecutionContext = {
    ai: getAIService(),
    storage: getStorageService(),
    canvas: getCanvasAPI(),
    onProgress: () => {},
    onPhaseChange: () => {},
    notify: () => {},
  };

  // Inject specialized services based on plugin.services
  if (plugin.services.includes('theatre-sandbox')) {
    context.theatreSandbox = getTheatreSandboxService();
  }
  if (plugin.services.includes('render')) {
    context.render = getRenderService();
  }
  if (plugin.services.includes('e2b')) {
    context.e2b = getE2BService();
  }

  return context;
}
```

---

## 9.7 Summary: Animation Generator in Plugin Context

| Aspect | Value |
|--------|-------|
| **Plugin Type** | Agent |
| **Rendering Mode** | Node-based (on canvas) |
| **Key Capability** | `sandbox:persistent` |
| **Key Services** | `ai`, `theatre-sandbox`, `render`, `storage` |
| **Sandbox Type** | Theatre.js (Docker or E2B) |
| **State Pattern** | Phased with checkpointing |
| **Handles** | Inputs: prompt, style, assets / Outputs: video, thumbnail |

The Animation Generator is the most complex plugin type in the system, combining:
- Multi-phase workflow with user approval gates
- Persistent sandbox with checkpointing
- Live preview streaming
- Video rendering pipeline
- Full state restoration on reconnect

This serves as the reference implementation for other complex agent plugins that require long-running sandboxes and stateful workflows.

---

# Part 10: Mastra Agent Implementation

This section details the agent implementation using [Mastra](https://mastra.ai/docs/), including the two-agent architecture pattern, system instructions, tool definitions, and subagent streaming.

## 10.1 Two-Agent Architecture Pattern

### Why Two Agents?

The Animation Generator has two distinct concerns:

| Concern | Knowledge Required | Complexity |
|---------|-------------------|------------|
| **Workflow orchestration** | Phases, user interaction, decisions | Low-medium |
| **Theatre.js code generation** | API details, patterns, React Three Fiber | **Heavy** |

Combining these into a single agent creates problems:
- Bloated system prompt (~20k+ tokens)
- Agent loses focus on workflow when generating code
- Hard to improve code generation without affecting orchestration
- Difficult to swap models for different tasks

### The Solution: Orchestrator + Code Generator

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT                            │
│                       (~4k tokens)                               │
│                                                                 │
│  "I manage the workflow, talk to the user, and coordinate"      │
│                                                                 │
│  Knows:                                                         │
│  • Phases and transitions                                       │
│  • When to ask questions vs proceed                             │
│  • How to interpret user feedback                               │
│  • Animation timing principles (for planning)                   │
│                                                                 │
│  Does NOT know:                                                 │
│  • Theatre.js API details                                       │
│  • React Three Fiber specifics                                  │
│  • Specific code patterns                                       │
│                                                                 │
│  Tools:                                                         │
│  ├── generate_code ──────────────────────┐ (subagent-as-tool)   │
│  ├── sandbox_write_file                  │                      │
│  ├── sandbox_run_command                 │                      │
│  ├── render_preview                      │                      │
│  ├── update_todo                         │                      │
│  └── set_thinking                        │                      │
└──────────────────────────────────────────│──────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CODE GENERATOR SUBAGENT                         │
│                     (~12-15k tokens)                             │
│                                                                 │
│  "I am a Theatre.js expert. Give me specs, I return code."      │
│                                                                 │
│  Knows:                                                         │
│  • Theatre.js API (sequences, keyframes, sheets)                │
│  • React Three Fiber integration (@theatre/r3f)                 │
│  • Easing functions and animation math                          │
│  • File structure conventions                                   │
│  • Export/render patterns for video output                      │
│                                                                 │
│  Does NOT know:                                                 │
│  • User context or conversation history                         │
│  • Phase management                                             │
│  • What to do next                                              │
│                                                                 │
│  Input: Structured task description                             │
│  Output: Complete file contents (streamed JSON)                 │
│  No tools — pure generation                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Benefits

| Benefit | Explanation |
|---------|-------------|
| **Separation of concerns** | Orchestrator stays focused on workflow, code generator on code |
| **Smaller prompts** | Each agent has only what it needs |
| **Streaming code** | Subagent output streams to UI for live feedback |
| **Independent improvement** | Can upgrade code generator without touching orchestration |
| **Model flexibility** | Could use different models for each task |
| **Clean iteration** | Orchestrator decides **what** to change, code generator knows **how** |

---

## 10.2 Orchestrator Agent

### Definition

```typescript
// src/lib/agents/orchestrator-agent.ts

import { Agent } from '@mastra/core';
import { anthropic } from '@mastra/anthropic';

import { ORCHESTRATOR_INSTRUCTIONS } from './instructions/orchestrator';
import { generateCodeTool } from './tools/generate-code';
import { sandboxTools } from './tools/sandbox';
import { renderTools } from './tools/render';
import { uiTools } from './tools/ui';

export const orchestratorAgent = new Agent({
  name: 'animation-orchestrator',
  model: anthropic('claude-sonnet-4-20250514'),
  instructions: ORCHESTRATOR_INSTRUCTIONS,
  tools: {
    // Subagent as tool (streams code generation)
    generate_code: generateCodeTool,
    
    // Sandbox tools
    ...sandboxTools,
    
    // Render tools
    ...renderTools,
    
    // UI communication tools
    ...uiTools,
  },
});
```

### System Instructions

```typescript
// src/lib/agents/instructions/orchestrator.ts

export const ORCHESTRATOR_INSTRUCTIONS = `
# Animation Orchestrator

You coordinate the animation creation workflow. You manage phases, interact with users, and delegate code generation to a specialized tool.

## Your Role

- Guide users through the animation creation process
- Make decisions about workflow (skip questions? need more info?)
- Create animation plans with timing and scene breakdowns
- Delegate ALL code generation to the \`generate_code\` tool
- Handle user feedback and determine what needs to change
- You do NOT write Theatre.js code yourself — always use generate_code

## Workflow Phases

### PHASE: question
**When**: Style is ambiguous or unspecified.

Decide:
- If prompt says "smooth", "bouncy", "cinematic" → style is clear, skip to plan
- If prompt is generic like "animate a logo" → ask ONE question

Question format:
\`\`\`
What animation style fits your vision?

1. **Playful & Bouncy** — Overshoots, elastic motion, energetic feel
2. **Smooth & Minimal** — Subtle, flowing, sophisticated movements
3. **Cinematic & Dramatic** — Building tension, camera-like motion
4. **Custom** — Describe your own style
\`\`\`

Use \`request_approval\` with type: "question" and the options.

### PHASE: plan
**When**: Style is known, ready to plan scenes.

Create a scene breakdown:
- 3-7 scenes for short animations (5-15s)
- 5-12 scenes for longer animations (15-60s)
- Minimum 1.5 seconds per scene
- Each scene: title, duration, description, animation notes

Plan format:
\`\`\`
**Animation Plan** (Total: Xs)

**Scene 1: [Title]** (0:00–0:02)
What happens: [description]
Animation: [techniques, easing, movements]

**Scene 2: [Title]** (0:02–0:04)
...
\`\`\`

Use \`request_approval\` with type: "plan" and the plan content.

### PHASE: executing
**When**: User approved the plan.

Execution steps:
1. Create todo list from plan scenes
2. For each todo:
   a. \`update_todo(id, "active")\`
   b. \`set_thinking("Creating [description]...")\`
   c. Call \`generate_code\` with task specification
   d. Write each returned file with \`sandbox_write_file\`
   e. \`update_todo(id, "done")\`
3. After all code: \`sandbox_run_command("bun run dev")\`
4. \`render_preview({ duration })\`
5. Show preview to user

CRITICAL:
- ALWAYS use generate_code for any code — never write code yourself
- Update thinking frequently so user sees progress
- If generate_code returns an error, report it and retry

### PHASE: preview
**When**: Preview video is ready.

- Preview displays automatically
- Wait for user response
- If approved: render final quality
- If rejected with feedback: go to iteration

### PHASE: iteration
**When**: User gives feedback on preview.

Steps:
1. Analyze feedback: What needs to change?
2. Identify affected files (usually 1-2, not all)
3. Call \`generate_code\` with:
   - task: "modify_existing"
   - file path
   - current content
   - change description
4. Write updated file(s)
5. Re-render preview

Examples:
- "Make it faster" → Adjust timing in project.ts
- "Ball should be red" → Modify Ball.tsx color prop
- "Add more bounce" → Adjust easing in component
- "Different layout" → Modify scene composition

## Style-to-Animation Mapping

When planning, use these guidelines:

| Style | Easing | Motion | Timing |
|-------|--------|--------|--------|
| Playful | easeOutBack, easeOutElastic | Overshoot, squash-stretch | Fast, snappy |
| Smooth | easeInOutCubic, easeOutQuint | Subtle, flowing | Slower, deliberate |
| Cinematic | easeInOutQuart, custom bezier | Camera moves, depth | Building tension |

## Communication

- Be concise in thinking messages (under 50 chars)
- Explain changes clearly when iterating
- If something fails, tell the user what happened
- Don't apologize excessively — just fix and move on

## What You Do NOT Do

- Write Theatre.js or React code (use generate_code)
- Know Theatre.js API details (generate_code knows)
- Generate file contents directly
- Skip the generate_code tool for "small" changes
`;
```

---

## 10.3 Code Generator Subagent

### Definition

```typescript
// src/lib/agents/code-generator-agent.ts

import { Agent } from '@mastra/core';
import { anthropic } from '@mastra/anthropic';

import { CODE_GENERATOR_INSTRUCTIONS } from './instructions/code-generator';

export const codeGeneratorAgent = new Agent({
  name: 'theatre-code-generator',
  model: anthropic('claude-sonnet-4-20250514'),
  instructions: CODE_GENERATOR_INSTRUCTIONS,
  // No tools — pure generation
});
```

### System Instructions

```typescript
// src/lib/agents/instructions/code-generator.ts

export const CODE_GENERATOR_INSTRUCTIONS = `
# Theatre.js Code Generator

You are a specialist in Theatre.js animation code. You receive structured task descriptions and return complete, working code files.

## Your Role

- Generate production-quality Theatre.js code
- Return complete files (never placeholders or TODOs)
- Follow Theatre.js patterns exactly
- Output valid JSON with file contents

## Output Format

ALWAYS return valid JSON in this exact structure:

\`\`\`json
{
  "files": [
    {
      "path": "src/theatre/project.ts",
      "content": "// Complete file content here..."
    },
    {
      "path": "src/components/Ball.tsx",
      "content": "// Complete file content here..."
    }
  ],
  "summary": "Brief description of what was created"
}
\`\`\`

## Theatre.js Knowledge

### Project Setup

\`\`\`typescript
// src/theatre/project.ts
import { getProject } from '@theatre/core';

export const project = getProject('Animation');
export const sheet = project.sheet('Main');

export const SEQUENCE_TIMINGS = {
  duration: 5,    // seconds
  fps: 60,
};

// Position for sequencer
export const sequence = sheet.sequence;
\`\`\`

### Animated Component Pattern

\`\`\`typescript
// src/components/Ball.tsx
import { useRef } from 'react';
import { useCurrentFrame } from '../hooks/useCurrentFrame';
import { SEQUENCE_TIMINGS } from '../theatre/project';
import { easeOutBack } from '../utils/easing';

interface BallProps {
  color?: string;
  size?: number;
}

export function Ball({ color = '#3B82F6', size = 1 }: BallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const frame = useCurrentFrame();
  
  // Calculate animation progress
  const time = frame / SEQUENCE_TIMINGS.fps;
  const duration = SEQUENCE_TIMINGS.duration;
  
  // Animation logic
  const bounceProgress = Math.min(time / 2, 1); // First 2 seconds
  const y = easeOutBack(bounceProgress) * 2;
  
  return (
    <mesh ref={meshRef} position={[0, y, 0]}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
\`\`\`

### useCurrentFrame Hook (CRITICAL)

\`\`\`typescript
// src/hooks/useCurrentFrame.ts
import { useEffect, useState } from 'react';
import { sequence } from '../theatre/project';

export function useCurrentFrame(): number {
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    // For export mode (controlled externally)
    const handleSeek = (e: CustomEvent) => {
      setFrame(e.detail.frame);
    };
    window.addEventListener('theatre-seek', handleSeek as EventListener);
    
    // For preview mode (auto-play)
    let rafId: number;
    const startTime = performance.now();
    
    const tick = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const currentFrame = Math.floor(elapsed * 60) % (SEQUENCE_TIMINGS.duration * 60);
      setFrame(currentFrame);
      rafId = requestAnimationFrame(tick);
    };
    
    if (!window.__EXPORT_MODE__) {
      rafId = requestAnimationFrame(tick);
    }
    
    return () => {
      window.removeEventListener('theatre-seek', handleSeek as EventListener);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  
  return frame;
}
\`\`\`

### Easing Functions

\`\`\`typescript
// src/utils/easing.ts

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 :
    Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

export function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

// For custom bezier curves
export function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  return function(t: number): number {
    // Simplified cubic bezier implementation
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;
    return ((ax * t + bx) * t + cx) * t;
  };
}
\`\`\`

### App.tsx Pattern

\`\`\`typescript
// src/App.tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { MainScene } from './scenes/MainScene';
import './styles.css';

// Export mode flag
declare global {
  interface Window {
    __EXPORT_MODE__?: boolean;
    __EXPORT_SEEK_TO__?: (frame: number) => void;
  }
}

export default function App() {
  return (
    <div className="w-full h-screen bg-black">
      <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
        <Environment preset="studio" />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        <MainScene />
        
        {!window.__EXPORT_MODE__ && <OrbitControls />}
      </Canvas>
    </div>
  );
}
\`\`\`

### Scene Compositor

\`\`\`typescript
// src/scenes/MainScene.tsx
import { Ball } from '../components/Ball';
import { useCurrentFrame } from '../hooks/useCurrentFrame';
import { SEQUENCE_TIMINGS } from '../theatre/project';

export function MainScene() {
  const frame = useCurrentFrame();
  const time = frame / SEQUENCE_TIMINGS.fps;
  
  return (
    <group>
      {/* Scene 1: Ball enters */}
      <Ball color="#3B82F6" />
      
      {/* Add more elements based on scenes */}
    </group>
  );
}
\`\`\`

### Export Script

\`\`\`javascript
// scripts/export-video.cjs
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 60;
const DURATION = 5; // seconds
const WIDTH = 1920;
const HEIGHT = 1080;

async function exportVideo() {
  // Ensure exports directory
  const exportsDir = path.join(__dirname, '../exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });
  
  // Set export mode
  await page.evaluateOnNewDocument(() => {
    window.__EXPORT_MODE__ = true;
  });
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.waitForTimeout(2000); // Let scene initialize
  
  const totalFrames = FPS * DURATION;
  
  for (let frame = 0; frame < totalFrames; frame++) {
    // Seek to frame
    await page.evaluate((f) => {
      window.dispatchEvent(new CustomEvent('theatre-seek', { detail: { frame: f } }));
    }, frame);
    
    // Wait for render
    await page.waitForTimeout(16);
    
    // Screenshot
    const framePath = path.join(exportsDir, \`frame_\${String(frame).padStart(5, '0')}.png\`);
    await page.screenshot({ path: framePath });
    
    if (frame % 60 === 0) {
      console.log(\`Frame \${frame}/\${totalFrames}\`);
    }
  }
  
  await browser.close();
  
  // Encode with FFmpeg
  const outputPath = path.join(__dirname, '../output.mp4');
  execSync(\`ffmpeg -y -framerate \${FPS} -i \${exportsDir}/frame_%05d.png -c:v libx264 -pix_fmt yuv420p -crf 18 \${outputPath}\`);
  
  // Cleanup frames
  fs.readdirSync(exportsDir).forEach(file => {
    fs.unlinkSync(path.join(exportsDir, file));
  });
  
  console.log(\`Video exported to \${outputPath}\`);
}

exportVideo().catch(console.error);
\`\`\`

## Task Types

### initial_setup
Create the foundational project files.

Input:
\`\`\`json
{
  "task": "initial_setup",
  "style": "playful",
  "plan": {
    "scenes": [...],
    "duration": 5,
    "fps": 60
  }
}
\`\`\`

Output files:
- src/theatre/project.ts
- src/utils/easing.ts
- src/hooks/useCurrentFrame.ts
- src/App.tsx
- src/main.tsx

### create_component
Create an animated component.

Input:
\`\`\`json
{
  "task": "create_component",
  "name": "BouncingBall",
  "description": "A ball that bounces with playful overshoot",
  "animations": [
    { "property": "position.y", "from": 0, "to": 2, "easing": "easeOutBack" }
  ],
  "timing": { "start": 0, "duration": 2 }
}
\`\`\`

Output files:
- src/components/[Name].tsx

### create_scene
Create a scene compositor.

Input:
\`\`\`json
{
  "task": "create_scene",
  "scenes": [
    { "start": 0, "end": 2, "description": "Ball enters" },
    { "start": 2, "end": 4, "description": "Ball bounces" }
  ],
  "components": ["Ball", "Shadow"]
}
\`\`\`

Output files:
- src/scenes/MainScene.tsx

### modify_existing
Modify an existing file.

Input:
\`\`\`json
{
  "task": "modify_existing",
  "file": "src/components/Ball.tsx",
  "currentContent": "// existing code...",
  "change": "Change ball color from blue to red"
}
\`\`\`

Output files:
- The modified file only

## Rules

1. ALWAYS return valid JSON with "files" array
2. NEVER include placeholder comments like "// add code here"
3. ALWAYS include all imports
4. Code must work without modification
5. Follow the exact patterns shown above
6. For modify_existing: return the COMPLETE updated file, not a diff
`;
```

---

## 10.4 Subagent-as-Tool Implementation

The orchestrator calls the code generator as a tool, with streaming support:

```typescript
// src/lib/agents/tools/generate-code.ts

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { codeGeneratorAgent } from '../code-generator-agent';

// Input schema
const GenerateCodeInputSchema = z.object({
  task: z.enum(['initial_setup', 'create_component', 'create_scene', 'modify_existing']),
  
  // For initial_setup
  style: z.string().optional(),
  plan: z.object({
    scenes: z.array(z.object({
      title: z.string(),
      start: z.number(),
      end: z.number(),
      description: z.string(),
    })),
    duration: z.number(),
    fps: z.number(),
  }).optional(),
  
  // For create_component
  name: z.string().optional(),
  description: z.string().optional(),
  animations: z.array(z.object({
    property: z.string(),
    from: z.any(),
    to: z.any(),
    easing: z.string(),
  })).optional(),
  timing: z.object({
    start: z.number(),
    duration: z.number(),
  }).optional(),
  
  // For create_scene
  scenes: z.array(z.object({
    start: z.number(),
    end: z.number(),
    description: z.string(),
  })).optional(),
  components: z.array(z.string()).optional(),
  
  // For modify_existing
  file: z.string().optional(),
  currentContent: z.string().optional(),
  change: z.string().optional(),
});

// Output schema
interface GenerateCodeOutput {
  files: {
    path: string;
    content: string;
  }[];
  summary: string;
}

export const generateCodeTool = createTool({
  id: 'generate_code',
  description: `Generate Theatre.js animation code. This tool calls a specialized code generation agent.
  
Use this for ALL code generation tasks:
- initial_setup: Create foundational project files
- create_component: Create an animated component
- create_scene: Create a scene compositor
- modify_existing: Modify an existing file

Returns an array of files with their complete contents.`,

  inputSchema: GenerateCodeInputSchema,
  outputSchema: z.object({
    files: z.array(z.object({
      path: z.string(),
      content: z.string(),
    })),
    summary: z.string(),
  }),

  execute: async ({ context, params }) => {
    // Format the request for the code generator
    const prompt = formatCodeGenerationPrompt(params);
    
    // Stream from the subagent
    const stream = await codeGeneratorAgent.stream({
      messages: [{ role: 'user', content: prompt }],
    });
    
    let fullResponse = '';
    
    for await (const chunk of stream) {
      fullResponse += chunk.text || '';
      
      // Emit chunk to UI for live code preview
      if (context.emitEvent) {
        context.emitEvent('code_chunk', { 
          content: chunk.text,
          accumulated: fullResponse,
        });
      }
    }
    
    // Parse the JSON response
    try {
      // Extract JSON from response (may have markdown code blocks)
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const result: GenerateCodeOutput = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!result.files || !Array.isArray(result.files)) {
        throw new Error('Invalid response structure: missing files array');
      }
      
      return result;
      
    } catch (error) {
      // If parsing fails, report error
      console.error('Failed to parse code generator response:', error);
      console.error('Raw response:', fullResponse);
      
      throw new Error(`Code generation failed: ${error.message}`);
    }
  },
});

function formatCodeGenerationPrompt(params: z.infer<typeof GenerateCodeInputSchema>): string {
  return `Generate Theatre.js code for the following task:

Task Type: ${params.task}

${JSON.stringify(params, null, 2)}

Return ONLY valid JSON with the files array. No explanation text before or after.`;
}
```

---

## 10.5 Other Tool Definitions

### Sandbox Tools

```typescript
// src/lib/agents/tools/sandbox.ts

import { createTool } from '@mastra/core';
import { z } from 'zod';

export const sandboxWriteFileTool = createTool({
  id: 'sandbox_write_file',
  description: 'Write a file to the sandbox filesystem',
  inputSchema: z.object({
    path: z.string().describe('Relative path, e.g., "src/App.tsx"'),
    content: z.string().describe('Complete file content'),
  }),
  execute: async ({ context, params }) => {
    const { sandboxService } = context.services;
    await sandboxService.writeFile(params.path, params.content);
    
    // Emit for UI update
    context.emitEvent?.('file_written', { path: params.path });
    
    return { success: true, path: params.path };
  },
});

export const sandboxRunCommandTool = createTool({
  id: 'sandbox_run_command',
  description: 'Run a shell command in the sandbox',
  inputSchema: z.object({
    command: z.string().describe('Shell command to run'),
    background: z.boolean().default(false).describe('Run in background (for servers)'),
    timeout: z.number().default(30000).describe('Timeout in milliseconds'),
  }),
  execute: async ({ context, params }) => {
    const { sandboxService } = context.services;
    
    if (params.background) {
      const { pid } = await sandboxService.runBackground(params.command);
      return { success: true, pid, background: true };
    }
    
    const result = await sandboxService.runCommand(params.command, {
      timeout: params.timeout,
    });
    
    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  },
});

export const sandboxReadFileTool = createTool({
  id: 'sandbox_read_file',
  description: 'Read a file from the sandbox filesystem',
  inputSchema: z.object({
    path: z.string().describe('Relative path to read'),
  }),
  execute: async ({ context, params }) => {
    const { sandboxService } = context.services;
    const content = await sandboxService.readFile(params.path);
    return { content };
  },
});

export const sandboxTools = {
  sandbox_write_file: sandboxWriteFileTool,
  sandbox_run_command: sandboxRunCommandTool,
  sandbox_read_file: sandboxReadFileTool,
};
```

### Render Tools

```typescript
// src/lib/agents/tools/render.ts

import { createTool } from '@mastra/core';
import { z } from 'zod';

export const renderPreviewTool = createTool({
  id: 'render_preview',
  description: 'Render a preview quality video',
  inputSchema: z.object({
    duration: z.number().describe('Video duration in seconds'),
  }),
  execute: async ({ context, params }) => {
    const { renderService, sandboxService, storageService } = context.services;
    
    context.emitEvent?.('render_start', { quality: 'preview' });
    
    const result = await renderService.renderPreview({
      sandboxId: context.sandboxId,
      duration: params.duration,
      onProgress: (percent, stage) => {
        context.emitEvent?.('render_progress', { percent, stage });
      },
    });
    
    // Upload to storage
    const videoUrl = await storageService.upload(result.videoBuffer, {
      filename: `preview-${Date.now()}.mp4`,
      contentType: 'video/mp4',
    });
    
    const thumbnailUrl = await storageService.upload(result.thumbnailBuffer, {
      filename: `thumb-${Date.now()}.jpg`,
      contentType: 'image/jpeg',
    });
    
    context.emitEvent?.('render_complete', { videoUrl, thumbnailUrl });
    
    return { videoUrl, thumbnailUrl, duration: params.duration };
  },
});

export const renderFinalTool = createTool({
  id: 'render_final',
  description: 'Render final high-quality video',
  inputSchema: z.object({
    duration: z.number(),
    resolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
    fps: z.enum(['30', '60']).default('60'),
  }),
  execute: async ({ context, params }) => {
    const { renderService, storageService } = context.services;
    
    context.emitEvent?.('render_start', { quality: 'final' });
    
    const result = await renderService.renderFinal({
      sandboxId: context.sandboxId,
      duration: params.duration,
      resolution: params.resolution,
      fps: parseInt(params.fps),
      onProgress: (percent, stage) => {
        context.emitEvent?.('render_progress', { percent, stage });
      },
    });
    
    const videoUrl = await storageService.upload(result.videoBuffer, {
      filename: `final-${Date.now()}.mp4`,
      contentType: 'video/mp4',
    });
    
    const thumbnailUrl = await storageService.upload(result.thumbnailBuffer, {
      filename: `thumb-${Date.now()}.jpg`,
      contentType: 'image/jpeg',
    });
    
    context.emitEvent?.('render_complete', { videoUrl, thumbnailUrl, quality: 'final' });
    
    return { videoUrl, thumbnailUrl, duration: params.duration };
  },
});

export const renderTools = {
  render_preview: renderPreviewTool,
  render_final: renderFinalTool,
};
```

### UI Tools

```typescript
// src/lib/agents/tools/ui.ts

import { createTool } from '@mastra/core';
import { z } from 'zod';

export const updateTodoTool = createTool({
  id: 'update_todo',
  description: 'Update the status of a todo item',
  inputSchema: z.object({
    todoId: z.string(),
    status: z.enum(['pending', 'active', 'done']),
  }),
  execute: async ({ context, params }) => {
    context.emitEvent?.('todo_update', {
      todoId: params.todoId,
      status: params.status,
    });
    return { success: true };
  },
});

export const setThinkingTool = createTool({
  id: 'set_thinking',
  description: 'Update the thinking/status message shown to user (keep under 50 chars)',
  inputSchema: z.object({
    message: z.string().max(100),
  }),
  execute: async ({ context, params }) => {
    context.emitEvent?.('thinking', { message: params.message });
    return { success: true };
  },
});

export const requestApprovalTool = createTool({
  id: 'request_approval',
  description: 'Request user approval for a question, plan, or preview',
  inputSchema: z.object({
    type: z.enum(['question', 'plan', 'preview']),
    content: z.string().describe('The question, plan, or message to show'),
    options: z.array(z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
    })).optional().describe('Options for question type'),
  }),
  execute: async ({ context, params }) => {
    context.emitEvent?.('approval_requested', {
      type: params.type,
      content: params.content,
      options: params.options,
    });
    
    // This pauses execution until user responds
    // The response comes through context.waitForApproval()
    const response = await context.waitForApproval();
    
    return response;
  },
});

export const sendMessageTool = createTool({
  id: 'send_message',
  description: 'Send a message to the user in the chat thread',
  inputSchema: z.object({
    content: z.string(),
  }),
  execute: async ({ context, params }) => {
    context.emitEvent?.('message', {
      role: 'assistant',
      content: params.content,
    });
    return { success: true };
  },
});

export const uiTools = {
  update_todo: updateTodoTool,
  set_thinking: setThinkingTool,
  request_approval: requestApprovalTool,
  send_message: sendMessageTool,
};
```

---

## 10.6 Agent Execution Flow

### Starting Execution

```typescript
// src/lib/agents/execute-animation.ts

import { orchestratorAgent } from './orchestrator-agent';
import { createExecutionContext } from './context';

export async function executeAnimation(params: {
  nodeId: string;
  projectId: string;
  prompt: string;
  style?: string;
  onEvent: (event: AnimationEvent) => void;
}) {
  // Create execution context with services
  const context = await createExecutionContext({
    nodeId: params.nodeId,
    projectId: params.projectId,
    onEvent: params.onEvent,
  });
  
  // Build initial message
  const initialMessage = buildInitialMessage(params);
  
  // Start the agent
  const stream = await orchestratorAgent.stream({
    messages: [{ role: 'user', content: initialMessage }],
    context,
  });
  
  // Process stream
  for await (const chunk of stream) {
    if (chunk.type === 'tool_call') {
      params.onEvent({
        type: 'tool_call',
        tool: chunk.toolName,
        input: chunk.input,
      });
    }
    
    if (chunk.type === 'tool_result') {
      params.onEvent({
        type: 'tool_result',
        tool: chunk.toolName,
        output: chunk.output,
      });
    }
    
    if (chunk.type === 'text') {
      params.onEvent({
        type: 'agent_text',
        content: chunk.text,
      });
    }
  }
}

function buildInitialMessage(params: { prompt: string; style?: string }): string {
  let message = `Create an animation: ${params.prompt}`;
  
  if (params.style) {
    message += `\n\nStyle: ${params.style}`;
  }
  
  return message;
}
```

### Handling User Input Mid-Execution

```typescript
// src/lib/agents/continue-execution.ts

export async function continueExecution(params: {
  nodeId: string;
  userMessage: string;
  context: ExecutionContext;
  onEvent: (event: AnimationEvent) => void;
}) {
  const stream = await orchestratorAgent.stream({
    messages: [
      ...params.context.messageHistory,
      { role: 'user', content: params.userMessage },
    ],
    context: params.context,
  });
  
  for await (const chunk of stream) {
    // Same processing as above
  }
}
```

---

## 10.7 Context Management

### Execution Context

```typescript
// src/lib/agents/context.ts

export interface ExecutionContext {
  // Identifiers
  nodeId: string;
  projectId: string;
  sandboxId?: string;
  
  // Services
  services: {
    sandboxService: SandboxService;
    storageService: StorageService;
    renderService: RenderService;
  };
  
  // State
  phase: AnimationPhase;
  plan?: AnimationPlan;
  todos: Todo[];
  files: Map<string, string>;  // path -> content
  messageHistory: Message[];
  
  // Event emission
  emitEvent?: (type: string, payload: any) => void;
  
  // Approval handling
  waitForApproval: () => Promise<ApprovalResponse>;
}

export async function createExecutionContext(params: {
  nodeId: string;
  projectId: string;
  onEvent: (event: AnimationEvent) => void;
}): Promise<ExecutionContext> {
  // Get or create sandbox
  const sandboxService = await getSandboxService();
  const sandboxId = await sandboxService.getOrCreate(params.projectId);
  
  // Load existing state if resuming
  const existingState = await loadProjectState(params.projectId);
  
  return {
    nodeId: params.nodeId,
    projectId: params.projectId,
    sandboxId,
    
    services: {
      sandboxService,
      storageService: getStorageService(),
      renderService: getRenderService(),
    },
    
    phase: existingState?.phase || 'idle',
    plan: existingState?.plan,
    todos: existingState?.todos || [],
    files: new Map(Object.entries(existingState?.files || {})),
    messageHistory: existingState?.messages || [],
    
    emitEvent: (type, payload) => {
      params.onEvent({ type, ...payload });
    },
    
    waitForApproval: createApprovalWaiter(params.nodeId),
  };
}
```

### Injecting Context into Agent

```typescript
// When calling the orchestrator, include relevant context

function buildContextMessage(ctx: ExecutionContext): string {
  const parts: string[] = [];
  
  // Current phase
  parts.push(`Current phase: ${ctx.phase}`);
  
  // Plan if exists
  if (ctx.plan) {
    parts.push(`\nAccepted plan:\n${formatPlan(ctx.plan)}`);
  }
  
  // Todos if in executing phase
  if (ctx.todos.length > 0) {
    parts.push(`\nTodos:\n${ctx.todos.map(t => 
      `- [${t.status}] ${t.label}`
    ).join('\n')}`);
  }
  
  // Current files if iterating
  if (ctx.files.size > 0) {
    parts.push(`\nGenerated files:\n${Array.from(ctx.files.keys()).join('\n')}`);
  }
  
  return parts.join('\n');
}
```

---

## 10.8 Streaming from Subagent to UI

### Event Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Orchestrator  │────▶│  generate_code  │────▶│ Code Generator  │
│      Agent      │     │     (tool)      │     │    Subagent     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │  for await (chunk)    │
         │                       │◀──────────────────────│
         │                       │                       │
         │   emitEvent           │                       │
         │   ('code_chunk')      │                       │
         │◀──────────────────────│                       │
         │                       │                       │
         ▼                       │                       │
┌─────────────────┐              │                       │
│    Frontend     │              │                       │
│                 │              │                       │
│ Live code       │              │                       │
│ preview updates │              │                       │
└─────────────────┘              │                       │
                                 │                       │
                                 │  return { files }     │
                                 │◀──────────────────────│
                                 │                       │
```

### Frontend Handling

```typescript
// src/hooks/useAnimationAgent.ts

export function useAnimationAgent(nodeId: string) {
  const [codePreview, setCodePreview] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<string>('');
  
  useEffect(() => {
    const eventSource = new EventSource(`/api/nodes/${nodeId}/events`);
    
    eventSource.addEventListener('code_chunk', (e) => {
      const { content, accumulated } = JSON.parse(e.data);
      
      // Try to extract current file being generated
      const fileMatch = accumulated.match(/"path":\s*"([^"]+)"/);
      if (fileMatch) {
        setCurrentFile(fileMatch[1]);
      }
      
      // Show accumulated code
      setCodePreview(accumulated);
    });
    
    eventSource.addEventListener('file_written', (e) => {
      const { path } = JSON.parse(e.data);
      // Clear preview, file is complete
      setCodePreview('');
      setCurrentFile('');
    });
    
    return () => eventSource.close();
  }, [nodeId]);
  
  return { codePreview, currentFile };
}
```

---

## 10.9 Summary

| Component | Role | Prompt Size | Tools |
|-----------|------|-------------|-------|
| **Orchestrator Agent** | Workflow, decisions, user interaction | ~4k tokens | Yes (incl. subagent-as-tool) |
| **Code Generator Subagent** | Theatre.js code generation | ~12-15k tokens | None (pure generation) |

### Key Design Decisions

1. **Two-agent pattern**: Separates workflow logic from code generation expertise
2. **Subagent-as-tool**: Code generator invoked via `generate_code` tool
3. **Streaming**: Code chunks stream to UI for live feedback
4. **Complete files**: Subagent always returns complete, working files
5. **Orchestrator decides, subagent executes**: Clean separation of what vs how

### Execution Flow

```
1. User prompt → Orchestrator
2. Orchestrator: Analyze → Question needed?
   └── If yes: request_approval(question)
   └── If no: Generate plan
3. Orchestrator: Present plan → request_approval(plan)
4. User approves → Orchestrator: Execute
5. For each todo:
   a. update_todo(active)
   b. set_thinking(...)
   c. generate_code(...) → Streams from Code Generator
   d. sandbox_write_file(...)
   e. update_todo(done)
6. render_preview() → Show to user
7. User feedback → Orchestrator: Iterate
   └── generate_code(modify_existing, ...) → Update specific file
   └── Re-render
8. User approves → render_final()
9. Complete
```

### Benefits Recap

- **Smaller, focused prompts**: Each agent knows only what it needs
- **Live code streaming**: Users see code appearing in real-time
- **Independent improvement**: Can upgrade code generator without touching orchestration
- **Clean iteration**: Orchestrator decides what to change, code generator knows how
- **Model flexibility**: Could use different models for different tasks

---

# Appendix A: Adapter Pattern for Provider Abstraction

## The Core Idea

**Same application code, different adapters.** The app doesn't know if it's running locally or in the cloud — it just calls abstract interfaces.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Your Application                           │
│                                                                 │
│   AnimationNode → Agent → Tools → ???                           │
│                                                                 │
│   The app just calls:                                           │
│   - storage.upload(file)                                        │
│   - db.saveProject(data)                                        │
│   - sandbox.writeFile(path, code)                               │
│                                                                 │
│   It doesn't care WHERE these actually go                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Config Check   │
                    │                 │
                    │  STORAGE=local  │
                    │  DATABASE=sqlite│
                    │  SANDBOX=docker │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     ┌─────────────────┐          ┌─────────────────┐
     │   Self-Hosted   │          │      Cloud      │
     │                 │          │                 │
     │  LocalStorage   │          │  R2Storage      │
     │  SQLiteDB       │          │  TursoDB        │
     │  DockerSandbox  │          │  E2BSandbox     │
     └─────────────────┘          └─────────────────┘
```

## Three Swappable Pieces

### 1. Storage (where files live)

| | Self-Hosted | Cloud |
|--|-------------|-------|
| **Provider** | Local filesystem | Cloudflare R2 |
| **Assets** | `./data/storage/` | `r2://koda-bucket/` |
| **Videos** | `./data/renders/` | `r2://koda-bucket/renders/` |
| **Access** | `http://localhost:3000/storage/` | `https://storage.koda.video/` |

### 2. Database (where metadata lives)

| | Self-Hosted | Cloud |
|--|-------------|-------|
| **Provider** | SQLite file | Turso (LibSQL) |
| **Location** | `./data/koda.db` | `libsql://koda.turso.io` |
| **Schema** | Identical | Identical |

### 3. Sandbox (where animation runs)

| | Self-Hosted | Cloud |
|--|-------------|-------|
| **Provider** | Docker container | E2B Desktop VM |
| **Lifecycle** | You manage | E2B manages |
| **Preview** | Proxy through backend | E2B VNC stream |
| **Timeout** | None (manual cleanup) | 30 min auto-destroy |

## Configuration

One `.env` file controls everything:

```bash
# ═══════════════════════════════════════════
# SELF-HOSTED CONFIG
# ═══════════════════════════════════════════
STORAGE_PROVIDER=local
STORAGE_PATH=./data/storage

DATABASE_PROVIDER=sqlite
DATABASE_PATH=./data/koda.db

SANDBOX_PROVIDER=docker
SANDBOX_IMAGE=koda/animation-sandbox

ANTHROPIC_API_KEY=sk-ant-xxx
```

```bash
# ═══════════════════════════════════════════
# CLOUD CONFIG
# ═══════════════════════════════════════════
STORAGE_PROVIDER=r2
R2_BUCKET=koda-storage
R2_ACCESS_KEY=xxx

DATABASE_PROVIDER=turso
TURSO_URL=libsql://koda.turso.io
TURSO_TOKEN=xxx

SANDBOX_PROVIDER=e2b
E2B_API_KEY=xxx

ANTHROPIC_API_KEY=sk-ant-xxx
```

---

# Appendix B: Summary

| Question | Answer |
|----------|--------|
| Where does code live while working? | **In sandbox** (container or E2B VM) |
| Where does code persist? | **In storage** (local disk or R2) |
| When do we sync? | **Frequently** — after writes, todos, heartbeat, idle |
| What if sandbox dies? | **Restore from storage** into new sandbox |
| What if user returns after days? | **Same** — create sandbox, restore, continue |
| Difference between Docker and E2B? | **None conceptually** — both checkpoint to storage |
| How do we switch between modes? | **Environment variables** |
| Does app code change? | **No, same code** |
| What actually changes? | **Which adapter class is instantiated** |

**The sandbox is temporary. Storage is permanent. Sync often.**