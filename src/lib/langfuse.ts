import { Langfuse, type ChatPromptClient } from 'langfuse'
import { getAgentDataDocs } from '@/agents/data-docs'
import { getAgent } from '@/agents/registry'

let langfuseClient: Langfuse | null = null

export function getLangfuse(): Langfuse {
  if (!langfuseClient) {
    langfuseClient = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_HOST,
    })
  }
  return langfuseClient
}

// Map agent IDs to Langfuse prompt names
// DISABLED: Using hardcoded prompts in code for now (Brady iterating directly)
// Re-enable when Langfuse workflow is ready
const agentToPromptName: Record<string, string> = {
  // 'growthoperator-q2-personalize': 'GO: After Biz Model Selected',
  // 'growthoperator-q3-personalize': 'GO: After What Happened',
  // 'growthoperator-diagnosis-1': 'GO: Diagnosis - Why Your Biz Model Failed',
  // 'growthoperator-diagnosis-2': 'GO: Diagnosis - Why ALL Biz Models Fail',
  // 'growthoperator-diagnosis-3': 'GO: Diagnosis - Tease The Path',
  // 'growthoperator-path-reveal': 'GO: Reveal The Opportunity',
  // 'growthoperator-fit-assessment': 'GO: Qualification + Booking',
}

export interface AgentPromptResult {
  systemPrompt: string
  langfusePrompt?: ChatPromptClient
  promptVersion?: number
  promptName?: string
}

/**
 * Fetch agent prompt from Langfuse, prepending code-controlled data docs.
 *
 * Architecture:
 *   finalSystemPrompt = dataAccessDocs (code) + langfusePrompt (Brady)
 *
 * - dataAccessDocs: What context fields exist, stays in sync with code
 * - langfusePrompt: Everything else - formatting, structure, copy, tool logic
 *
 * Falls back to hardcoded agent prompt if Langfuse unavailable.
 */
export async function getAgentPrompt(agentId: string): Promise<AgentPromptResult> {
  const agent = getAgent(agentId)
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`)
  }

  const promptName = agentToPromptName[agentId]
  if (!promptName) {
    // Agent not in Langfuse yet - use hardcoded prompt
    return { systemPrompt: agent.systemPrompt }
  }

  try {
    const langfuse = getLangfuse()
    const isProduction = process.env.NODE_ENV === 'production'

    // Cache for 5 min in prod, no cache in dev for fast iteration
    const prompt = await langfuse.getPrompt(promptName, undefined, {
      type: 'chat',
      cacheTtlSeconds: isProduction ? 300 : 0,
      label: isProduction ? 'production' : 'latest',
    }) as ChatPromptClient

    // Extract system message from chat prompt
    const compiled = prompt.compile({})
    const systemMessage = compiled.find((m: any) => m.role === 'system')

    if (!systemMessage?.content) {
      console.warn(`Langfuse prompt ${promptName} has no system message, falling back`)
      return { systemPrompt: agent.systemPrompt }
    }

    // Prepend data access docs from code
    const dataDocs = getAgentDataDocs(agentId)
    const finalPrompt = dataDocs
      ? `${dataDocs}\n\n${systemMessage.content}`
      : systemMessage.content

    return {
      systemPrompt: finalPrompt,
      langfusePrompt: prompt,
      promptVersion: prompt.version,
      promptName,
    }
  } catch (err) {
    console.error(`Failed to fetch Langfuse prompt ${promptName}:`, err)
    // Fallback to hardcoded prompt
    return { systemPrompt: agent.systemPrompt }
  }
}

// Flush traces - call this after trace operations in serverless
export async function flushLangfuse(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.flushAsync()
  }
}

export function createTrace(params: {
  name: string
  sessionId?: string
  userId?: string
  metadata?: Record<string, any>
  input?: any
}) {
  return getLangfuse().trace({
    name: params.name,
    sessionId: params.sessionId,
    userId: params.userId,
    metadata: params.metadata,
    input: params.input,
  })
}
