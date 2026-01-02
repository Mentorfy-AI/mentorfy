import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Lazy-load OpenAI client to avoid build-time initialization
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export interface GeneratePurposeRequest {
  coachingType?: string;
  expertise?: string;
  targetAudience?: string;
}

export interface GeneratePurposeResponse {
  purpose: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<GeneratePurposeResponse>> {
  try {
    const body: GeneratePurposeRequest = await request.json();
    
    const coachingType = body.coachingType || 'general';
    const expertise = body.expertise || 'personal development';
    const targetAudience = body.targetAudience || 'individuals seeking growth';

    const prompt = `Generate a mentor purpose statement for a ${coachingType} coach with expertise in ${expertise} who works with ${targetAudience}.

The purpose should:
- Define the mentor's primary role and mission
- Explain their coaching methodology and approach
- Include specific guidance on how they conduct conversations
- Be written in first person ("You are...")
- Be 200-400 words
- Include a "###HOW YOU COACH###" section with bullet points

Format example:
You are a [type]-focused coach dedicated to helping [audience] achieve [goals].

Your PRIMARY purpose is to guide [audience] to achieve their goals by providing actionable advice, personalized strategies, and ongoing support rooted in your expertise and experience.

###HOW YOU COACH###
* Begin every conversation by asking clarifying questions...
* [additional bullet points]

Make it sound natural and authentic, not corporate or generic.`;

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that creates authentic, professional coaching purpose statements.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 800,
    });

    const purpose = completion.choices[0]?.message?.content || '';
    
    if (!purpose) {
      return NextResponse.json(
        { purpose: '', error: 'Failed to generate purpose statement' },
        { status: 500 }
      );
    }

    return NextResponse.json({ purpose });

  } catch (error) {
    console.error('Generate purpose API error:', error);
    
    return NextResponse.json(
      { 
        purpose: '', 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse<GeneratePurposeResponse>> {
  // Provide a simple default purpose for quick testing
  const defaultPurpose = `You are a growth-focused coach and strategist dedicated to helping content creators scale their impact, audience, and revenue.

Your PRIMARY purpose is to guide creators to achieve their goals by providing actionable advice, personalized strategies, and ongoing support rooted in your expertise and experience.

###HOW YOU COACH###
* Begin every conversation by asking clarifying questions to understand the creator's current situation
* Provide specific, actionable steps rather than generic advice
* Share real-world examples and case studies from your experience
* Challenge creators to think bigger while keeping goals realistic
* Focus on systems and processes that scale, not just one-time tactics
* Encourage consistent action-taking over perfectionism`;

  return NextResponse.json({ purpose: defaultPurpose });
}