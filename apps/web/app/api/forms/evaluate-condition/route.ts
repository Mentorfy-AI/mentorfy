import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServiceClient } from '@/lib/supabase-server';
import { Form } from '@/lib/forms/types';

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
 * POST /api/forms/evaluate-condition
 * Evaluates a condition using an LLM
 *
 * Security measures:
 * 1. Rate limiting: 5 requests per minute per IP
 * 2. Validates evaluationPrompt is from form config (prevents prompt injection)
 * 3. Context length limit: 50,000 chars (prevents abuse)
 * 4. Prompt length limit: 5,000 chars (system design constraint)
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    // In production, x-forwarded-for can be comma-separated list: "client, proxy1, proxy2"
    // Take the first IP (client's real IP)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 5 requests per minute.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { formId, evaluationPrompt, context, model, temperature } = body;

    // Require formId for security validation
    if (!formId) {
      return NextResponse.json(
        { error: 'formId is required' },
        { status: 400 }
      );
    }

    if (!evaluationPrompt) {
      return NextResponse.json(
        { error: 'evaluationPrompt is required' },
        { status: 400 }
      );
    }

    // Security: Validate prompt length (prevents abuse)
    if (evaluationPrompt.length > 5000) {
      return NextResponse.json(
        { error: 'Evaluation prompt too long (max 5000 characters)' },
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

    // Security: Validate that evaluationPrompt is from the form config
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

    // Find the LLM condition that matches this evaluationPrompt
    // This validates the prompt AND extracts the correct model/temperature from config
    let validatedCondition: any = null;

    for (const question of form.questions) {
      if (question.transitionStrategy.type !== 'conditional') continue;

      for (const route of question.transitionStrategy.routes) {
        if (route.condition.type === 'llm' && route.condition.evaluationPrompt === evaluationPrompt) {
          validatedCondition = route.condition;
          break;
        }
        // Check nested conditions (and, or, not)
        const findCondition = (cond: any): any => {
          if (cond.type === 'llm' && cond.evaluationPrompt === evaluationPrompt) {
            return cond;
          }
          if (cond.type === 'and' || cond.type === 'or') {
            for (const c of cond.conditions) {
              const found = findCondition(c);
              if (found) return found;
            }
          }
          if (cond.type === 'not') {
            return findCondition(cond.condition);
          }
          return null;
        };
        validatedCondition = findCondition(route.condition);
        if (validatedCondition) break;
      }
      if (validatedCondition) break;
    }

    if (!validatedCondition) {
      console.error('[SECURITY] Invalid evaluation prompt not found in form:', {
        formId,
        promptPreview: evaluationPrompt.substring(0, 100),
      });
      return NextResponse.json(
        { error: 'Invalid evaluation prompt' },
        { status: 403 }
      );
    }

    // Call OpenAI with validated parameters from form config
    // SECURITY: Use model/temperature from form config, NOT from client request
    const completion = await openai.chat.completions.create({
      model: validatedCondition.model || 'gpt-4o-mini',
      temperature: validatedCondition.temperature ?? 0.3,
      messages: [
        {
          role: 'system',
          content: validatedCondition.evaluationPrompt,
        },
        {
          role: 'user',
          content: context || 'No context provided',
        },
      ],
    });

    const result = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error evaluating condition:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate condition' },
      { status: 500 }
    );
  }
}
