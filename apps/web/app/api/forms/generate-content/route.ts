import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServiceClient } from '@/lib/supabase-server';
import { Form, InformationalQuestion } from '@/lib/forms/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory rate limiter (resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // Prevent memory leak by clearing map if it gets too large
  if (rateLimitMap.size > 10000) {
    rateLimitMap.clear();
  }

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * POST /api/forms/generate-content
 * Generates LLM content for informational screens in forms
 *
 * Security measures:
 * 1. Rate limiting: 5 requests per minute per IP
 * 2. Validates generationPrompt is from form config (prevents prompt injection)
 * 3. Context length limit: 50,000 chars (prevents abuse)
 * 4. Prompt length limit: 5,000 chars (system design constraint)
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 5 requests per minute.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { formId, generationPrompt, context } = body;

    // Require formId for security validation
    if (!formId) {
      return NextResponse.json(
        { error: 'formId is required' },
        { status: 400 }
      );
    }

    if (!generationPrompt) {
      return NextResponse.json(
        { error: 'generationPrompt is required' },
        { status: 400 }
      );
    }

    // Security: Validate prompt length (prevents abuse)
    if (generationPrompt.length > 5000) {
      return NextResponse.json(
        { error: 'Generation prompt too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Security: Validate context length (prevents abuse)
    if (context && context.length > 50000) {
      return NextResponse.json(
        { error: 'Context too long (max 50000 characters)' },
        { status: 400 }
      );
    }

    // Security: Validate that generationPrompt is from the form config
    // This prevents prompt injection attacks
    const supabase = createServiceClient();
    const { data: formData, error: formError } = await supabase
      .from('forms')
      .select('spec')
      .eq('id', formId)
      .single();

    if (formError || !formData) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      );
    }

    const form = formData.spec as Form;

    // Find the informational question that matches this generationPrompt
    // Normalize whitespace for comparison (trim both sides)
    const normalizedPrompt = generationPrompt.trim();
    let validatedQuestion: InformationalQuestion | null = null;

    for (const question of form.questions) {
      if (
        question.type === 'informational' &&
        question.contentSource === 'llm' &&
        question.content?.trim() === normalizedPrompt
      ) {
        validatedQuestion = question;
        break;
      }
    }

    if (!validatedQuestion) {
      // Debug: Log all LLM questions' content for comparison
      const llmQuestions = form.questions
        .filter((q: any) => q.type === 'informational' && q.contentSource === 'llm')
        .map((q: any) => ({
          id: q.id,
          contentPreview: q.content?.substring(0, 80),
          contentLength: q.content?.length,
          trimmedLength: q.content?.trim()?.length,
        }));

      console.error('[SECURITY] Invalid generation prompt not found in form:', {
        formId,
        promptPreview: normalizedPrompt.substring(0, 80),
        promptLength: normalizedPrompt.length,
        originalPromptLength: generationPrompt.length,
        llmQuestionsInForm: llmQuestions,
        // Check if any content is undefined
        hasUndefinedContent: llmQuestions.some((q: any) => q.contentLength === undefined),
      });
      return NextResponse.json(
        { error: 'Invalid generation prompt' },
        { status: 403 }
      );
    }

    // Call OpenAI with validated parameters from form config
    // SECURITY: Use model/temperature from form config, NOT from client request
    const completion = await openai.chat.completions.create({
      model: validatedQuestion.llmConfig?.model || 'gpt-4o-mini',
      temperature: validatedQuestion.llmConfig?.temperature ?? 0.7,
      messages: [
        {
          role: 'system',
          content: validatedQuestion.content,
        },
        {
          role: 'user',
          content: context || 'No previous answers provided.',
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}
