import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Upload a file to Anthropic Files API
 * Returns a file_id that can be used in message content blocks
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert File to Buffer for Anthropic SDK
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload file to Anthropic
    const uploadedFile = await client.beta.files.upload({
      file: new File([buffer], file.name, { type: file.type }),
      betas: ['files-api-2025-04-14'],
    });

    console.log('[FILES] Uploaded file to Anthropic:', uploadedFile);

    return NextResponse.json({
      success: true,
      file_id: uploadedFile.id,
      filename: file.name,
      file_type: file.type,
    });
  } catch (error) {
    console.error('[FILES] Error uploading file:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file',
      },
      { status: 500 }
    );
  }
}
