import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export interface AgentDetail {
  id: string
  name: string
  display_name: string
  description: string
  avatar_url: string
  system_prompt: string | null
  created_at: string
  document_count: number
}

export interface AgentDetailResponse {
  success: boolean
  agent?: AgentDetail
  error?: string
}

/**
 * GET /api/agents/[agentId]
 * Get details for a specific agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
): Promise<NextResponse<AgentDetailResponse>> {
  try {
    await requireAuth()

    const supabase = await createClerkSupabaseClient()
    const { agentId } = params

    // Get agent details (RLS filters by org automatically)
    const { data: agent, error: agentError } = await supabase
      .from('mentor_bot')
      .select('id, name, display_name, description, avatar_url, system_prompt, created_at')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      console.error('Error fetching agent:', agentError)
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get document count for this bot
    const { count: documentCount, error: countError } = await supabase
      .from('bot_document')
      .select('*', { count: 'exact', head: true })
      .eq('mentor_bot_id', agentId)

    if (countError) {
      console.error('Error fetching document count:', countError)
    }

    return NextResponse.json({
      success: true,
      agent: {
        ...agent,
        document_count: documentCount || 0
      }
    })

  } catch (error) {
    console.error('Agent detail API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

export interface UpdateAgentBrandingRequest {
  display_name?: string
  description?: string
  avatar_url?: string
  model_name?: string
}

/**
 * PATCH /api/agents/[agentId]
 * Update branding fields for an agent
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { agentId: string } }
): Promise<NextResponse<AgentDetailResponse>> {
  try {
    await requireAuth()

    const supabase = await createClerkSupabaseClient()
    const { agentId } = params
    const body: UpdateAgentBrandingRequest = await request.json()

    // Validate at least one field is provided
    if (!body.display_name && !body.description && !body.avatar_url && !body.model_name) {
      return NextResponse.json(
        { success: false, error: 'At least one field must be provided' },
        { status: 400 }
      )
    }

    // Validate model_name if provided
    if (body.model_name) {
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
      ]

      if (!anthropicModels.includes(body.model_name)) {
        return NextResponse.json(
          { success: false, error: 'Invalid model_name. Must be an Anthropic model.' },
          { status: 400 }
        )
      }
    }

    // Build update object with only provided fields
    const updates: any = {}
    if (body.display_name !== undefined) updates.display_name = body.display_name
    if (body.description !== undefined) updates.description = body.description
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url
    if (body.model_name !== undefined) {
      updates.model_name = body.model_name
      updates.model_provider = 'anthropic'
    }

    // Update the agent (RLS filters by org automatically)
    const { data: agent, error: updateError } = await supabase
      .from('mentor_bot')
      .update(updates)
      .eq('id', agentId)
      .select('id, name, display_name, description, avatar_url, system_prompt, created_at')
      .single()

    if (updateError || !agent) {
      console.error('Error updating agent:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update agent' },
        { status: 404 }
      )
    }

    // Get document count for this bot
    const { count: documentCount, error: countError } = await supabase
      .from('bot_document')
      .select('*', { count: 'exact', head: true })
      .eq('mentor_bot_id', agentId)

    if (countError) {
      console.error('Error fetching document count:', countError)
    }

    return NextResponse.json({
      success: true,
      agent: {
        ...agent,
        document_count: documentCount || 0
      }
    })

  } catch (error) {
    console.error('Agent update API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

export interface DeleteAgentResponse {
  success: boolean
  error?: string
}

/**
 * DELETE /api/agents/[agentId]
 * Hard delete an agent (CASCADE will handle related data)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string } }
): Promise<NextResponse<DeleteAgentResponse>> {
  try {
    await requireAuth()

    const supabase = await createClerkSupabaseClient()
    const { agentId } = params

    console.log('[/api/agents DELETE] Deleting agent:', agentId)

    // Delete the agent (CASCADE constraints handle related data)
    const { error: deleteError } = await supabase
      .from('mentor_bot')
      .delete()
      .eq('id', agentId)

    if (deleteError) {
      console.error('[/api/agents DELETE] Error deleting agent:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete agent' },
        { status: 500 }
      )
    }

    console.log('[/api/agents DELETE] ✅ Agent deleted:', agentId)

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('[/api/agents DELETE] API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
