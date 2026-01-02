/**
 * Base Question Node Component
 *
 * Wraps all question types with consistent styling and handles
 */

import { ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QuestionNodeBaseProps {
  id: string;
  type: string;
  text: string;
  required: boolean;
  selected?: boolean;
  children?: ReactNode;
  icon?: ReactNode;
  typeLabel: string;
}

export function QuestionNodeBase({
  id,
  type,
  text,
  required,
  selected,
  children,
  icon,
  typeLabel,
}: QuestionNodeBaseProps) {
  return (
    <div className={cn('group', selected && 'ring-2 ring-primary ring-offset-2')}>
      <Card className="w-80 shadow-lg hover:shadow-xl transition-shadow cursor-pointer pointer-events-none">
        <CardHeader className="pb-3 pointer-events-auto">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {icon && <div className="text-muted-foreground shrink-0">{icon}</div>}
                <Badge variant="secondary" className="text-xs">
                  {typeLabel}
                </Badge>
                {required && (
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium leading-tight line-clamp-2">
                {text || 'Untitled question'}
              </p>
            </div>
          </div>
        </CardHeader>
        {children && <CardContent className="pt-0 pb-3 pointer-events-auto">{children}</CardContent>}
      </Card>

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary"
      />
    </div>
  );
}
