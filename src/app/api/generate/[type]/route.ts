import { streamText, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getAgent } from '@/agents/registry'
import type { AgentConfig } from '@/agents/types'
import { createTrace, flushLangfuse, getAgentPrompt } from '@/lib/langfuse'
import { generateLimiter, checkRateLimit, rateLimitResponse, getIdentifier } from '@/lib/ratelimit'
import { sanitizeContextForAI } from '@/lib/context-sanitizer'
import { getFlow } from '@/data/flows'
import type { EmbedData } from '@/types'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
})

function getModel(agent: AgentConfig) {
  if (agent.provider === 'google') {
    return google(agent.model)
  }
  return anthropic(agent.model)
}

type RouteContext = { params: Promise<{ type: string }> }

// Map flow + type + promptKey to agent ID
function getAgentId(flowId: string, type: string, promptKey?: string): string | undefined {
  // Growth Operator v2/v3/v4 uses promptKey-based routing
  if (flowId === 'growthoperator' && type === 'diagnosis' && promptKey) {
    const promptKeyToAgent: Record<string, string> = {
      // v3 comprehensive 8-screen diagnosis (Opus 4.5)
      'diagnosis-comprehensive': 'growthoperator-diagnosis-comprehensive',
      // v2 multi-step diagnosis
      'diagnosis-1': 'growthoperator-diagnosis-1',
      'diagnosis-2': 'growthoperator-diagnosis-2',
      'diagnosis-3': 'growthoperator-diagnosis-3',
      'final-diagnosis': 'growthoperator-final-diagnosis',
      // Legacy (keeping for backwards compatibility)
      'path-reveal': 'growthoperator-path-reveal',
      'fit-assessment': 'growthoperator-fit-assessment',
      'first-diagnosis': 'growthoperator-diagnosis',
    }
    if (promptKeyToAgent[promptKey]) {
      return promptKeyToAgent[promptKey]
    }
  }

  const flowAgents: Record<string, Record<string, string>> = {
    'rafael-tats': {
      diagnosis: 'rafael-diagnosis',
      summary: 'rafael-summary',
    },
    'growthoperator': {
      diagnosis: 'growthoperator-diagnosis',
    },
  }

  // Return flow-specific agent only - no fallback to prevent cross-flow contamination
  return flowAgents[flowId]?.[type]
}

/**
 * Build embed tools for diagnosis generation
 * Only includes showBooking if calendlyUrl is configured for the flow
 */
function buildDiagnosisTools(calendlyUrl?: string) {
  if (!calendlyUrl) return undefined

  return {
    showBooking: tool({
      description: 'Show booking calendar when the user is qualified and ready to schedule a call. Call this after your main copy to display the calendar, then include the future pace text in afterText.',
      inputSchema: z.object({
        afterText: z.string().describe('The future pace copy to show after the calendar embed - what happens after they book'),
      }),
      outputSchema: z.object({
        embedType: z.literal('booking'),
        beforeText: z.string(),
        afterText: z.string(),
        calendlyUrl: z.string(),
      }),
      execute: async ({ afterText }) => ({
        embedType: 'booking' as const,
        beforeText: '', // beforeText comes from the streamed text before the tool call
        afterText,
        calendlyUrl,
      }),
    }),
  }
}

