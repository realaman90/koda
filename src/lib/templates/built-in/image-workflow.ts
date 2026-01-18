import type { Template } from '../types';
import type { AppNode, TextNodeData, ImageGeneratorNodeData } from '@/lib/types';

const textNode: AppNode = {
  id: 'template_text_1',
  type: 'text',
  position: { x: 100, y: 200 },
  data: {
    content: 'A majestic mountain landscape at sunset with dramatic clouds',
  } as TextNodeData,
};

const imageGeneratorNode: AppNode = {
  id: 'template_img_1',
  type: 'imageGenerator',
  position: { x: 450, y: 150 },
  data: {
    prompt: '',
    model: 'flux-schnell',
    aspectRatio: '16:9',
    isGenerating: false,
    name: 'Image Generator',
  } as ImageGeneratorNodeData,
};

export const imageWorkflowTemplate: Template = {
  id: 'image-workflow',
  name: 'Image Generation',
  description: 'Text prompt connected to image generator',
  thumbnail: '/templates/image-workflow.jpg',
  category: 'workflow',
  nodes: [textNode, imageGeneratorNode],
  edges: [
    {
      id: 'template_edge_1',
      source: 'template_text_1',
      target: 'template_img_1',
      sourceHandle: 'text',
      targetHandle: 'text',
    },
  ],
};
