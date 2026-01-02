import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface Agent {
  id: string
  name: string
  display_name: string
  description: string
  avatar_url: string
  created_at: string
}

export interface AgentListResponse {
  success: boolean
  agents?: Agent[]
  error?: string
}

export interface CreateAgentRequest {
  display_name: string
  description: string
  model_name: string
  avatar_url?: string
}

export interface CreateAgentResponse {
  success: boolean
  agent?: Agent
  error?: string
}

/**
 * GET /api/agents
 * List all agents for current organization
 */
export async function GET(request: NextRequest): Promise<NextResponse<AgentListResponse>> {
  try {
    const { userId, orgId } = await requireAuth()

    console.log('[/api/agents] Request context:', { userId, orgId })

    const supabase = await createClerkSupabaseClient()

    // Get all agents for organization (RLS filters by org automatically)
    const { data: agents, error: agentsError } = await supabase
      .from('mentor_bot')
      .select('id, name, display_name, description, avatar_url, created_at')
      .order('created_at')

    if (agentsError) {
      console.error('[/api/agents] Error fetching agents:', agentsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch agents' },
        { status: 500 }
      )
    }

    console.log('[/api/agents] Found agents:', agents?.length || 0)

    // DEBUG: If no agents found, log additional details
    if (!agents || agents.length === 0) {
      console.warn('[/api/agents] ⚠️ NO AGENTS FOUND - Debug info:', {
        orgId,
        userId,
        expectedUilgOrgId: 'org_33XsKTrZLKrSf7krKYqrKvO65my',
        isUilgOrg: orgId === 'org_33XsKTrZLKrSf7krKYqrKvO65my',
        message: 'Check browser console for [Supabase Client] JWT payload logs'
      })
    } else {
      console.log('[/api/agents] ✅ Successfully fetched agents:', agents.map(a => ({
        id: a.id,
        display_name: a.display_name
      })))
    }

    return NextResponse.json({
      success: true,
      agents: agents || []
    })

  } catch (error) {
    console.error('[/api/agents] API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

/**
 * POST /api/agents
 * Create a new agent for current organization
 */
export async function POST(request: NextRequest): Promise<NextResponse<CreateAgentResponse>> {
  try {
    const { userId, orgId } = await requireAuth()

    console.log('[/api/agents POST] Request context:', { userId, orgId })

    const body: CreateAgentRequest = await request.json()

    // Validate required fields
    if (!body.display_name || !body.description || !body.model_name) {
      return NextResponse.json(
        { success: false, error: 'display_name, description, and model_name are required' },
        { status: 400 }
      )
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
    ]

    if (!anthropicModels.includes(body.model_name)) {
      return NextResponse.json(
        { success: false, error: 'Invalid model_name. Must be an Anthropic model.' },
        { status: 400 }
      )
    }

    const supabase = await createClerkSupabaseClient()

    // Generate name from display_name (lowercase, underscores)
    const name = body.display_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    // Create the agent
    const { data: agent, error: createError } = await supabase
      .from('mentor_bot')
      .insert({
        name,
        display_name: body.display_name,
        description: body.description,
        model_name: body.model_name,
        model_provider: 'anthropic',
        system_prompt: 'You are a helpful AI assistant.',
        avatar_url: body.avatar_url || '',
        clerk_org_id: orgId,
      })
      .select('id, name, display_name, description, avatar_url, created_at')
      .single()

    if (createError || !agent) {
      console.error('[/api/agents POST] Error creating agent:', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create agent' },
        { status: 500 }
      )
    }

    console.log('[/api/agents POST] ✅ Created agent:', { id: agent.id, display_name: agent.display_name })

    return NextResponse.json({
      success: true,
      agent
    })

  } catch (error) {
    console.error('[/api/agents POST] API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
