/**
 * xskill.ai API client for Seedance 2.0 video generation.
 *
 * Async task-based API:
 *   POST /api/v3/tasks/create  → { task_id }
 *   POST /api/v3/tasks/query   → { status, result }
 *
 * Response format varies: video URL may be at:
 *   - data.result.output.images[0]  (documented format)
 *   - data.output.video_url         (observed format)
 * Status may be "completed"/"success" or "failed"/"error".
 */

import { Agent } from '@mastra/core/agent';

const XSKILL_BASE_URL = 'https://api.xskill.ai';
const ERROR_TRANSLATOR_MODEL = 'google/gemini-3-flash-preview';

interface XSkillTaskCreateResponse {
  code: number;
  data?: {
    task_id: string;
    price?: number;
  };
  message?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XSkillData = Record<string, any>;

interface XSkillTaskQueryResponse {
  code: number;
  data?: XSkillData;
  message?: string;
}

function hasCJK(text: string): boolean {
  return /[\u3400-\u9FFF]/.test(text);
}

function extractXskillCode(raw: string): string | undefined {
  const m = raw.match(/错误码[:：]\s*(\d+)/);
  return m?.[1];
}

function mapKnownXskillError(raw: string): string | undefined {
  const code = extractXskillCode(raw);

  if (code === '4011') {
    return 'Video generation was blocked because a face was detected in the uploaded media (code 4011).';
  }

  if (code === '1000' || /invalid parameter/i.test(raw)) {
    return 'The request was rejected due to invalid input parameters (code 1000).';
  }

  return undefined;
}

async function translateXskillErrorToEnglish(raw: string): Promise<string | undefined> {
  if (!raw.trim()) return undefined;

  try {
    const agent = new Agent({
      id: `xskill-error-translator-${Date.now()}`,
      name: 'xskill-error-translator',
      instructions:
        'You translate API error messages into concise, accurate English. Keep codes and policy reasons.',
      model: ERROR_TRANSLATOR_MODEL,
    });

    const translationTask = agent.generate([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              `Translate this error into plain English for a UI toast.\n` +
              `Rules:\n` +
              `- One sentence.\n` +
              `- Keep status/error codes.\n` +
              `- Do not add advice.\n` +
              `- Output English only.\n\n` +
              `Error:\n${raw}`,
          },
        ],
      },
    ], {
      modelSettings: {
        temperature: 0,
      },
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
            includeThoughts: false,
          },
        },
      },
    });

    // Keep failure path responsive.
    const result = await Promise.race([
      translationTask,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Gemini translation timed out')), 5000);
      }),
    ]);

    const text = result.text?.trim();
    if (!text) return undefined;
    return text.replace(/^["'\s]+|["'\s]+$/g, '');
  } catch (err) {
    console.warn('[xskill] Gemini error translation failed, falling back:', err);
    return undefined;
  }
}

async function humanizeXskillError(raw: string): Promise<string> {
  const known = mapKnownXskillError(raw);

  // For Chinese provider errors, prefer model translation, fallback to known/static mapping.
  if (hasCJK(raw)) {
    const translated = await translateXskillErrorToEnglish(raw);
    if (translated) return translated;
    if (known) return known;
    return raw;
  }

  return known || raw;
}

/**
 * Extract video URL from xskill query response data.
 * Handles both documented and observed response formats.
 */
function extractVideoUrl(data: XSkillData | undefined): string | undefined {
  if (!data) return undefined;
  // Observed format: data.output.video_url
  if (data.output?.video_url) return data.output.video_url;
  // Documented format: data.result.output.images[0]
  if (data.result?.output?.images?.[0]) return data.result.output.images[0];
  // Fallback: data.output.images[0]
  if (data.output?.images?.[0]) return data.output.images[0];
  return undefined;
}

/**
 * Extract error message from xskill query response data.
 */
async function extractError(data: XSkillData | undefined): Promise<string> {
  if (!data) return 'Video generation failed';
  const raw = data.output?.error || data.error || 'Video generation failed';
  if (typeof raw !== 'string') return 'Video generation failed';
  return humanizeXskillError(raw);
}

/**
 * Normalize xskill status to our expected values.
 * API may return "success" or "error" as alternatives.
 */
function normalizeStatus(status: string | undefined): 'pending' | 'processing' | 'completed' | 'failed' {
  if (!status) return 'pending';
  if (status === 'completed' || status === 'success') return 'completed';
  if (status === 'failed' || status === 'error') return 'failed';
  if (status === 'processing' || status === 'generating') return 'processing';
  return 'pending';
}

