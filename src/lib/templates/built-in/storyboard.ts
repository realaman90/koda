import type { Template } from '../types';
import type { AppNode, ImageGeneratorNodeData, StickyNoteNodeData } from '@/lib/types';

// Create a 2x2 grid of image generators for storyboarding
const createSceneNode = (index: number, x: number, y: number): AppNode => ({
  id: `template_scene_${index}`,
  type: 'imageGenerator',
  position: { x, y },
  data: {
    prompt: '',
    model: 'flux-schnell',
    aspectRatio: '16:9',
    isGenerating: false,
    name: `Scene ${index}`,
  } as ImageGeneratorNodeData,
});

const headerNote: AppNode = {
  id: 'template_header',
  type: 'stickyNote',
  position: { x: 100, y: 50 },
  data: {
    content: '🎬 Storyboard\n\nAdd prompts to each scene and generate your visual narrative.',
    color: 'purple',
    size: 'lg',
  } as StickyNoteNodeData,
};

export const storyboardTemplate: Template = {
  id: 'storyboard',
  name: 'Storyboard Layout',
  description: '4-scene storyboard grid for visual narratives',
  thumbnail: '/templates/storyboard.jpg',
  category: 'creative',
  nodes: [
    headerNote,
    createSceneNode(1, 100, 200),
    createSceneNode(2, 420, 200),
    createSceneNode(3, 100, 480),
    createSceneNode(4, 420, 480),
  ],
  edges: [],
};
