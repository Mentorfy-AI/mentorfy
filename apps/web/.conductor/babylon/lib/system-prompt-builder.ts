export interface BehaviorSettings {
  purpose: string
  customInstructions: string[]
  speakingStyle: string
  maxTokens: number
  temperature: number
  modelName?: string
}


export function buildSystemPrompt(
  behaviorSettings: BehaviorSettings,
  contextString?: string
): string {
  const { purpose, customInstructions, speakingStyle } = behaviorSettings
  
  const baseContext = contextString 
    ? `Context from knowledge base:
${contextString}

Instructions:
- Prioritize information from the provided context
- If context is relevant, cite it naturally in your response  
- If context isn't relevant or sufficient, acknowledge this
- Be concise and helpful
- Maintain a friendly, professional tone

`
    : `The knowledge base search didn't return relevant results, so provide a general helpful response based on your training.

`

  const prompt = `${purpose}

${customInstructions.length > 0 ? `Custom Instructions:
${customInstructions.map(instruction => `• ${instruction}`).join('\n')}

` : ''}Communication Style:
${speakingStyle}

${baseContext}`

  return prompt
}


export function estimateTokenCount(text: string): number {
  // Simple estimation: roughly 4 characters per token for English text
  return Math.ceil(text.length / 4)
}

export const PURPOSE_LIMIT = 15000
export const SPEAKING_STYLE_LIMIT = 5000

export function validateCharacterLimits(
  purpose: string,
  speakingStyle: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (purpose.length > PURPOSE_LIMIT) {
    errors.push(`Purpose exceeds character limit (${purpose.length}/${PURPOSE_LIMIT})`)
  }
  
  if (speakingStyle.length > SPEAKING_STYLE_LIMIT) {
    errors.push(`Speaking style exceeds character limit (${speakingStyle.length}/${SPEAKING_STYLE_LIMIT})`)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}