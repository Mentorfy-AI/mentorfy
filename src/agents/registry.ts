import { AgentConfig } from './types'
import { rafaelChatAgent } from './rafael/chat'
import { rafaelDiagnosisAgent } from './rafael/diagnosis'
import { rafaelSummaryAgent } from './rafael/summary'
import { growthoperatorDiagnosisAgent } from './growthoperator/diagnosis'
import { growthoperatorQ2PersonalizeAgent } from './growthoperator/q2-personalize'
import { growthoperatorQ3PersonalizeAgent } from './growthoperator/q3-personalize'
import { growthoperatorQ4PersonalizeAgent } from './growthoperator/q4-personalize'
import { growthoperatorQ5PersonalizeAgent } from './growthoperator/q5-personalize'
import { growthoperatorDiagnosis1Agent } from './growthoperator/diagnosis-1'
import { growthoperatorDiagnosis2Agent } from './growthoperator/diagnosis-2'
import { growthoperatorDiagnosis3Agent } from './growthoperator/diagnosis-3'
import { growthoperatorFinalDiagnosisAgent } from './growthoperator/final-diagnosis'
import { growthoperatorPathRevealAgent } from './growthoperator/path-reveal'
import { growthoperatorFitAssessmentAgent } from './growthoperator/fit-assessment'
import { growthoperatorDiagnosisComprehensiveAgent } from './growthoperator/diagnosis-comprehensive'
import { blackboxDiagnosisAgent } from './blackbox/diagnosis'

const agents: Record<string, AgentConfig> = {
  // Rafael TATS agents
  'rafael-chat': rafaelChatAgent,
  'rafael-diagnosis': rafaelDiagnosisAgent,
  'rafael-summary': rafaelSummaryAgent,
  // Growth Operator v1 (legacy)
  'growthoperator-diagnosis': growthoperatorDiagnosisAgent,
  // Growth Operator v2 agents
  'growthoperator-q2-personalize': growthoperatorQ2PersonalizeAgent,
  'growthoperator-q3-personalize': growthoperatorQ3PersonalizeAgent,
  'growthoperator-q4-personalize': growthoperatorQ4PersonalizeAgent,
  'growthoperator-q5-personalize': growthoperatorQ5PersonalizeAgent,
  'growthoperator-diagnosis-1': growthoperatorDiagnosis1Agent,
  'growthoperator-diagnosis-2': growthoperatorDiagnosis2Agent,
  'growthoperator-diagnosis-3': growthoperatorDiagnosis3Agent,
  'growthoperator-final-diagnosis': growthoperatorFinalDiagnosisAgent,
  // Growth Operator v3 - comprehensive 8-screen diagnosis
  'growthoperator-diagnosis-comprehensive': growthoperatorDiagnosisComprehensiveAgent,
  // Legacy (keeping for backwards compatibility)
  'growthoperator-path-reveal': growthoperatorPathRevealAgent,
  'growthoperator-fit-assessment': growthoperatorFitAssessmentAgent,
  // Blackbox agents
  'blackbox-diagnosis': blackboxDiagnosisAgent,
}

export function getAgent(id: string): AgentConfig | undefined {
  return agents[id]
}

export function listAgents(): AgentConfig[] {
  return Object.values(agents)
}
