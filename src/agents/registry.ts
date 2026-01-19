import { AgentConfig } from './types'
import { rafaelChatAgent } from './rafael/chat'
import { rafaelDiagnosisAgent } from './rafael/diagnosis'
import { rafaelSummaryAgent } from './rafael/summary'
import { growthoperatorDiagnosisAgent } from './growthoperator/diagnosis'
import { growthoperatorQ2PersonalizeAgent } from './growthoperator/q2-personalize'
import { growthoperatorQ3PersonalizeAgent } from './growthoperator/q3-personalize'
import { growthoperatorQ4PersonalizeAgent } from './growthoperator/q4-personalize'
import { growthoperatorQ5PersonalizeAgent } from './growthoperator/q5-personalize'
import { growthoperatorQ8PersonalizeAgent } from './growthoperator/q8-personalize'
import { growthoperatorQ14PersonalizeAgent } from './growthoperator/q14-personalize'
import { growthoperatorDiagnosis1Agent } from './growthoperator/diagnosis-1'
import { growthoperatorDiagnosis2Agent } from './growthoperator/diagnosis-2'
import { growthoperatorDiagnosis3Agent } from './growthoperator/diagnosis-3'
import { growthoperatorFinalDiagnosisAgent } from './growthoperator/final-diagnosis'
import { growthoperatorPathRevealAgent } from './growthoperator/path-reveal'
import { growthoperatorFitAssessmentAgent } from './growthoperator/fit-assessment'
import { growthoperatorDiagnosisComprehensiveAgent } from './growthoperator/diagnosis-comprehensive'
import { growthoperatorAIMoment1Agent } from './growthoperator/ai-moment-1'
import { growthoperatorAIMoment2Agent } from './growthoperator/ai-moment-2'
import { growthoperatorAIMoment3Agent } from './growthoperator/ai-moment-3'
import { growthoperatorAIMoment4Agent } from './growthoperator/ai-moment-4'
import { growthoperatorContactCaptureAgent } from './growthoperator/contact-capture'
import { growthoperatorAIReflection1Agent } from './growthoperator/ai-reflection-1'
import { growthoperatorAIReflection2Agent } from './growthoperator/ai-reflection-2'
import { growthoperatorDiagnosisV3Agent } from './growthoperator/diagnosis-v3'
import { blackboxDiagnosisAgent } from './blackbox/diagnosis'
import { blackboxChatAgent } from './blackbox/chat'

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
  // Growth Operator v3 - AI Moments
  'growthoperator-ai-moment-1': growthoperatorAIMoment1Agent,
  'growthoperator-ai-moment-2': growthoperatorAIMoment2Agent,
  'growthoperator-ai-moment-3': growthoperatorAIMoment3Agent,
  'growthoperator-ai-moment-4': growthoperatorAIMoment4Agent,
  // Growth Operator v3 - Q8 and Q14 Personalization
  'growthoperator-q8-personalize': growthoperatorQ8PersonalizeAgent,
  'growthoperator-q14-personalize': growthoperatorQ14PersonalizeAgent,
  // Growth Operator V3 (new flow)
  'growthoperator-contact-capture': growthoperatorContactCaptureAgent,
  'growthoperator-ai-reflection-1': growthoperatorAIReflection1Agent,
  'growthoperator-ai-reflection-2': growthoperatorAIReflection2Agent,
  'growthoperator-diagnosis-v3': growthoperatorDiagnosisV3Agent,
  // Legacy (keeping for backwards compatibility)
  'growthoperator-path-reveal': growthoperatorPathRevealAgent,
  'growthoperator-fit-assessment': growthoperatorFitAssessmentAgent,
  // Blackbox agents
  'blackbox-diagnosis': blackboxDiagnosisAgent,
  'blackbox-chat': blackboxChatAgent,
}

export function getAgent(id: string): AgentConfig | undefined {
  return agents[id]
}

export function listAgents(): AgentConfig[] {
  return Object.values(agents)
}
