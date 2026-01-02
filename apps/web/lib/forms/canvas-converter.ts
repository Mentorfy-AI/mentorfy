/**
 * Canvas Converter Utilities
 *
 * Converts between Form data model and React Flow canvas format.
 * Handles auto-layout for questions without positions.
 */

import type { Node, Edge } from '@xyflow/react';
import type { Form, Question, CanvasPosition } from './types';

// ============================================================================
// Constants
// ============================================================================

const VERTICAL_SPACING = 250; // Spacing between nodes vertically (increased for custom cards)
const HORIZONTAL_SPACING = 400; // Spacing between nodes horizontally
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

// ============================================================================
// Auto-Layout Algorithm
// ============================================================================

/**
 * Generate default positions for questions using simple vertical layout
 * Questions are stacked vertically with even spacing
 */
export function generateDefaultPositions(questions: Question[]): Question[] {
  return questions.map((question, index) => ({
    ...question,
    position: {
      x: 250, // Centered horizontally
      y: index * VERTICAL_SPACING,
    },
  }));
}

/**
 * Check if a question has a valid position
 */
function hasValidPosition(question: Question): boolean {
  return (
    question.position !== undefined &&
    typeof question.position.x === 'number' &&
    typeof question.position.y === 'number' &&
    !isNaN(question.position.x) &&
    !isNaN(question.position.y)
  );
}

/**
 * Ensure all questions have valid positions
 * Generates positions for any questions missing them
 */
export function ensurePositions(questions: Question[]): Question[] {
  const needsPositions = questions.some(q => !hasValidPosition(q));

  if (!needsPositions) {
    return questions;
  }

  // If any question is missing a position, regenerate all positions
  // This ensures consistent layout
  return generateDefaultPositions(questions);
}

// ============================================================================
// Form → React Flow Conversion
// ============================================================================

/**
 * Convert a Question to a React Flow Node
 */
function questionToNode(question: Question): Node {
  return {
    id: question.id,
    type: question.type, // 'short_text', 'long_text', 'multiple_choice'
    position: question.position,
    data: question as unknown as Record<string, unknown>, // Pass entire question as node data
  };
}

/**
 * Convert a Question's transition strategy to React Flow Edges
 * - Static transitions create one edge to the next question
 * - LLM transitions create dashed edges to all possible questions
 */
function questionToEdges(question: Question, allQuestions: Question[]): Edge[] {
  const strategy = question.transitionStrategy;

  if (strategy.type === 'static') {
    // Static transition - single edge to specific next question
    if (strategy.nextQuestionId === null) {
      // End of form - no edge
      return [];
    }

    return [
      {
        id: `${question.id}->${strategy.nextQuestionId}`,
        source: question.id,
        target: strategy.nextQuestionId,
        type: 'static',
      },
    ];
  } else {
    // LLM transition - edges to all possible questions (except self)
    return allQuestions
      .filter(target => target.id !== question.id)
      .map(target => ({
        id: `${question.id}->${target.id}`,
        source: question.id,
        target: target.id,
        type: 'llm',
        animated: true, // Visual indicator for dynamic transitions
        style: { strokeDasharray: '5,5' }, // Dashed line
      }));
  }
}

/**
 * Convert Form to React Flow nodes and edges
 */
export function formToFlowData(form: Form): {
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
} {
  // Ensure all questions have positions
  const questionsWithPositions = ensurePositions(form.questions);

  // Convert questions to nodes
  const nodes = questionsWithPositions.map(questionToNode);

  // Convert transitions to edges
  const edges = questionsWithPositions.flatMap(question =>
    questionToEdges(question, questionsWithPositions)
  );

  return {
    nodes,
    edges,
    viewport: form.viewport || DEFAULT_VIEWPORT,
  };
}

// ============================================================================
// React Flow → Form Conversion
// ============================================================================

/**
 * Update Form with new positions from React Flow nodes
 * Preserves all question data, only updates positions
 */
export function updateFormPositions(
  form: Form,
  nodes: Node[],
  viewport?: { x: number; y: number; zoom: number }
): Form {
  // Create a map of node positions by ID for fast lookup
  const positionMap = new Map<string, CanvasPosition>(
    nodes.map(node => [node.id, node.position])
  );

  // Update question positions
  const updatedQuestions = form.questions.map(question => {
    const newPosition = positionMap.get(question.id);
    if (newPosition) {
      return {
        ...question,
        position: newPosition,
      };
    }
    return question;
  });

  return {
    ...form,
    questions: updatedQuestions,
    viewport: viewport || form.viewport,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update Form with new connections from React Flow edges
 * Updates transition strategies based on edge changes
 */
export function updateFormConnections(
  form: Form,
  edges: Edge[]
): Form {
  // Group edges by source node
  const edgesBySource = new Map<string, Edge[]>();
  edges.forEach(edge => {
    const sourceEdges = edgesBySource.get(edge.source) || [];
    sourceEdges.push(edge);
    edgesBySource.set(edge.source, sourceEdges);
  });

  // Update question transitions based on edges
  const updatedQuestions = form.questions.map(question => {
    const questionEdges = edgesBySource.get(question.id) || [];

    // No outgoing edges = end of form
    if (questionEdges.length === 0) {
      return {
        ...question,
        transitionStrategy: {
          type: 'static' as const,
          nextQuestionId: null,
        },
      };
    }

    // Single edge = static transition
    if (questionEdges.length === 1) {
      const edge = questionEdges[0];
      return {
        ...question,
        transitionStrategy: {
          type: 'static' as const,
          nextQuestionId: edge.target,
        },
      };
    }

    // Multiple edges = keep existing LLM strategy or create default
    if (question.transitionStrategy.type === 'llm') {
      return question; // Keep existing LLM configuration
    }

    // Default LLM strategy for multiple edges
    return {
      ...question,
      transitionStrategy: {
        type: 'llm' as const,
        systemPrompt: 'Analyze the user\'s answers and decide which question to show next.',
        model: 'gpt-4o-mini',
        temperature: 0.7,
      },
    };
  });

  return {
    ...form,
    questions: updatedQuestions,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Complete conversion from React Flow back to Form
 * Updates both positions and connections
 */
export function flowDataToForm(
  form: Form,
  nodes: Node[],
  edges: Edge[],
  viewport?: { x: number; y: number; zoom: number }
): Form {
  let updated = updateFormPositions(form, nodes, viewport);
  updated = updateFormConnections(updated, edges);
  return updated;
}
