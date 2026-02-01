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