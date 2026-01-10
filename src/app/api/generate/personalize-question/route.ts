import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { db } from '@/lib/db'
import { getAgent } from '@/agents/registry'
import type { AgentConfig } from '@/agents/types'
import { createTrace, flushLangfuse, getAgentPrompt } from '@/lib/langfuse'
import { generateLimiter, checkRateLimit, rateLimitResponse, getIdentifier } from '@/lib/ratelimit'
import { sanitizeContextForAI } from '@/lib/context-sanitizer'

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

// Map promptKey to agent ID for question personalization
function getPersonalizeAgentId(promptKey: string): string | undefined {
  const agents: Record<string, string> = {
    'q2-personalize': 'growthoperator-q2-personalize',
    'q3-personalize': 'growthoperator-q3-personalize',
    'q4-personalize': 'growthoperator-q4-personalize',
    'q5-personalize': 'growthoperator-q5-personalize',
  }
  return agents[promptKey]
}

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const { sessionId, baseQuestion, promptKey } = await req.json()

    if (!sessionId || !promptKey) {
      return new Response(JSON.stringify({ error: 'sessionId and promptKey required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch session for context
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

    // Get personalization agent
    const agentId = getPersonalizeAgentId(promptKey)
    if (!agentId) {
      return new Response(JSON.stringify({ error: 'Invalid personalization promptKey' }), {
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

    // Create Langfuse trace
    const trace = createTrace({
      name: 'personalize-question',
      sessionId,
      userId: session.clerk_user_id || undefined,
      metadata: { agentId, promptKey, promptName, promptVersion },
    })

    const generation = trace.generation({
      name: `claude-personalize`,
      model: agent.model,
      input: { context: session.context, baseQuestion, promptKey },
      // Link to Langfuse prompt for version tracking
      prompt: langfusePrompt,
    })

    // Build user message with sanitized context
    const flowId = session.flow_id || 'growthoperator'
    const sanitizedContext = sanitizeContextForAI(flowId, session.context)
    const contextStr = JSON.stringify(sanitizedContext, null, 2)

    const userMessage = `User context:\n${contextStr}\n\nBase question to personalize: "${baseQuestion}"\n\nGenerate the personalized question.`

    const result = streamText({
      model: getModel(agent),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: agent.maxTokens,
      temperature: agent.temperature,
      onFinish: ({ text, usage }) => {
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

        flushLangfuse()
      },
    })

    return result.toTextStreamResponse()
  } catch (err) {
    console.error('Personalize question error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
