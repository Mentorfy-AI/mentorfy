import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { db } from '@/lib/db'
import { getAgent } from '@/agents/registry'
import { createTrace, flushLangfuse } from '@/lib/langfuse'
import { generateLimiter, checkRateLimit, rateLimitResponse, getIdentifier } from '@/lib/ratelimit'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

type RouteContext = { params: Promise<{ type: string }> }

const TYPE_TO_AGENT: Record<string, string> = {
  diagnosis: 'rafael-diagnosis',
  summary: 'rafael-summary',
}

export async function POST(req: Request, context: RouteContext) {
  const startTime = Date.now()
  const { type } = await context.params

  try {
    const { sessionId, conversationHistory } = await req.json()

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const agentId = TYPE_TO_AGENT[type]
    if (!agentId) {
      return new Response(JSON.stringify({ error: 'Invalid generation type' }), {
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

    // Create Langfuse trace
    const trace = createTrace({
      name: `generate-${type}`,
      sessionId,
      userId: session.clerk_user_id || undefined,
      metadata: { agentId, orgId: session.clerk_org_id, type },
    })

    const generation = trace.generation({
      name: `claude-${type}`,
      model: agent.model,
      input: { context: session.context, conversationHistory },
    })

    // Build user message with context
    const contextStr = JSON.stringify(session.context, null, 2)
    const historyStr = conversationHistory
      ? `\n\nConversation history:\n${conversationHistory}`
      : ''

    const userMessage = `User context:\n${contextStr}${historyStr}\n\nGenerate the ${type} based on this information.`

    const result = streamText({
      model: anthropic(agent.model),
      system: agent.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
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

    return result.toTextStreamResponse()
  } catch (err) {
    console.error(`Generate ${type} error:`, err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
