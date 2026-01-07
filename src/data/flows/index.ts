import { rafaelTatsFlow } from './rafael-tats'
import type { FlowDefinition } from './types'

const flows: Record<string, FlowDefinition> = {
  'rafael-tats': rafaelTatsFlow,
}

export function getFlow(flowId: string): FlowDefinition {
  const flow = flows[flowId]
  if (!flow) throw new Error(`Flow not found: ${flowId}`)
  return flow
}

export function getAllFlowIds(): string[] {
  return Object.keys(flows)
}

export type { FlowDefinition, PhaseConfig, StepConfig, MentorConfig, AgentConfig, EmbedConfig, ContactField } from './types'
