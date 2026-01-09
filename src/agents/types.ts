export interface ToolContext {
  sessionId: string
  orgId: string
  userId?: string
  memories: string[]
  sessionContext: Record<string, any>
}

export interface ToolConfig {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (params: any, context: ToolContext) => Promise<any>
}

export interface AgentConfig {
  id: string
  name: string
  provider?: 'anthropic' | 'google'
  model: string
  systemPrompt: string
  maxTokens: number
  temperature?: number
  tools?: ToolConfig[]
}
