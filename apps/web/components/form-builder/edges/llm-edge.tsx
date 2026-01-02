/**
 * LLM Edge - Dashed line for dynamic AI-powered transitions
 */

import { memo } from 'react';
import { EdgeProps, BaseEdge, getStraightPath, EdgeLabelRenderer } from '@xyflow/react';
import { Sparkles } from 'lucide-react';

function LLMEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: '#9ca3af',
          strokeWidth: 2,
          strokeDasharray: '5,5',
          opacity: 0.7,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="bg-background border border-muted rounded-md px-2 py-1 text-xs flex items-center gap-1 shadow-sm"
        >
          <Sparkles className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground font-medium">AI</span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const LLMEdge = memo(LLMEdgeComponent);
