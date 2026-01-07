import type { EdgeTypes } from '@xyflow/react';
import { DeletableEdge } from './DeletableEdge';

export const edgeTypes: EdgeTypes = {
  default: DeletableEdge,
  deletable: DeletableEdge,
};

export { DeletableEdge };
