import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    // Check super admin status
    const superAdmin = await isSuperAdmin();

    console.log('[SECURITY] Agent console bot list accessed', {
      userId,
      orgId,
      isSuperAdmin: superAdmin,
      action: 'list_bots_by_org',
      timestamp: new Date().toISOString()
    });

    // Agent console requires super admin access
    if (!superAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      );
    }

    // Require org selection
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Use service client to bypass RLS (super admin explicitly querying specific org)
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('mentor_bot')
      .select('id, name, display_name, description, avatar_url, model_name, max_tokens, enable_memory, model_provider, system_prompt, clerk_org_id, created_at')
      .eq('clerk_org_id', orgId);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bots' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching bots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bots' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    // Check super admin status
    const superAdmin = await isSuperAdmin();

    if (!superAdmin) {
      console.log('[SECURITY] Unauthorized agent creation attempt', {
        userId,
        action: 'create_bot',
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { orgId, display_name, description, model_name, max_tokens, avatar_url, enable_memory } = body;

    // Validate required fields
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!display_name || !description || !model_name || !max_tokens) {
      return NextResponse.json(
        { error: 'display_name, description, model_name, and max_tokens are required' },
        { status: 400 }
      );
    }

    // Validate max_tokens
    if (typeof max_tokens !== 'number' || max_tokens < 100 || max_tokens > 64000) {
      return NextResponse.json(
        { error: 'max_tokens must be a number between 100 and 64000' },
        { status: 400 }
      );
    }

    // Validate model_name is an Anthropic model
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

    console.log('[SECURITY] Super admin creating bot', {
      userId,
      targetOrgId: orgId,
      display_name,
      action: 'create_bot',
      timestamp: new Date().toISOString()
    });

    // Use service client to bypass RLS (super admin creating bot for specific org)
    const supabase = createServiceClient();

    // Generate name from display_name (lowercase, underscores)
    const name = display_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Create the agent
    const { data: agent, error: createError } = await supabase
      .from('mentor_bot')
      .insert({
        name,
        display_name,
        description,
        model_name,
        max_tokens,
        enable_memory: enable_memory ?? true,
        model_provider: 'anthropic',
        system_prompt: 'You are a helpful AI assistant.',
        avatar_url: avatar_url || '',
        clerk_org_id: orgId,
      })
      .select('id, name, display_name, description, avatar_url, model_name, max_tokens, enable_memory, created_at')
      .single();

    if (createError || !agent) {
      console.error('[SECURITY] Failed to create bot', {
        userId,
        targetOrgId: orgId,
        error: createError,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Failed to create agent' },
        { status: 500 }
      );
    }

    console.log('[SECURITY] Successfully created bot', {
      userId,
      targetOrgId: orgId,
      botId: agent.id,
      display_name: agent.display_name,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      agent
    });

  } catch (error) {
    console.error('Error creating bot:', error);
    return NextResponse.json(
      { error: 'Failed to create bot' },
      { status: 500 }
    );
  }
}