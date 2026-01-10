import { streamText, convertToModelMessages, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { db } from '@/lib/db'
import { searchMemories, writeMemory } from '@/lib/supermemory'
import { getAgent } from '@/agents/registry'
import { createTrace, flushLangfuse } from '@/lib/langfuse'
import { chatLimiter, checkRateLimit, rateLimitResponse, getIdentifier } from '@/lib/ratelimit'
import { getAvailableEmbedsFromConfig, type AvailableEmbeds } from '@/lib/embed-resolver'
import { sanitizeContextForAI } from '@/lib/context-sanitizer'
import { getFlow } from '@/data/flows'
import { getRafaelChatPrompt } from '@/agents/rafael/chat'
import type { EmbedData } from '@/types'

/**
 * Derive completed phases from current_step_id
 * Returns null if step format is unrecognized (falls back to legacy)
 */
function deriveCompletedPhases(stepId: string | null): number[] | null {
  if (!stepId) return null

  // Step ID format: "phase-{N}-{state}" e.g., "phase-2-start", "phase-4-complete"
  const match = stepId.match(/^phase-(\d+)-(start|complete)$/)
  if (!match) return null

  const phaseNum = parseInt(match[1], 10)
  const state = match[2]

  // "phase-N-complete" means phases 1..N are done
  // "phase-N-start" means phases 1..(N-1) are done
  const completedCount = state === 'complete' ? phaseNum : phaseNum - 1

  if (completedCount <= 0) return []
  return Array.from({ length: completedCount }, (_, i) => i + 1)
}

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

/**
 * Build embed tools dynamically based on what's available from user's journey
 */
function buildEmbedTools(availableEmbeds: AvailableEmbeds) {
  const tools: Record<string, any> = {}

  if (availableEmbeds.checkoutPlanId) {
    tools.showCheckout = tool({
      description: 'Show checkout embed when user is ready to purchase',
      inputSchema: z.object({
        beforeText: z.string().describe('Natural lead-in text before the embed'),
        afterText: z.string().describe('Follow-up text after the embed'),
      }),
      execute: async ({ beforeText, afterText }): Promise<EmbedData> => ({
        embedType: 'checkout',
        beforeText,
        afterText,
        checkoutPlanId: availableEmbeds.checkoutPlanId,
      }),
    })
  }

  if (availableEmbeds.videoUrl) {
    tools.showVideo = tool({
      description: 'Show video embed when sharing a key insight',
      inputSchema: z.object({
        beforeText: z.string().describe('Natural lead-in text before the embed'),
        afterText: z.string().describe('Follow-up text after the embed'),
      }),
      execute: async ({ beforeText, afterText }): Promise<EmbedData> => ({
        embedType: 'video',
        beforeText,
        afterText,
        videoUrl: availableEmbeds.videoUrl,
      }),
    })
  }

  if (availableEmbeds.calendlyUrl) {
    tools.showBooking = tool({
      description: 'Show booking calendar when user is ready to schedule a call',
      inputSchema: z.object({
        beforeText: z.string().describe('Natural lead-in text before the embed'),
        afterText: z.string().describe('Follow-up text after the embed'),
      }),
      execute: async ({ beforeText }): Promise<EmbedData> => ({
        embedType: 'booking',
        beforeText,
        afterText: "Pick a time below. 30 minutes. They'll see everything we talked about—your history, your goals, why you're here. No repeating yourself. They'll already know who you are.",
        calendlyUrl: availableEmbeds.calendlyUrl,
      }),
    })
  }

  return tools
}

/**
 * Build prompt section describing available tools
 */
function buildEmbedSection(toolNames: string[]): string {
  if (toolNames.length === 0) {
    return 'No embed tools are available yet.'
  }
  return `You have these embed tools: ${toolNames.join(', ')}. Use when contextually appropriate.`
}

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    // Clone request for rate limiting check (need to read body twice)
    const body = await req.json()
    const { sessionId, messages, agentId = 'rafael-chat' } = body

    // Rate limiting - check before processing
    const { data: session } = sessionId
      ? await db.from('sessions').select('clerk_user_id').eq('id', sessionId).single()
      : { data: null }

    const identifier = getIdentifier(req, session?.clerk_user_id || undefined)
    const { success, reset } = await checkRateLimit(chatLimiter, identifier, !!session?.clerk_user_id)

    if (!success) {
      return rateLimitResponse(reset)
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch full session (we already have partial from rate limit check)
    const { data: fullSession, error: sessionError } = await db
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !fullSession) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Use fullSession from here
    const sessionData = fullSession

    // Get agent config
    const agent = getAgent(agentId)
    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Derive completed phases from current_step_id (server-as-truth)
    // Falls back to legacy context.progress.completedPhases for backward compatibility
    const completedPhases: number[] = deriveCompletedPhases(sessionData.current_step_id)
      || sessionData.context?.progress?.completedPhases
      || []
    const flow = getFlow(sessionData.flow_id || 'rafael-tats')
    const availableEmbeds = getAvailableEmbedsFromConfig(completedPhases, flow.embeds)

    // Build dynamic tools based on user's journey
    const embedTools = buildEmbedTools(availableEmbeds)
    const toolNames = Object.keys(embedTools)

    // Debug: log tool registration
    console.log('[Chat] Tool registration:', {
      sessionId,
      completedPhases,
      availableEmbeds,
      registeredTools: toolNames,
    })

    // Build dynamic prompt section
    const embedSection = buildEmbedSection(toolNames)
    const basePrompt = agentId === 'rafael-chat'
      ? getRafaelChatPrompt(embedSection)
      : agent.systemPrompt

    // Get last user message for memory search
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || ''

    // Search Supermemory for relevant context (skip if no query)
    const memories = lastUserMessage
      ? await searchMemories(sessionData.supermemory_container, lastUserMessage)
      : []

    // Build context from session + memories
    // Sanitize context to remove phase/step references before sending to AI
    const contextParts: string[] = []
    const flowId = sessionData.flow_id || 'rafael-tats'
    const sanitizedContext = sanitizeContextForAI(flowId, sessionData.context)

    if (Object.keys(sanitizedContext).length > 0) {
      contextParts.push(`User context: ${JSON.stringify(sanitizedContext)}`)
    }

    if (memories.length > 0) {
      contextParts.push(`Relevant memories:\n${memories.join('\n')}`)
    }

    const systemPrompt = contextParts.length > 0
      ? `${basePrompt}\n\n${contextParts.join('\n\n')}`
      : basePrompt

    // First chat: write session context to Supermemory
    if (messages.length === 1 && Object.keys(sessionData.context).length > 0) {
      writeMemory(
        sessionData.supermemory_container,
        `User profile and context: ${JSON.stringify(sessionData.context)}`
      )
    }

    // Convert UI messages to model format
    const modelMessages = await convertToModelMessages(messages)

    // Build messages array for Langfuse replay (system + UI messages)
    const langfuseMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
    ]

    // Create Langfuse trace
    const trace = createTrace({
      name: 'chat',
      sessionId,
      userId: sessionData.clerk_user_id || undefined,
      metadata: { flowId: sessionData.flow_id, agentId, hasTools: toolNames.length > 0, toolNames },
      input: langfuseMessages,
    })

    const generation = trace.generation({
      name: 'claude-chat',
      model: agent.model,
      modelParameters: {
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
      },
      input: langfuseMessages,
    })

    // Stream response with dynamic tools
    const result = streamText({
      model: anthropic(agent.model),
      system: systemPrompt,
      messages: modelMessages,
      tools: Object.keys(embedTools).length > 0 ? embedTools : undefined,
      maxOutputTokens: agent.maxTokens,
      temperature: agent.temperature,
      onFinish: ({ text, usage }) => {
        // Write conversation to Supermemory
        writeMemory(
          sessionData.supermemory_container,
          `User: ${lastUserMessage}\nAssistant: ${text}`
        )

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

        // Flush traces to Langfuse (fire-and-forget in serverless)
        flushLangfuse()
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error('Chat error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
