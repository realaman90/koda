import type { NodeTypes } from '@xyflow/react';
import { ImageGeneratorNode } from './ImageGeneratorNode';
import { VideoGeneratorNode } from './VideoGeneratorNode';
import { TextNode } from './TextNode';
import { MediaNode } from './MediaNode';

export const nodeTypes: NodeTypes = {
  imageGenerator: ImageGeneratorNode,
  videoGenerator: VideoGeneratorNode,
  text: TextNode,
  media: MediaNode,
};

export { ImageGeneratorNode, VideoGeneratorNode, TextNode, MediaNode };
