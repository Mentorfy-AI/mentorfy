/**
 * Multiple Choice Question Node
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { QuestionNodeBase } from './question-node-base';
import { MultipleChoiceQuestion } from '@/lib/forms/types';
import { ListChecks } from 'lucide-react';

function MultipleChoiceNodeComponent({ data, selected }: NodeProps) {
  const question = data as unknown as MultipleChoiceQuestion;

  const isMultiSelect = (question.maxSelections ?? 1) > 1;

  return (
    <QuestionNodeBase
      id={question.id}
      type={question.type}
      text={question.text}
      required={question.required}
      selected={selected}
      icon={<ListChecks className="w-4 h-4" />}
      typeLabel={isMultiSelect ? 'Multi-Select' : 'Single Choice'}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {question.options.slice(0, 3).map((option, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-muted text-xs rounded truncate max-w-[100px]"
            >
              {option}
            </span>
          ))}
          {question.options.length > 3 && (
            <span className="px-2 py-0.5 bg-muted text-xs rounded">
              +{question.options.length - 3} more
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {question.options.length} option{question.options.length !== 1 ? 's' : ''}
          {isMultiSelect && (
            <>
              {' • '}
              Select {question.minSelections || 1}-{question.maxSelections}
            </>
          )}
        </p>
      </div>
    </QuestionNodeBase>
  );
}

export const MultipleChoiceNode = memo(MultipleChoiceNodeComponent);
