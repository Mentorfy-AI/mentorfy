import { streamText, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getAgent } from '@/agents/registry'
import type { AgentConfig } from '@/agents/types'
import { createTrace, flushLangfuse } from '@/lib/langfuse'
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

// Map flow + type to agent ID
function getAgentId(flowId: string, type: string): string | undefined {
  const flowAgents: Record<string, Record<string, string>> = {
    'rafael-tats': {
      diagnosis: 'rafael-diagnosis',
      summary: 'rafael-summary',
    },
    'growthoperator': {
      diagnosis: 'growthoperator-diagnosis',
    },
  }

  // Try flow-specific agent first, fall back to rafael
  return flowAgents[flowId]?.[type] || flowAgents['rafael-tats']?.[type]
}

/**
 * Build embed tools for diagnosis generation
 * Only includes showBooking if calendlyUrl is configured for the flow
 */
function buildDiagnosisTools(calendlyUrl?: string) {
  if (!calendlyUrl) return undefined

  return {
    showBooking: tool({
      description: 'Show booking calendar when the user is qualified and ready to schedule a call. Only use this if you determine the user is a good fit.',
      inputSchema: z.object({
        beforeText: z.string().describe('The diagnosis text to show before the calendar embed'),
        afterText: z.string().describe('Optional follow-up text after the calendar embed'),
      }),
      outputSchema: z.object({
        embedType: z.literal('booking'),
        beforeText: z.string(),
        afterText: z.string(),
        calendlyUrl: z.string(),
      }),
      execute: async ({ beforeText, afterText }) => ({
        embedType: 'booking' as const,
        beforeText,
        afterText: afterText || '',
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

    // Get flow config to access calendlyUrl for tools
    const flowId = session.flow_id || 'rafael-tats'
    const flow = getFlow(flowId)
    const calendlyUrl = flow.embeds.calendlyUrl

    // Get flow-specific agent
    const agentId = getAgentId(flowId, type)
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

    // Build tools only for final-diagnosis prompt (allows conditional booking)
    const shouldIncludeTools = promptKey === 'final-diagnosis' && calendlyUrl
    const tools = shouldIncludeTools ? buildDiagnosisTools(calendlyUrl) : undefined

    // Build user message with sanitized context (removes phase/step references)
    const sanitizedContext = sanitizeContextForAI(session.context)
    const contextStr = JSON.stringify(sanitizedContext, null, 2)
    const historyStr = conversationHistory
      ? `\n\nConversation history:\n${conversationHistory}`
      : ''

    const promptKeyInfo = promptKey ? `\nPrompt key: ${promptKey}` : ''
    const userMessage = `User context:\n${contextStr}${historyStr}${promptKeyInfo}\n\nGenerate the ${type} based on this information.`

    // Build messages array for LLM call (also used for Langfuse replay)
    const messages: { role: 'system' | 'user'; content: string }[] = [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: userMessage },
    ]

    // Create Langfuse trace
    const trace = createTrace({
      name: `generate-${type}`,
      sessionId,
      userId: session.clerk_user_id || undefined,
      metadata: { flowId, agentId, orgId: session.clerk_org_id, type, promptKey, hasTools: !!tools, toolNames: tools ? Object.keys(tools) : [] },
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
    })

    const result = streamText({
      model: getModel(agent),
      system: agent.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: Object.keys(tools || {}).length > 0 ? tools : undefined,
      maxOutputTokens: agent.maxTokens,
      temperature: agent.temperature,
      onFinish: ({ text, usage }) => {
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
          },
        })

        // Flush traces to Langfuse
        flushLangfuse()
      },
    })

    // Return UI message stream if tools are available (allows tool results to be parsed)
    // Otherwise return plain text stream for backward compatibility
    if (shouldIncludeTools) {
      return result.toUIMessageStreamResponse()
    }
    return result.toTextStreamResponse()
  } catch (err) {
    console.error(`Generate ${type} error:`, err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
