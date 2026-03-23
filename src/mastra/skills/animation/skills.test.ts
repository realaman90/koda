import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CODEGEN_ATTEMPT_TIMEOUT_MS,
  CODEGEN_MAX_GENERATE_ATTEMPTS,
  resetAnimationSkillRegistryForTests,
  runAnimationSkill,
  withUpstreamRetry,
} from './index';
import type { RequestContextLike } from './types';

function createRequestContext(initial: Record<string, unknown> = {}): RequestContextLike {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => {
      store.set(key, value);
    },
  };
}

test('codegen preflight blocks invalid phase transitions', async () => {
  resetAnimationSkillRegistryForTests();
  const ctx = createRequestContext({ phase: 'plan' });

  const result = await runAnimationSkill('codegen', {
    action: 'preflight',
    phase: 'plan',
    requestContext: ctx,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorClass, 'ValidationError');
  assert.match(result.summary || '', /not allowed in phase/i);
});

test('codegen transport budget stops after two failures', async () => {
  resetAnimationSkillRegistryForTests();
  const ctx = createRequestContext({ phase: 'executing' });

  const first = await runAnimationSkill('codegen', {
    action: 'transport_error',
    requestContext: ctx,
    payload: { errorMessage: 'Cannot connect to API: other side closed' },
  });
  assert.equal(first.ok, false);
  assert.equal(first.retryable, true);

  const second = await runAnimationSkill('codegen', {
    action: 'transport_error',
    requestContext: ctx,
    payload: { errorMessage: 'Cannot connect to API: other side closed' },
  });
  assert.equal(second.ok, false);
  assert.equal(second.fatal, true);

  const preflight = await runAnimationSkill('codegen', {
    action: 'preflight',
    phase: 'executing',
    requestContext: ctx,
  });

  assert.equal(preflight.ok, false);
  assert.match(preflight.summary || '', /upstream llm connectivity is unstable/i);
});

test('media_prepare deduplicates by file path', async () => {
  resetAnimationSkillRegistryForTests();

  const result = await runAnimationSkill('media_prepare', {
    action: 'build_media_files',
    payload: {
      mediaFiles: [
        { path: 'public/media/a.png', type: 'image', description: 'first' },
        { path: 'public/media/a.png', type: 'image', description: 'override' },
        { path: 'public/media/b.mp4', type: 'video', description: 'video' },
      ],
    },
  });

  assert.equal(result.ok, true);
  const files = (result.artifacts?.mediaFiles || []) as Array<{ path: string; description?: string }>;
  assert.equal(files.length, 2);
  assert.deepEqual(files.map((f) => f.path).sort(), ['public/media/a.png', 'public/media/b.mp4']);
});

test('sandbox create_or_reuse is blocked when stream is already closed', async () => {
  resetAnimationSkillRegistryForTests();
  const ctx = createRequestContext({
    phase: 'executing',
    planAccepted: true,
    streamClosed: true,
  });

  const result = await runAnimationSkill('sandbox', {
    action: 'create_or_reuse',
    phase: 'executing',
    planAccepted: true,
    engine: 'remotion',
    requestContext: ctx,
    payload: { projectId: 'test-project' },
  });

  assert.equal(result.ok, false);
  assert.match(result.summary || '', /stream closed/i);
});

test('render prepare waits for code generation and proceeds once cleared', async () => {
  resetAnimationSkillRegistryForTests();
  const ctx = createRequestContext({
    phase: 'executing',
    planAccepted: true,
    sandboxId: 'koda-sandbox-test',
    codeGenActive: 1,
  });

  setTimeout(() => {
    ctx.set('codeGenActive', 0);
  }, 50);

  const result = await runAnimationSkill('render', {
    action: 'prepare_render',
    phase: 'executing',
    planAccepted: true,
    sandboxId: 'koda-sandbox-test',
    requestContext: ctx,
  });

  assert.equal(result.ok, true);
  assert.equal(ctx.get('codeGenActive'), 0);
});

test('withUpstreamRetry performs only one retry for transport failures', async () => {
  resetAnimationSkillRegistryForTests();
  const ctx = createRequestContext({ streamClosed: false });
  let attempts = 0;

  await assert.rejects(async () => {
    await withUpstreamRetry(
      ctx,
      async () => {
        attempts += 1;
        throw new Error('Cannot connect to API: other side closed');
      },
      undefined,
      {
        maxAttempts: CODEGEN_MAX_GENERATE_ATTEMPTS,
        attemptTimeoutMs: Math.min(5_000, CODEGEN_ATTEMPT_TIMEOUT_MS),
        backoffBaseMs: 1,
      },
    );
  });

  assert.equal(attempts, CODEGEN_MAX_GENERATE_ATTEMPTS);
});
