'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Form } from '@/lib/forms/types';
import { formToFlowData, flowDataToForm } from '@/lib/forms/canvas-converter';
import { nodeTypes } from '@/components/form-builder/nodes';
import { edgeTypes } from '@/components/form-builder/edges';
import { QuestionEditDialog } from '@/components/form-builder/question-edit-dialog';
import { Question } from '@/lib/forms/types';

/**
 * Canvas Form Builder
 * Visual drag-and-drop editor for forms using React Flow
 */
export default function CanvasFormBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as string;

  const [form, setForm] = useState<Form | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Load form data
  useEffect(() => {
    async function loadForm() {
      try {
        const res = await fetch(`/api/forms/${formId}`);
        const data = await res.json();
        const loadedForm = data.form as Form;
        setForm(loadedForm);

        // Convert form to React Flow format
        const flowData = formToFlowData(loadedForm);
        console.log('Canvas loaded:', {
          nodes: flowData.nodes.length,
          edges: flowData.edges.length,
          edgeDetails: flowData.edges,
        });
        setNodes(flowData.nodes);
        setEdges(flowData.edges);
      } catch (error) {
        console.error('Failed to load form:', error);
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [formId]);

  // Handle node position changes
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Handle edge changes
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // Handle new connections
  const onConnect: OnConnect = useCallback((connection) => {
    // Add type 'static' by default when user draws a connection
    const newEdge = { ...connection, type: 'static' };
    setEdges((eds) => addEdge(newEdge, eds));
  }, []);

  // Handle node click - open edit dialog
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const question = node.data as unknown as Question;
    setEditingQuestion(question);
    setDialogOpen(true);
  }, []);

  // Update question from edit dialog
  function handleQuestionUpdate(
    questionId: string,
    updates: Partial<Question>
  ) {
    if (!form) return;

    const updatedQuestions = form.questions.map((q) =>
      q.id === questionId ? ({ ...q, ...updates } as Question) : q
    );

    const updatedForm = { ...form, questions: updatedQuestions };
    setForm(updatedForm);

    // Update nodes
    const flowData = formToFlowData(updatedForm);
    setNodes(flowData.nodes);
    setEdges(flowData.edges);
  }

  // Delete question
  function handleQuestionDelete(questionId: string) {
    if (!form) return;

    const updatedQuestions = form.questions.filter((q) => q.id !== questionId);
    const updatedForm = { ...form, questions: updatedQuestions };
    setForm(updatedForm);

    // Update nodes and edges
    const flowData = formToFlowData(updatedForm);
    setNodes(flowData.nodes);
    setEdges(flowData.edges);
  }

  // Save form changes
  async function saveForm() {
    if (!form) return;

    setSaving(true);
    try {
      // Convert canvas state back to form data
      const updatedForm = flowDataToForm(form, nodes, edges);

      await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedForm),
      });

      setForm(updatedForm);
      alert('Form saved!');
    } catch (error) {
      console.error('Failed to save form:', error);
      alert('Failed to save form');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p>Loading form...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Form not found</p>
          <Link href="/form-builder">
            <Button variant="outline">Back to Forms</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <div className="border-b bg-background p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link href={`/form-builder/${formId}`}>
              <Button
                variant="ghost"
                size="icon"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">{form.name}</h1>
              <p className="text-sm text-muted-foreground">
                Canvas View • {form.questions.length} question
                {form.questions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/form-builder/${formId}`}>
              <Button variant="outline">List View</Button>
            </Link>
            <Link
              href={`/f/${formId}`}
              target="_blank"
            >
              <Button variant="outline">Preview</Button>
            </Link>
            <Button
              onClick={saveForm}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{
              markerEnd: { type: 'arrowclosed' },
            }}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background className="bg-muted" />
            <Controls className="bg-background text-black border border-border" />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="bg-background border border-border"
              nodeColor="hsl(var(--primary))"
              maskColor="hsl(var(--muted) / 0.8)"
            />
          </ReactFlow>
        </div>

        {/* Edit Question Dialog */}
        <QuestionEditDialog
          question={editingQuestion}
          form={form}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={handleQuestionUpdate}
          onDelete={handleQuestionDelete}
        />
      </div>
    </ReactFlowProvider>
  );
}
