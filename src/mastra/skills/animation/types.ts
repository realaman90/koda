export type AnimationSkillId =
  | 'intent'
  | 'plan'
  | 'media_prepare'
  | 'sandbox'
  | 'codegen'
  | 'verify'
  | 'render'
  | 'recover';

export type AnimationPhase =
  | 'idle'
  | 'question'
  | 'plan'
  | 'executing'
  | 'preview'
  | 'complete'
  | 'error';

export type SkillErrorClass =
  | 'UpstreamTransportError'
  | 'SandboxUnavailableError'
  | 'ValidationError'
  | 'ToolContractError';

export type RequestContextLike = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

export interface AnimationSkillInput {
  nodeId?: string;
  engine?: 'remotion' | 'theatre';
  phase?: AnimationPhase;
  planAccepted?: boolean;
  sandboxId?: string;
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  media?: Array<Record<string, unknown>>;
  motionSpec?: Record<string, unknown>;
  duration?: number;
  fps?: number;
  resolution?: string;
  requestContext?: RequestContextLike;
  action?: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export interface AnimationSkillResult {
  ok: boolean;
  retryable?: boolean;
  fatal?: boolean;
  summary?: string;
  updates?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  nextHints?: string[];
  metrics?: {
    skillId: AnimationSkillId;
    durationMs: number;
    ok: boolean;
    retryable?: boolean;
    fatal?: boolean;
    errorClass?: SkillErrorClass;
  };
  errorClass?: SkillErrorClass;
}

export interface AnimationSkill {
  id: AnimationSkillId;
  run: (input: AnimationSkillInput) => Promise<AnimationSkillResult>;
}
