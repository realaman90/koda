import type { Template } from '../types';
import type { AppNode, MediaNodeData, TextNodeData, ImageGeneratorNodeData } from '@/lib/types';

const originalImage: AppNode = {
  id: 'template_original',
  type: 'media',
  position: { x: 100, y: 100 },
  data: {
    url: undefined,
    type: 'image',
  } as MediaNodeData,
};

const newModel: AppNode = {
  id: 'template_model',
  type: 'media',
  position: { x: 100, y: 280 },
  data: {
    url: undefined,
    type: 'image',
  } as MediaNodeData,
};

const stylePrompt: AppNode = {
  id: 'template_text_1',
  type: 'text',
  position: { x: 100, y: 450 },
  data: {
    content: 'Fashion campaign, editorial photography, professional model, high-end advertising',
  } as TextNodeData,
};

const swapGenerator: AppNode = {
  id: 'template_gen_1',
  type: 'imageGenerator',
  position: { x: 480, y: 200 },
  data: {
    prompt: '',
    model: 'nanobanana-pro',
    aspectRatio: '4:3',
    isGenerating: false,
    name: 'Model Swap Result',
  } as ImageGeneratorNodeData,
};

export const modelSwapTemplate: Template = {
  id: 'model-swap',
  name: 'Swap model in campaign',
  description: 'Replace models in advertising photos',
  thumbnail: '/templates/model-swap.jpg',
  category: 'workflow',
  nodes: [originalImage, newModel, stylePrompt, swapGenerator],
  edges: [
    {
      id: 'template_edge_1',
      source: 'template_original',
      target: 'template_gen_1',
      sourceHandle: 'image',
      targetHandle: 'reference',
    },
    {
      id: 'template_edge_2',
      source: 'template_text_1',
      target: 'template_gen_1',
      sourceHandle: 'text',
      targetHandle: 'text',
    },
  ],
};
