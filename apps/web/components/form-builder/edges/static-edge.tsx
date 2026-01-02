/**
 * Static Edge - Solid line for predefined transitions
 */

import { memo } from 'react';
import { EdgeProps, BaseEdge, getStraightPath } from '@xyflow/react';

function StaticEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: '#3b82f6',
        strokeWidth: 3,
      }}
    />
  );
}

export const StaticEdge = memo(StaticEdgeComponent);