export interface XSkillGenerateParams {
  /** Outer model identifier, e.g. "st-ai/super-seed2" */
  model: string;
  /** Inner params block sent to the API */
  params: Record<string, unknown>;
}

/**
 * Create an xskill task without polling. Returns the taskId for client-side polling.
 */
export async function xskillCreateTask(
  request: XSkillGenerateParams
): Promise<{ taskId: string; price?: number }> {
  const apiKey = process.env.XSKILL_API_KEY;
  if (!apiKey) {
    throw new Error('XSKILL_API_KEY environment variable is not set');
  }

  const createRes = await fetch(`${XSKILL_BASE_URL}/api/v3/tasks/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      params: request.params,
      channel: null,
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`xskill task create failed (${createRes.status}): ${text}`);
  }

  const createBody: XSkillTaskCreateResponse = await createRes.json();
  if (createBody.code !== 200 || !createBody.data?.task_id) {
    throw new Error(
      `xskill task create error: ${createBody.message || JSON.stringify(createBody)}`
    );
  }

  console.log('xskill task created:', { taskId: createBody.data.task_id, price: createBody.data.price });
  return { taskId: createBody.data.task_id, price: createBody.data.price };
}

/**
 * Query the status of an xskill task. Returns status and videoUrl if completed.
 */
export async function xskillQueryTask(
  taskId: string
): Promise<{ status: 'pending' | 'processing' | 'completed' | 'failed'; videoUrl?: string; error?: string }> {
  const apiKey = process.env.XSKILL_API_KEY;
  if (!apiKey) {
    throw new Error('XSKILL_API_KEY environment variable is not set');
  }

  const queryRes = await fetch(`${XSKILL_BASE_URL}/api/v3/tasks/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ task_id: taskId }),
  });

  if (!queryRes.ok) {
    throw new Error(`xskill query failed (${queryRes.status})`);
  }

  const queryBody: XSkillTaskQueryResponse = await queryRes.json();
  const status = normalizeStatus(queryBody.data?.status);

  console.log('xskill query response:', { taskId, status, code: queryBody.code, data: JSON.stringify(queryBody.data) });

  if (status === 'completed') {
    const videoUrl = extractVideoUrl(queryBody.data);
    if (!videoUrl) {
      throw new Error('xskill task completed but no video URL in response');
    }
    return { status, videoUrl };
  }

  if (status === 'failed') {
    return { status, error: await extractError(queryBody.data) };
  }

  return { status };
}

/**
 * Generate a video via xskill.ai.
 * Creates a task, polls until completion, returns the video URL.
 */
export async function xskillGenerate(
  request: XSkillGenerateParams,
  options?: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    onStatusUpdate?: (status: string) => void;
  }
): Promise<string> {
  const apiKey = process.env.XSKILL_API_KEY;
  if (!apiKey) {
    throw new Error('XSKILL_API_KEY environment variable is not set');
  }

  const pollInterval = options?.pollIntervalMs ?? 5000;
  const timeout = options?.timeoutMs ?? 600_000; // 10 minutes

  // 1. Create task
  const createRes = await fetch(`${XSKILL_BASE_URL}/api/v3/tasks/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      params: request.params,
      channel: null,
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`xskill task create failed (${createRes.status}): ${text}`);
  }

  const createBody: XSkillTaskCreateResponse = await createRes.json();
  if (createBody.code !== 200 || !createBody.data?.task_id) {
    throw new Error(
      `xskill task create error: ${createBody.message || JSON.stringify(createBody)}`
    );
  }

  const taskId = createBody.data.task_id;
  console.log('xskill task created:', { taskId, price: createBody.data.price });

  // 2. Poll for result
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const queryRes = await fetch(`${XSKILL_BASE_URL}/api/v3/tasks/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ task_id: taskId }),
    });

    if (!queryRes.ok) {
      console.warn(`xskill query failed (${queryRes.status}), retrying...`);
      continue;
    }

    const queryBody: XSkillTaskQueryResponse = await queryRes.json();
    const status = normalizeStatus(queryBody.data?.status);

    options?.onStatusUpdate?.(status);
    console.log('xskill task status:', { taskId, status });

    if (status === 'completed') {
      const videoUrl = extractVideoUrl(queryBody.data);
      if (!videoUrl) {
        throw new Error('xskill task completed but no video URL in response');
      }
      return videoUrl;
    }

    if (status === 'failed') {
      throw new Error(`xskill task failed: ${await extractError(queryBody.data)}`);
    }

    // pending or processing — keep polling
  }

  throw new Error(`xskill task timed out after ${timeout / 1000}s (task_id: ${taskId})`);
}
