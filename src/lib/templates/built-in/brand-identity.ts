import type { Template } from '../types';
import type { AppNode, TextNodeData, ImageGeneratorNodeData, StickyNoteNodeData } from '@/lib/types';

const briefNote: AppNode = {
  id: 'template_brief',
  type: 'stickyNote',
  position: { x: 100, y: 80 },
  data: {
    content: '🎯 Brand Brief\n\nDefine your brand identity:\n- Target audience\n- Brand personality\n- Color preferences',
    color: 'purple',
    size: 'lg',
  } as StickyNoteNodeData,
};

const logoPrompt: AppNode = {
  id: 'template_text_1',
  type: 'text',
  position: { x: 100, y: 280 },
  data: {
    content: 'Modern minimalist logo design, clean typography, professional brand identity',
  } as TextNodeData,
};

const logoGenerator: AppNode = {
  id: 'template_gen_1',
  type: 'imageGenerator',
  position: { x: 450, y: 100 },
  data: {
    prompt: '',
    model: 'ideogram-v3',
    aspectRatio: '1:1',
    isGenerating: false,
    name: 'Logo Concept',
  } as ImageGeneratorNodeData,
};

const brandingGenerator: AppNode = {
  id: 'template_gen_2',
  type: 'imageGenerator',
  position: { x: 450, y: 380 },
  data: {
    prompt: '',
    model: 'ideogram-v3',
    aspectRatio: '16:9',
    isGenerating: false,
    name: 'Brand Application',
  } as ImageGeneratorNodeData,
};

export const brandIdentityTemplate: Template = {
  id: 'brand-identity',
  name: 'Create brand identity',
  description: 'Design logos and brand assets',
  thumbnail: '/templates/brand-identity.jpg',
  category: 'creative',
  nodes: [briefNote, logoPrompt, logoGenerator, brandingGenerator],
  edges: [
    {
      id: 'template_edge_1',
      source: 'template_text_1',
      target: 'template_gen_1',
      sourceHandle: 'text',
      targetHandle: 'text',
    },
    {
      id: 'template_edge_2',
      source: 'template_text_1',
      target: 'template_gen_2',
      sourceHandle: 'text',
      targetHandle: 'text',
    },
  ],
};
