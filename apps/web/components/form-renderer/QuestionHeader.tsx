'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useFormTheme } from '@/lib/forms/theme';

interface QuestionHeaderProps {
  stepNumber: number;
  questionText: string;
  subtext?: string;
  required?: boolean;
}

export const QuestionHeader: React.FC<QuestionHeaderProps> = ({
  stepNumber,
  questionText,
  subtext,
  required = false,
}) => {
  const theme = useFormTheme();

  return (
    <div className="w-full">
      <div className="flex flex-row gap-2 md:gap-3 mb-1 md:mb-2 -ml-12 md:-ml-16">
        {/* Hanging Number Block */}
        <div className="flex items-start justify-end w-10 md:w-12 shrink-0 pt-0.5 md:pt-1">
          <span
            className="font-bold text-lg md:text-2xl leading-none"
            style={{ color: theme.primary }}
          >
            {stepNumber}
          </span>
          <ArrowRight
            className="ml-1 mt-[1px] md:mt-[2px] w-3.5 h-3.5 md:w-4 md:h-4"
            strokeWidth={2.5}
            style={{ color: theme.primary }}
          />
        </div>

        <h2
          className="text-lg md:text-2xl font-bold leading-snug"
          style={{ color: theme.textHeading }}
        >
          {questionText}
          {required && (
            <span style={{ color: theme.textLabel }}>
              <sup>*</sup>
            </span>
          )}
        </h2>
      </div>

      {subtext && (
        <p
          className="text-sm md:text-base"
          style={{ color: theme.textSubtle }}
        >
          {subtext}
        </p>
      )}
    </div>
  );
};