export async function POST(req: Request, context: RouteContext) {
  const startTime = Date.now()
  const { type } = await context.params

  try {
    const { sessionId, conversationHistory, promptKey } = await req.json()

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch session for instant context (not Supermemory)
    const { data: session, error: sessionError } = await db
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Require flow_id - prevent cross-flow contamination from missing data
    if (!session.flow_id) {
      console.error(`Session ${sessionId} missing flow_id - cannot determine agent`)
      return new Response(JSON.stringify({ error: 'Session missing flow_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get flow config to access calendlyUrl for tools
    const flowId = session.flow_id
    const flow = getFlow(flowId)
    const calendlyUrl = flow.embeds.calendlyUrl

    // Get flow-specific agent (with promptKey for GO v2 routing)
    const agentId = getAgentId(flowId, type, promptKey)
    if (!agentId) {
      return new Response(JSON.stringify({ error: 'Invalid generation type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Rate limiting
    const identifier = getIdentifier(req, session.clerk_user_id || undefined)
    const { success, reset } = await checkRateLimit(generateLimiter, identifier, !!session.clerk_user_id)

    if (!success) {
      return rateLimitResponse(reset)
    }

    const agent = getAgent(agentId)
    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch prompt from Langfuse (falls back to hardcoded if unavailable)
    const { systemPrompt, langfusePrompt, promptVersion, promptName } = await getAgentPrompt(agentId)

    // Build tools for prompts that can show booking (final-diagnosis for v1, fit-assessment for v2)
    const toolPromptKeys = ['final-diagnosis', 'fit-assessment']
    const shouldIncludeTools = toolPromptKeys.includes(promptKey || '') && calendlyUrl
    const tools = shouldIncludeTools ? buildDiagnosisTools(calendlyUrl) : undefined

    // Build user message with sanitized context (removes phase/step references)
    // Use session.answers as source of truth (context is deprecated per db.ts)
    const sanitizedContext = sanitizeContextForAI(flowId, session.answers)

    // Prevent diagnosis calls with empty context
    if (type === 'diagnosis' && Object.keys(sanitizedContext).length === 0) {
      console.error(`[Generate ${type}] Empty context for session ${sessionId} - aborting`)
      return new Response(JSON.stringify({ error: 'No assessment data found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const contextStr = JSON.stringify(sanitizedContext, null, 2)
    const historyStr = conversationHistory
      ? `\n\nConversation history:\n${conversationHistory}`
      : ''

    const promptKeyInfo = promptKey ? `\nPrompt key: ${promptKey}` : ''
    const userMessage = `User context:\n${contextStr}${historyStr}${promptKeyInfo}\n\nGenerate the ${type} based on this information.`

    // Build messages array for LLM call (also used for Langfuse replay)
    const messages: { role: 'system' | 'user'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]

    // Create Langfuse trace
    const trace = createTrace({
      name: `generate-${type}`,
      sessionId,
      userId: session.clerk_user_id || undefined,
      metadata: {
        flowId,
        agentId,
        type,
        promptKey,
        hasTools: !!tools,
        toolNames: tools ? Object.keys(tools) : [],
        promptName,
        promptVersion,
      },
      input: messages,
    })

    const generation = trace.generation({
      name: `llm-${type}`,
      model: agent.model,
      modelParameters: {
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
      },
      input: messages,
      // Link to Langfuse prompt for version tracking
      prompt: langfusePrompt,
    })

    // Build messages array
    // Note: Anthropic prompt caching disabled - requires 4096+ tokens for Opus 4.5,
    // our prompts are ~3500 tokens, and benchmarks showed no latency benefit anyway
    const isAnthropic = agent.provider === 'anthropic'
    const streamMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ]

    const result = streamText({
      model: getModel(agent),
      system: isAnthropic ? undefined : systemPrompt,
      messages: isAnthropic ? streamMessages : [{ role: 'user' as const, content: userMessage }],
      tools: Object.keys(tools || {}).length > 0 ? tools : undefined,
      maxOutputTokens: agent.maxTokens,
      temperature: agent.temperature,
      onFinish: ({ text, usage, finishReason, providerMetadata }) => {
        // Log cache stats if available (Anthropic only)
        const anthropicUsage = providerMetadata?.anthropic?.usage as
          | { cache_creation_input_tokens?: number; cache_read_input_tokens?: number }
          | undefined
        if (anthropicUsage) {
          trace.update({
            metadata: {
              cacheCreationInputTokens: anthropicUsage.cache_creation_input_tokens,
              cacheReadInputTokens: anthropicUsage.cache_read_input_tokens,
            },
          })
        }
        // Complete Langfuse generation
        generation.end({
          output: text,
          usage: {
            input: usage?.inputTokens,
            output: usage?.outputTokens,
          },
        })

        trace.update({
          output: text,
          metadata: {
            latencyMs: Date.now() - startTime,
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            finishReason,
          },
        })

        // Flush traces to Langfuse
        flushLangfuse()
      },
    })

    // Always use UI message stream - the client parser handles it correctly
    // and it preserves newlines (plain text stream parsing strips them)
    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error(`Generate ${type} error:`, err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
