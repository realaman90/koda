/**
 * xskill.ai API client for Seedance 2.0 video generation.
 *
 * Async task-based API:
 *   POST /api/v3/tasks/create  → { task_id }
 *   POST /api/v3/tasks/query   → { status, result }
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

interface XSkillTaskQueryResponse {
  code: number;
  data?: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    output?: {
      images?: string[]; // video URLs despite the field name
      error?: string; // error message when failed
      error_type?: string; // e.g. "submit_timeout"
    };
    progress?: {
      stage?: string;
      message?: string;
    };
    error?: string; // legacy field
  };
  message?: string; // API call status (e.g. "查询成功"), NOT task error
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
  const status = queryBody.data?.status || 'pending';

  console.log('xskill query response:', { taskId, status, code: queryBody.code, message: queryBody.message, data: JSON.stringify(queryBody.data) });

  if (status === 'completed') {
    const videoUrl = queryBody.data?.output?.images?.[0];
    if (!videoUrl) {
      throw new Error('xskill task completed but no video URL in response');
    }
    return { status, videoUrl };
  }

  if (status === 'failed') {
    const taskError = queryBody.data?.output?.error || queryBody.data?.error || 'Video generation failed';
    return { status, error: taskError };
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
    const status = queryBody.data?.status;

    options?.onStatusUpdate?.(status || 'unknown');
    console.log('xskill task status:', { taskId, status });

    if (status === 'completed') {
      const videoUrl = queryBody.data?.output?.images?.[0];
      if (!videoUrl) {
        throw new Error('xskill task completed but no video URL in response');
      }
      return videoUrl;
    }

    if (status === 'failed') {
      const taskError = queryBody.data?.output?.error || queryBody.data?.error || 'unknown error';
      throw new Error(`xskill task failed: ${taskError}`);
    }

    // pending or processing — keep polling
  }

  throw new Error(`xskill task timed out after ${timeout / 1000}s (task_id: ${taskId})`);
}
