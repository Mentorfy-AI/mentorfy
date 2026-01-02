import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server'
import { BehaviorSettings, validateCharacterLimits } from '@/lib/system-prompt-builder'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const botId = searchParams.get('botId')

  if (!botId) {
    return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 })
  }

  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 })
    }

    const supabase = await createClerkSupabaseClient()

    // Get specific agent and verify it belongs to user's organization
    const { data: mentorBot, error: botError } = await supabase
      .from('mentor_bot')
      .select('purpose, custom_instructions, speaking_style, max_tokens, temperature, model_name, model_provider')
      .eq('id', botId)
      .eq('clerk_org_id', orgId)
      .single()

    if (botError || !mentorBot) {
      console.log('[SECURITY] Access denied: User attempted to access bot settings from different org', {
        userId,
        orgId,
        botId,
        action: 'get_settings',
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Build behavior settings response
    const behaviorSettings: BehaviorSettings = {
      purpose: mentorBot.purpose || '',
      customInstructions: mentorBot.custom_instructions || [],
      speakingStyle: mentorBot.speaking_style || '',
      maxTokens: mentorBot.max_tokens || 1000,
      temperature: mentorBot.temperature || 0.7,
      modelName: mentorBot.model_name || 'gpt-3.5-turbo'
    }

    return NextResponse.json(behaviorSettings)
  } catch (error) {
    console.error('Error loading behavior settings:', error)
    return NextResponse.json({ error: 'Failed to load behavior settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 })
    }

    const supabase = await createClerkSupabaseClient()

    // Parse request body
    const body = await request.json()
    const { botId, purpose, customInstructions, speakingStyle, maxTokens, temperature, modelName } = body

    // Validate botId
    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 })
    }

    // Validate required fields
    if (!purpose || !customInstructions || !speakingStyle || typeof maxTokens !== 'number' || typeof temperature !== 'number' || !modelName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate ranges
    if (maxTokens < 100 || maxTokens > 4000) {
      return NextResponse.json({ error: 'Max tokens must be between 100 and 4000' }, { status: 400 })
    }

    if (temperature < 0 || temperature > 2) {
      return NextResponse.json({ error: 'Temperature must be between 0.0 and 2.0' }, { status: 400 })
    }

    // Validate model name
    const validModels = [
      // OpenAI Models
      'gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o',
      // Claude 3 Models
      'claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229',
      // Claude 3.5 Models
      'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20240620',
      // Claude 3.7 Models
      'claude-3-7-sonnet-20250219',
      // Claude 4 Models
      'claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-opus-4-1-20250805'
    ]
    if (!validModels.includes(modelName)) {
      return NextResponse.json({ error: 'Invalid model name' }, { status: 400 })
    }

    // Determine model provider based on model name
    const modelProvider = modelName.startsWith('gpt-') ? 'openai' : 'anthropic'

    // Validate character limits
    const validation = validateCharacterLimits(purpose, speakingStyle)
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 })
    }

    // Update specific agent settings (verify organization ownership)
    const { error: updateError } = await supabase
      .from('mentor_bot')
      .update({
        purpose: purpose,
        custom_instructions: customInstructions,
        speaking_style: speakingStyle,
        max_tokens: maxTokens,
        temperature: temperature,
        model_name: modelName,
        model_provider: modelProvider,
        updated_at: new Date().toISOString()
      })
      .eq('id', botId)
      .eq('clerk_org_id', orgId)

    if (updateError) {
      console.error('Error updating agent:', updateError)
      console.log('[SECURITY] Failed to update bot settings', {
        userId,
        orgId,
        botId,
        action: 'update_settings',
        error: updateError.message,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ error: 'Failed to save behavior settings' }, { status: 500 })
    }

    console.log('[SECURITY] Bot settings updated', {
      userId,
      orgId,
      botId,
      action: 'update_settings',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving behavior settings:', error)
    return NextResponse.json({ error: 'Failed to save behavior settings' }, { status: 500 })
  }
}