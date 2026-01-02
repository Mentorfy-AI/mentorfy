import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    // Check super admin status
    const superAdmin = await isSuperAdmin();

    if (!superAdmin) {
      console.log('[SECURITY] Unauthorized system prompt update attempt', {
        userId,
        botId: id,
        action: 'update_system_prompt',
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { system_prompt } = body;

    // Validate system_prompt is provided
    if (system_prompt === undefined) {
      return NextResponse.json(
        { error: 'system_prompt is required' },
        { status: 400 }
      );
    }

    console.log('[SECURITY] Super admin updating system prompt', {
      userId,
      botId: id,
      action: 'update_system_prompt',
      timestamp: new Date().toISOString()
    });

    // Use service client to bypass RLS (super admin updating bot for any org)
    const supabase = createServiceClient();

    // Update the system prompt
    const { data: bot, error: updateError } = await supabase
      .from('mentor_bot')
      .update({ system_prompt })
      .eq('id', id)
      .select('id, display_name, system_prompt')
      .single();

    if (updateError || !bot) {
      console.error('[SECURITY] Failed to update system prompt', {
        userId,
        botId: id,
        error: updateError,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Failed to update system prompt' },
        { status: 500 }
      );
    }

    console.log('[SECURITY] Successfully updated system prompt', {
      userId,
      botId: bot.id,
      display_name: bot.display_name,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      bot
    });

  } catch (error) {
    console.error('Error updating system prompt:', error);
    return NextResponse.json(
      { error: 'Failed to update system prompt' },
      { status: 500 }
    );
  }
}
