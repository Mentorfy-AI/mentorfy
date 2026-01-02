/**
 * Edge Registry
 *
 * Maps edge types to their React Flow edge components
 */

import { EdgeTypes } from '@xyflow/react';
import { StaticEdge } from './static-edge';
import { LLMEdge } from './llm-edge';

export const edgeTypes: EdgeTypes = {
  static: StaticEdge,
  llm: LLMEdge,
};

export { StaticEdge } from './static-edge';
export { LLMEdge } from './llm-edge';
