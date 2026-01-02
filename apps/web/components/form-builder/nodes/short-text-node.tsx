/**
 * Short Text Question Node
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { QuestionNodeBase } from './question-node-base';
import { ShortTextQuestion } from '@/lib/forms/types';
import { Type } from 'lucide-react';

function ShortTextNodeComponent({ data, selected }: NodeProps) {
  const question = data as unknown as ShortTextQuestion;

  return (
    <QuestionNodeBase
      id={question.id}
      type={question.type}
      text={question.text}
      required={question.required}
      selected={selected}
      icon={<Type className="w-4 h-4" />}
      typeLabel="Short Text"
    >
      {question.placeholder && (
        <p className="text-xs text-muted-foreground italic">
          Placeholder: {question.placeholder}
        </p>
      )}
      {question.maxLength && (
        <p className="text-xs text-muted-foreground">
          Max length: {question.maxLength} characters
        </p>
      )}
    </QuestionNodeBase>
  );
}

export const ShortTextNode = memo(ShortTextNodeComponent);
