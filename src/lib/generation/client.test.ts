import test from 'node:test';
import assert from 'node:assert/strict';

import type { ImageGeneratorNodeData, VideoGeneratorNodeData } from '../types';
import {
  buildVideoGenerationRequest,
  getCompatibleImageCompareModels,
  getCompatibleVideoCompareModels,
} from './client';

test('getCompatibleImageCompareModels excludes auto and reference-required models without references', () => {
  const data = {
    prompt: 'A futuristic portrait',
    model: 'flux-pro',
    aspectRatio: '1:1',
  } as ImageGeneratorNodeData;

  const models = getCompatibleImageCompareModels(
    ['auto', 'flux-pro', 'grok-imagine-image-edit', 'physic-edit'],
    data,
    { textContent: 'Studio lighting' }
  );

  assert.deepEqual(models, ['flux-pro']);
});

test('getCompatibleImageCompareModels includes edit models once references are connected', () => {
  const data = {
    prompt: 'Re-style this image',
    model: 'flux-pro',
    aspectRatio: '1:1',
  } as ImageGeneratorNodeData;

  const models = getCompatibleImageCompareModels(
    ['flux-pro', 'grok-imagine-image-edit', 'physic-edit'],
    data,
    { referenceUrl: 'https://cdn.example.com/ref.png' }
  );

  assert.deepEqual(models, ['flux-pro', 'grok-imagine-image-edit', 'physic-edit']);
});

test('getCompatibleVideoCompareModels enforces input and setting compatibility', () => {
  const data = {
    prompt: 'Animate the still image into a cinematic move',
    model: 'veo-3.1-i2v',
    aspectRatio: '16:9',
    duration: 8,
    resolution: '1080p',
    generateAudio: true,
  } as VideoGeneratorNodeData;

  const models = getCompatibleVideoCompareModels(
    ['auto', 'veo-3.1-i2v', 'ltx-2.3-i2v', 'sora-2-remix-v2v'],
    data,
    { firstFrameUrl: 'https://cdn.example.com/frame.png' }
  );

  assert.deepEqual(models, ['veo-3.1-i2v', 'ltx-2.3-i2v']);
});

test('buildVideoGenerationRequest normalizes settings per target compare model', () => {
  const data = {
    prompt: 'Transform this keyframe into a short motion clip',
    model: 'veo-3.1-i2v',
    aspectRatio: '1:1',
    duration: 15,
    resolution: '720p',
    generateAudio: true,
  } as VideoGeneratorNodeData;

  const request = buildVideoGenerationRequest(
    data,
    { referenceUrl: 'https://cdn.example.com/frame.png' },
    'ltx-2.3-fast-i2v'
  );

  assert.equal(request.aspectRatio, '16:9');
  assert.equal(request.duration, 12);
  assert.equal(request.resolution, '1080p');
});
