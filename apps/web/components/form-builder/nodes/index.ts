/**
 * Node Registry
 *
 * Maps question types to their React Flow node components
 */

import { NodeTypes } from '@xyflow/react';
import { ShortTextNode } from './short-text-node';
import { LongTextNode } from './long-text-node';
import { MultipleChoiceNode } from './multiple-choice-node';

export const nodeTypes: NodeTypes = {
  short_text: ShortTextNode,
  long_text: LongTextNode,
  multiple_choice: MultipleChoiceNode,
};

export { ShortTextNode } from './short-text-node';
export { LongTextNode } from './long-text-node';
export { MultipleChoiceNode } from './multiple-choice-node';
