'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import ForceGraph2D from 'react-force-graph-2d';
import * as THREE from 'three';

interface GraphNode {
  id: string;
  label: string;
  type: 'entity' | 'episode';
  x?: number;
  y?: number;
  z?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface KnowledgeGraphProps {
  data: GraphData;
  view?: '2d' | '3d';
}

// Color palette for edge types - visually distinct colors
const EDGE_COLORS: Record<string, string> = {
  'RELATES_TO': '#60a5fa', // blue
  'MENTIONS': '#34d399', // green
  'CONTAINS': '#fbbf24', // yellow
  'CONNECTED_TO': '#f87171', // red
  'REFERENCES': '#a78bfa', // purple
  'PART_OF': '#fb923c', // orange
  'DEPENDS_ON': '#ec4899', // pink
  'SIMILAR_TO': '#14b8a6', // teal
  'HAS_PROPERTY': '#8b5cf6', // violet
  'INVOLVES': '#06b6d4', // cyan
};

const DEFAULT_EDGE_COLOR = 'rgba(255,255,255,0.3)'; // fallback for unknown types

export function KnowledgeGraph({ data, view = '3d' }: KnowledgeGraphProps) {
  const graphRef = useRef<any>();
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  // Extract unique edge types from the data and assign colors
  const edgeTypeColors = useMemo(() => {
    const types = new Set(data.edges.map(edge => edge.type));
    const colorMap: Record<string, string> = {};

    types.forEach(type => {
      colorMap[type] = EDGE_COLORS[type] || DEFAULT_EDGE_COLOR;
    });

    return colorMap;
  }, [data.edges]);

  // Auto-rotation effect (stops when user interacts) - 3D only
  useEffect(() => {
    if (!graphRef.current || view === '2d') return;

    let angle = 0;
    let animationId: number;
    let currentDistance = 300; // Default distance

    const rotate = () => {
      if (graphRef.current && !isUserInteracting) {
        // Get current camera position to preserve zoom distance
        const camera = graphRef.current.camera?.();
        if (camera && camera.position) {
          currentDistance = Math.sqrt(
            camera.position.x ** 2 +
            camera.position.y ** 2 +
            camera.position.z ** 2
          );
        }

        angle += 0.001; // Slow rotation speed
        graphRef.current.cameraPosition({
          x: currentDistance * Math.sin(angle),
          z: currentDistance * Math.cos(angle),
        });
      }
      animationId = requestAnimationFrame(rotate);
    };

    // Start rotation after physics settle
    const timeout = setTimeout(() => {
      rotate();
    }, 1000);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(animationId);
    };
  }, [isUserInteracting, view]);

  // Custom controls setup - iOS-style simple drag - 3D only
  useEffect(() => {
    if (!graphRef.current || view === '2d') return;

    const controls = graphRef.current.controls();
    if (!controls) return;

    // Disable right-click panning, only allow rotation
    controls.enablePan = false;

    // Lock vertical rotation - horizontal only (turntable style)
    controls.minPolarAngle = Math.PI / 2; // 90 degrees
    controls.maxPolarAngle = Math.PI / 2; // 90 degrees (locked)

    // Enable scroll zoom with reasonable limits
    controls.enableZoom = true;
    controls.minDistance = 150;  // Can zoom in close
    controls.maxDistance = 600;  // Can zoom out far
    controls.zoomSpeed = 0.5;    // Smooth zoom speed

    // Make rotation smooth and damped (iOS-like momentum)
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;

    // Detect user interaction
    const handleStart = () => setIsUserInteracting(true);
    const handleEnd = () => {
      // Small delay before resuming auto-rotation
      setTimeout(() => setIsUserInteracting(false), 2000);
    };

    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
    };
  }, [view]);

  // 3D node rendering with spheres
  const nodeThreeObject = useCallback((node: any) => {
    const color = node.type === 'entity' ? '#60a5fa' : '#34d399';
    const geometry = new THREE.SphereGeometry(5, 16, 16);
    const material = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });
    return new THREE.Mesh(geometry, material);
  }, []);

  // Color function for edges based on type
  const getLinkColor = useCallback((link: any) => {
    return edgeTypeColors[link.type] || DEFAULT_EDGE_COLOR;
  }, [edgeTypeColors]);

  return (
    <div className="relative w-full h-full">
      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-2">
        <p className="text-xs text-white/60">
          {view === '2d'
            ? 'Click and drag nodes • Scroll to zoom • Pan to explore'
            : 'Click and drag to rotate • Scroll to zoom'}
        </p>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg p-4 max-w-xs">
        <h3 className="text-sm font-semibold text-white mb-3">Edge Types</h3>
        <div className="space-y-2">
          {Object.entries(edgeTypeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-8 h-0.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-white/80">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph - 2D or 3D */}
      {view === '2d' ? (
        <ForceGraph2D
          ref={graphRef}
          graphData={{
            nodes: data.nodes,
            links: data.edges
          }}
          nodeLabel="label"
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.label;
            const fontSize = 12 / globalScale;
            const color = node.type === 'entity' ? '#60a5fa' : '#34d399';

            // Draw node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            // Draw label
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, node.x, node.y + 8);
          }}
          linkLabel="type"
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link: any, ctx, globalScale) => {
            const fontSize = 10 / globalScale;
            const label = link.type;

            // Calculate midpoint of the link
            const start = link.source;
            const end = link.target;
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;

            // Draw edge type label with background
            ctx.font = `${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            const padding = 2 / globalScale;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(
              midX - textWidth / 2 - padding,
              midY - fontSize / 2 - padding,
              textWidth + padding * 2,
              fontSize + padding * 2
            );

            // Text
            ctx.fillStyle = edgeTypeColors[link.type] || DEFAULT_EDGE_COLOR;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, midX, midY);
          }}
          linkColor={getLinkColor}
          linkWidth={1.5}
          linkDirectionalArrowLength={0}
          backgroundColor="#000000"
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />
      ) : (
        <ForceGraph3D
          ref={graphRef}
          graphData={{
            nodes: data.nodes,
            links: data.edges
          }}
          nodeLabel="label"
          nodeThreeObject={nodeThreeObject}
          linkColor={getLinkColor}
          linkWidth={1.5}
          linkDirectionalArrowLength={3}
          backgroundColor="#000000"
          enableNodeDrag={false}
          enableNavigationControls={true}
        />
      )}
    </div>
  );
}
