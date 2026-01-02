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
      console.log('[SECURITY] Unauthorized agent update attempt', {
        userId,
        botId: id,
        action: 'update_bot',
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { display_name, description, model_name, max_tokens, avatar_url, enable_memory } = body;

    // Validate at least one field to update
    if (!display_name && !description && !model_name && !max_tokens && avatar_url === undefined && enable_memory === undefined) {
      return NextResponse.json(
        { error: 'At least one field must be provided for update' },
        { status: 400 }
      );
    }

    // Validate model_name if provided
    if (model_name) {
      const anthropicModels = [
        'claude-3-haiku-20240307',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        'claude-3-5-haiku-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-7-sonnet-20250219',
        'claude-sonnet-4-20250514',
        'claude-sonnet-4-5-20250929',
        'claude-opus-4-20250514',
        'claude-opus-4-1-20250805',
      ];

      if (!anthropicModels.includes(model_name)) {
        return NextResponse.json(
          { error: 'Invalid model_name. Must be an Anthropic model.' },
          { status: 400 }
        );
      }
    }

    // Validate max_tokens if provided
    if (max_tokens !== undefined && (typeof max_tokens !== 'number' || max_tokens < 100 || max_tokens > 64000)) {
      return NextResponse.json(
        { error: 'max_tokens must be a number between 100 and 64000' },
        { status: 400 }
      );
    }

    // Use service client to bypass RLS (super admin updating bot for any org)
    const supabase = createServiceClient();

    // Build update object
    const updateData: Record<string, any> = {};
    if (display_name) {
      updateData.display_name = display_name;
      // Update name from display_name
      updateData.name = display_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
    if (description) updateData.description = description;
    if (model_name) updateData.model_name = model_name;
    if (max_tokens !== undefined) updateData.max_tokens = max_tokens;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (enable_memory !== undefined) updateData.enable_memory = enable_memory;

    console.log('[SECURITY] Super admin updating bot', {
      userId,
      botId: id,
      updates: Object.keys(updateData),
      action: 'update_bot',
      timestamp: new Date().toISOString()
    });

    // Update the agent
    const { data: agent, error: updateError } = await supabase
      .from('mentor_bot')
      .update(updateData)
      .eq('id', id)
      .select('id, name, display_name, description, avatar_url, model_name, max_tokens, enable_memory, created_at')
      .single();

    if (updateError || !agent) {
      console.error('[SECURITY] Failed to update bot', {
        userId,
        botId: id,
        error: updateError,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      );
    }

    console.log('[SECURITY] Successfully updated bot', {
      userId,
      botId: agent.id,
      display_name: agent.display_name,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      agent
    });

  } catch (error) {
    console.error('Error updating bot:', error);
    return NextResponse.json(
      { error: 'Failed to update bot' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    // Check super admin status
    const superAdmin = await isSuperAdmin();

    if (!superAdmin) {
      console.log('[SECURITY] Unauthorized agent deletion attempt', {
        userId,
        botId: id,
        action: 'delete_bot',
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      );
    }

    console.log('[SECURITY] Super admin deleting bot', {
      userId,
      botId: id,
      action: 'delete_bot',
      timestamp: new Date().toISOString()
    });

    // Use service client to bypass RLS (super admin deleting bot from any org)
    const supabase = createServiceClient();

    // Delete the agent
    const { error: deleteError } = await supabase
      .from('mentor_bot')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[SECURITY] Failed to delete bot', {
        userId,
        botId: id,
        error: deleteError,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: 500 }
      );
    }

    console.log('[SECURITY] Successfully deleted bot', {
      userId,
      botId: id,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('Error deleting bot:', error);
    return NextResponse.json(
      { error: 'Failed to delete bot' },
      { status: 500 }
    );
  }
}
