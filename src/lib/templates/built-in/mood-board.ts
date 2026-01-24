import type { Template } from '../types';
import type { AppNode, MediaNodeData, StickyNoteNodeData, GroupNodeData } from '@/lib/types';

const groupNode: AppNode = {
  id: 'template_group_1',
  type: 'group',
  position: { x: 50, y: 50 },
  zIndex: -1,
  data: {
    name: 'Mood Board',
    color: '#6366f1',
    width: 700,
    height: 500,
  } as GroupNodeData,
};

const titleNote: AppNode = {
  id: 'template_note_title',
  type: 'stickyNote',
  position: { x: 80, y: 80 },
  data: {
    content: '🎨 Project Mood Board\n\nCollect references, colors, and inspiration here.',
    color: 'yellow',
    size: 'lg',
  } as StickyNoteNodeData,
};

const createMediaNode = (id: string, x: number, y: number): AppNode => ({
  id,
  type: 'media',
  position: { x, y },
  data: {
    url: undefined,
    type: 'image',
  } as MediaNodeData,
});

const createNoteNode = (id: string, x: number, y: number, content: string, color: 'yellow' | 'pink' | 'blue' | 'green'): AppNode => ({
  id,
  type: 'stickyNote',
  position: { x, y },
  data: {
    content,
    color,
    size: 'sm',
  } as StickyNoteNodeData,
});

export const moodBoardTemplate: Template = {
  id: 'mood-board',
  name: 'Mood Board',
  description: 'Collect references and inspiration',
  thumbnail: '/templates/mood-board.jpg',
  category: 'creative',
  nodes: [
    groupNode,
    titleNote,
    createMediaNode('template_media_1', 80, 250),
    createMediaNode('template_media_2', 260, 250),
    createMediaNode('template_media_3', 440, 250),
    createNoteNode('template_note_1', 80, 420, 'Color palette ideas', 'pink'),
    createNoteNode('template_note_2', 260, 420, 'Typography notes', 'blue'),
    createNoteNode('template_note_3', 440, 420, 'Style references', 'green'),
  ],
  edges: [],
};
