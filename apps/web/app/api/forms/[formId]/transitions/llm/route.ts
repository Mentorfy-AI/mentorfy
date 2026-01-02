import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { getForm } from '@/lib/forms/storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// JSON schema for LLM response
const TransitionDecision = z.object({
  nextQuestionId: z
    .string()
    .nullable()
    .describe('The ID of the next question to show, or null to end the form'),
  reasoning: z
    .string()
    .optional()
    .describe('Brief explanation of why this question was chosen'),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  req: NextRequest,
  { params }: { params: { formId: string } }
) {
  try {
    const { currentQuestionId, answers, systemPrompt, model, temperature } =
      await req.json();

    // Validate inputs
    if (!systemPrompt || systemPrompt.trim() === '') {
      return NextResponse.json(
        { error: 'System prompt is required' },
        { status: 400 }
      );
    }

    // Rate limiting: Max 50 answers per request (prevents abuse)
    if (answers && answers.length > 50) {
      return NextResponse.json(
        { error: 'Too many answers provided' },
        { status: 400 }
      );
    }

    // Limit system prompt length to prevent token abuse
    if (systemPrompt.length > 2000) {
      return NextResponse.json(
        { error: 'System prompt too long' },
        { status: 400 }
      );
    }

    // Load form to get available questions
    const form = getForm(params.formId);
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Build context for LLM
    const availableQuestions = form.questions
      .map((q, idx) => `- ${q.id}: Question ${idx + 1}: "${q.text}"`)
      .join('\n');

    const answersContext = answers
      .map((a: any) => `Q: "${a.questionText}"\nA: "${a.value}"`)
      .join('\n\n');

    const userMessage = `
Available questions in this form:
${availableQuestions}

User's answers so far:
${answersContext || '(No answers yet)'}

Decide which question to show next, or return null to end the form.
`;

    // Call OpenAI with structured output
    const completion = await openai.beta.chat.completions.parse({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: zodResponseFormat(TransitionDecision, 'transition'),
      temperature: temperature ?? 0.7,
    });

    const decision = completion.choices[0].message.parsed;

    if (!decision) {
      throw new Error('LLM returned no decision');
    }

    // Validate the returned question ID exists
    if (decision.nextQuestionId !== null) {
      const questionExists = form.questions.some(
        (q) => q.id === decision.nextQuestionId
      );

      if (!questionExists) {
        console.error(
          'LLM returned invalid question ID:',
          decision.nextQuestionId
        );
        // Fallback: find next sequential question
        const currentIdx = form.questions.findIndex(
          (q) => q.id === currentQuestionId
        );
        const nextIdx = currentIdx + 1;
        const fallbackId =
          nextIdx < form.questions.length ? form.questions[nextIdx].id : null;

        return NextResponse.json({
          nextQuestionId: fallbackId,
          fallback: true,
        });
      }
    }

    return NextResponse.json({
      nextQuestionId: decision.nextQuestionId,
      reasoning: decision.reasoning,
    });
  } catch (error) {
    console.error('LLM transition error:', error);

    // Fallback to sequential
    try {
      const { currentQuestionId } = await req.json();
      const form = getForm(params.formId);

      if (form) {
        const currentIdx = form.questions.findIndex(
          (q) => q.id === currentQuestionId
        );
        const nextIdx = currentIdx + 1;
        const fallbackId =
          nextIdx < form.questions.length ? form.questions[nextIdx].id : null;

        return NextResponse.json({
          nextQuestionId: fallbackId,
          fallback: true,
          error: 'LLM failed, using fallback',
        });
      }
    } catch (fallbackError) {
      // Ultimate fallback
      return NextResponse.json({
        nextQuestionId: null,
        fallback: true,
        error: 'Critical error, ending form',
      });
    }

    return NextResponse.json(
      { error: 'Failed to get next question' },
      { status: 500 }
    );
  }
}
