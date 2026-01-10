/**
 * Data access documentation for each agent.
 *
 * This defines what context fields each agent can access.
 * Brady controls the prompt copy in Langfuse; code controls what data exists.
 */

export const agentDataDocs: Record<string, string> = {
  // Q2/Q3 personalization agents
  'growthoperator-q2-personalize': `You have access to:
- businessModelHistory.modelTried: The business model they selected`,

  'growthoperator-q3-personalize': `You have access to:
- businessModelHistory.modelTried: The model they tried (from Q1)
- businessModelHistory.whatHappened: What happened when they tried it (from Q2)`,

  // Diagnosis flow agents
  'growthoperator-diagnosis-1': `You have access to:
- businessModelHistory.modelTried: The model they tried
- businessModelHistory.whatHappened: Their story of what happened
- businessModelHistory.whyTheyThinkItFailed: Their theory of why it failed`,

  'growthoperator-diagnosis-2': `You have access to:
- businessModelHistory.modelTried: The model they tried
- businessModelHistory.whatHappened: Their story
- businessModelHistory.whyTheyThinkItFailed: Their theory`,

  'growthoperator-diagnosis-3': `You have access to:
- (No specific data fields - this is mostly static copy with formatting)`,

  'growthoperator-path-reveal': `You have access to:
- businessModelHistory.modelTried: The model they tried
- futureVision.whatWouldChange: What they said would change if this works
- futureVision.whyNow: Why they're here today`,

  'growthoperator-fit-assessment': `You have access to:
- businessModelHistory.modelTried: The model they tried
- futureVision.whatWouldChange: What they want
- futureVision.whyNow: Why they're here
- readiness.isCommitted: "yes" if they said they're ready
- readiness.availableCapital: Their investment tier`,
}

export function getAgentDataDocs(agentId: string): string | undefined {
  return agentDataDocs[agentId]
}
