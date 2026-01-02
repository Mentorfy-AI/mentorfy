import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Transcribe audio using Groq's Whisper API
 * Supports common audio formats: webm, mp3, wav, m4a
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate GROQ_API_KEY
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error('[TRANSCRIBE] GROQ_API_KEY not configured');
      return NextResponse.json(
        { success: false, error: 'Transcription service not configured' },
        { status: 500 }
      );
    }

    // Create FormData for Groq API
    const groqFormData = new FormData();
    groqFormData.append('file', file);
    groqFormData.append('model', 'whisper-large-v3');
    groqFormData.append('response_format', 'json');

    console.log('[TRANSCRIBE] Sending audio to Groq:', {
      filename: file.name,
      size: file.size,
      type: file.type,
    });

    // Call Groq Whisper API
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: groqFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TRANSCRIBE] Groq API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const result = await response.json();
    const transcription = result.text || '';

    console.log('[TRANSCRIBE] Transcription successful:', {
      length: transcription.length,
      preview: transcription.substring(0, 100),
    });

    return NextResponse.json({
      success: true,
      transcription,
    });
  } catch (error) {
    console.error('[TRANSCRIBE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to transcribe audio',
      },
      { status: 500 }
    );
  }
}
