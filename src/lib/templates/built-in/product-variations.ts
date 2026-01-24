import type { Template } from '../types';
import type { AppNode, MediaNodeData, ImageGeneratorNodeData, TextNodeData } from '@/lib/types';

const productImageNode: AppNode = {
  id: 'template_product_1',
  type: 'media',
  position: { x: 100, y: 150 },
  data: {
    url: undefined,
    type: 'image',
  } as MediaNodeData,
};

const promptNode: AppNode = {
  id: 'template_text_1',
  type: 'text',
  position: { x: 100, y: 320 },
  data: {
    content: 'Product photography, clean white background, professional lighting, high-end commercial style',
  } as TextNodeData,
};

const generator1: AppNode = {
  id: 'template_gen_1',
  type: 'imageGenerator',
  position: { x: 450, y: 100 },
  data: {
    prompt: '',
    model: 'flux-pro',
    aspectRatio: '1:1',
    isGenerating: false,
    name: 'Variation 1',
  } as ImageGeneratorNodeData,
};

const generator2: AppNode = {
  id: 'template_gen_2',
  type: 'imageGenerator',
  position: { x: 450, y: 380 },
  data: {
    prompt: '',
    model: 'flux-pro',
    aspectRatio: '1:1',
    isGenerating: false,
    name: 'Variation 2',
  } as ImageGeneratorNodeData,
};

export const productVariationsTemplate: Template = {
  id: 'product-variations',
  name: 'Create product variations in context',
  description: 'Generate multiple product image variations',
  thumbnail: '/templates/product-variations.jpg',
  category: 'workflow',
  nodes: [productImageNode, promptNode, generator1, generator2],
  edges: [
    {
      id: 'template_edge_1',
      source: 'template_product_1',
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
    {
      id: 'template_edge_3',
      source: 'template_product_1',
      target: 'template_gen_2',
      sourceHandle: 'image',
      targetHandle: 'reference',
    },
    {
      id: 'template_edge_4',
      source: 'template_text_1',
      target: 'template_gen_2',
      sourceHandle: 'text',
      targetHandle: 'text',
    },
  ],
};
