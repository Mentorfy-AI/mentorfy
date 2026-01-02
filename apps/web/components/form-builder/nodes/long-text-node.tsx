/**
 * Long Text Question Node
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { QuestionNodeBase } from './question-node-base';
import { LongTextQuestion } from '@/lib/forms/types';
import { AlignLeft } from 'lucide-react';

function LongTextNodeComponent({ data, selected }: NodeProps) {
  const question = data as unknown as LongTextQuestion;

  return (
    <QuestionNodeBase
      id={question.id}
      type={question.type}
      text={question.text}
      required={question.required}
      selected={selected}
      icon={<AlignLeft className="w-4 h-4" />}
      typeLabel="Long Text"
    >
      <div className="space-y-1">
        {question.placeholder && (
          <p className="text-xs text-muted-foreground italic">
            Placeholder: {question.placeholder}
          </p>
        )}
        {(question.minLength || question.maxLength) && (
          <p className="text-xs text-muted-foreground">
            {question.minLength && `Min: ${question.minLength}`}
            {question.minLength && question.maxLength && ' • '}
            {question.maxLength && `Max: ${question.maxLength}`}
            {' characters'}
          </p>
        )}
      </div>
    </QuestionNodeBase>
  );
}

export const LongTextNode = memo(LongTextNodeComponent);
