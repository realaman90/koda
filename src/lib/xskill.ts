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

const XSKILL_BASE_URL = 'https://api.xskill.ai';

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
function extractError(data: XSkillData | undefined): string {
  if (!data) return 'Video generation failed';
  return data.output?.error || data.error || 'Video generation failed';
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
    return { status, error: extractError(queryBody.data) };
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
      throw new Error(`xskill task failed: ${extractError(queryBody.data)}`);
    }

    // pending or processing — keep polling
  }

  throw new Error(`xskill task timed out after ${timeout / 1000}s (task_id: ${taskId})`);
}
