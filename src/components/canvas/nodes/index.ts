import type { NodeTypes } from '@xyflow/react';
import { ImageGeneratorNode } from './ImageGeneratorNode';
import { VideoGeneratorNode } from './VideoGeneratorNode';
import { TextNode } from './TextNode';
import { MediaNode } from './MediaNode';
import { StickyNoteNode } from './StickyNoteNode';
import { StickerNode } from './StickerNode';
import { GroupNode } from './GroupNode';
import { StoryboardNode } from './StoryboardNode';
import { ProductShotNode } from './ProductShotNode';
import { MusicGeneratorNode } from './MusicGeneratorNode';
import { SpeechNode } from './SpeechNode';
import { VideoAudioNode } from './VideoAudioNode';

export const nodeTypes: NodeTypes = {
  imageGenerator: ImageGeneratorNode,
  videoGenerator: VideoGeneratorNode,
  text: TextNode,
  media: MediaNode,
  stickyNote: StickyNoteNode,
  sticker: StickerNode,
  group: GroupNode,
  storyboard: StoryboardNode,
  productShot: ProductShotNode,
  musicGenerator: MusicGeneratorNode,
  speech: SpeechNode,
  videoAudio: VideoAudioNode,
};

export { ImageGeneratorNode, VideoGeneratorNode, TextNode, MediaNode, StickyNoteNode, StickerNode, GroupNode, StoryboardNode, ProductShotNode, MusicGeneratorNode, SpeechNode, VideoAudioNode };
export { ExpandButton } from './ExpandButton';
export { ResizeHandle } from './ResizeHandle';
