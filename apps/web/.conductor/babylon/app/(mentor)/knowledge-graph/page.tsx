'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

// Disable SSR for 3D graph component (uses window/WebGL)
const KnowledgeGraph = dynamic(
  () => import('@/components/knowledge-graph').then(mod => mod.KnowledgeGraph),
  { ssr: false }
);

interface GraphNode {
  id: string;
  label: string;
  type: 'entity' | 'episode';
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

export default function KnowledgeGraphPage() {
  const router = useRouter();
  const [data, setData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'2d' | '3d'>('3d');

  useEffect(() => {
    fetch('/api/knowledge-graph')
      .then(res => res.json())
      .then(graphData => {
        setData(graphData);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error fetching knowledge graph:', err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p>Loading your knowledge graph...</p>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center space-y-4">
          <p>No knowledge graph data yet.</p>
          <p className="text-sm text-white/60">Upload documents to build your brain.</p>
          <Button onClick={() => router.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full">
      {/* Header with view toggle */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-4 p-4">
          <Button
            onClick={() => router.back()}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-white">Your Brain</h1>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1 border border-white/10">
            <button
              onClick={() => setView('3d')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                view === '3d'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              3D
            </button>
            <button
              onClick={() => setView('2d')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                view === '2d'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              2D
            </button>
          </div>

          <div className="ml-auto text-sm text-white/60">
            {data.nodes.length} node sample
          </div>
        </div>
      </div>

      {/* Graph */}
      <div className="w-full h-full pt-16">
        <KnowledgeGraph data={data} view={view} />
      </div>
    </div>
  );
}
