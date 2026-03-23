import type { Template } from '../types';
import type { AppNode, TextNodeData, MediaNodeData, VideoGeneratorNodeData } from '@/lib/types';

const promptNode: AppNode = {
  id: 'template_text_1',
  type: 'text',
  position: { x: 100, y: 250 },
  data: {
    content: 'A person walking through a neon-lit city at night',
  } as TextNodeData,
};

const referenceImageNode: AppNode = {
  id: 'template_media_1',
  type: 'media',
  position: { x: 100, y: 100 },
  data: {
    url: undefined,
    type: 'image',
  } as MediaNodeData,
};

const videoGeneratorNode: AppNode = {
  id: 'template_video_1',
  type: 'videoGenerator',
  position: { x: 450, y: 150 },
  data: {
    prompt: '',
    model: 'veo-3',
    aspectRatio: '16:9',
    duration: 8,
    resolution: '720p',
    generateAudio: true,
    isGenerating: false,
    name: 'Video Generator',
  } as VideoGeneratorNodeData,
};

export const videoProductionTemplate: Template = {
  id: 'video-production',
  name: 'Video Production',
  description: 'Text + reference image to video generator',
  thumbnail: '/templates/video-production.jpg',
  category: 'workflow',
  nodes: [promptNode, referenceImageNode, videoGeneratorNode],
  edges: [
    {
      id: 'template_edge_1',
      source: 'template_text_1',
      target: 'template_video_1',
      sourceHandle: 'text',
      targetHandle: 'text',
    },
    {
      id: 'template_edge_2',
      source: 'template_media_1',
      target: 'template_video_1',
      sourceHandle: 'image',
      targetHandle: 'firstFrame',
    },
  ],
};
