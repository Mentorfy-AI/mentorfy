import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

// Rate limiting: Track conversation creation per user
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // 10 conversations per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // Reset or initialize
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

const startConversationSchema = z.object({
  botId: z.string().uuid('Invalid bot ID format'),
  firstMessage: z
    .string()
    .min(1, 'First message cannot be empty')
    .max(10000, 'Message too long'),
  title: z.string().optional(),
  fileId: z.string().optional(), // Anthropic file ID if file was uploaded
});

export interface StartConversationResponse {
  success: boolean;
  conversation?: any;
  message?: any;
  fileId?: string; // Include file ID in response for auto-stream (documents only)
  fileType?: string; // Include MIME type for proper content block formatting
  fileBase64?: string; // Include base64 data for images
  error?: string;
}

/**
 * POST /api/conversations/start
 * Atomically create a new conversation with the first user message
 * This prevents 0-message conversations from being created
 * Supports file attachments via FormData
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<StartConversationResponse>> {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Maximum 10 conversations per hour.',
        },
        { status: 429 }
      );
    }

    // Parse FormData (supports file uploads) or JSON
    const contentType = request.headers.get('content-type');
    let botId: string;
    let firstMessage: string;
    let title: string | undefined;
    let uploadedFile: File | null = null;
    let fileId: string | undefined;
    let fileType: string | undefined;
    let fileBase64: string | undefined;

    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      botId = formData.get('botId') as string;
      firstMessage = formData.get('firstMessage') as string;
      title = formData.get('title') as string | undefined;
      uploadedFile = formData.get('file') as File | null;
    } else {
      const body = await request.json();
      botId = body.botId;
      firstMessage = body.firstMessage;
      title = body.title;
    }

    // Validate input
    const validationResult = startConversationSchema.safeParse({ botId, firstMessage, title });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    // Handle file attachment
    if (uploadedFile) {
      fileType = uploadedFile.type;

      // For images: convert to base64 (Files API doesn't support images)
      // For documents: upload to Anthropic Files API
      if (uploadedFile.type.startsWith('image/')) {
        console.log('[START-CONVERSATION] Converting image to base64:', uploadedFile.name);
        const buffer = Buffer.from(await uploadedFile.arrayBuffer());
        fileBase64 = buffer.toString('base64');
        console.log('[START-CONVERSATION] Image converted to base64');
      } else {
        console.log('[START-CONVERSATION] Uploading document to Anthropic:', uploadedFile.name);
        try {
          const anthropicClient = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY || '',
          });

          // Convert File to Buffer for Anthropic SDK
          const buffer = Buffer.from(await uploadedFile.arrayBuffer());

          // Upload file to Anthropic
          const anthropicFile = await anthropicClient.beta.files.upload({
            file: new File([buffer], uploadedFile.name, { type: uploadedFile.type }),
            betas: ['files-api-2025-04-14'],
          });

          fileId = anthropicFile.id;
          console.log('[START-CONVERSATION] Document uploaded successfully, file_id:', fileId);
        } catch (uploadError) {
          console.error('[START-CONVERSATION] File upload failed:', uploadError);
          throw new Error('Failed to upload file to Anthropic');
        }
      }
    }

    const supabase = await createClerkSupabaseClient();

    // Verify bot belongs to organization
    const { data: bot, error: botError } = await supabase
      .from('mentor_bot')
      .select('id, name')
      .eq('id', botId)
      .eq('clerk_org_id', orgId)
      .single();

    if (botError || !bot) {
      return NextResponse.json(
        { success: false, error: 'Bot not found or access denied' },
        { status: 404 }
      );
    }

    // Generate title from first message if not provided
    const conversationTitle =
      title ||
      firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');

    const now = new Date().toISOString();

    // Step 1: Create conversation
    const { data: conversation, error: conversationError } = await supabase
      .from('conversation')
      .insert({
        clerk_user_id: userId,
        clerk_org_id: orgId,
        mentor_bot_id: botId,
        title: conversationTitle,
        last_message_at: now,
        platform: 'web',
      })
      .select()
      .single();

    if (conversationError || !conversation) {
      console.error('Error creating conversation:', conversationError);
      return NextResponse.json(
        { success: false, error: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    // Step 2: Create first message
    const { data: message, error: messageError } = await supabase
      .from('message')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: firstMessage,
      })
      .select()
      .single();

    if (messageError || !message) {
      console.error('Error creating first message:', messageError);

      // Rollback: Delete the conversation since message creation failed
      await supabase.from('conversation').delete().eq('id', conversation.id);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create conversation. Please try again.',
        },
        { status: 500 }
      );
    }

    // Success! Return conversation, message, and file info (if present)
    return NextResponse.json({
      success: true,
      conversation,
      message,
      fileId, // Pass fileId to conversation page for auto-stream (documents only)
      fileType, // Pass MIME type for proper content block formatting
      fileBase64, // Pass base64 data for images
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
