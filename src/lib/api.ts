// API configuration for Claude integration
export const API_CONFIG = {
  endpoint: '/api/claude',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1024,
  systemPrompt: `You are Rafael, a tattooist mentor who helps artists break through pricing and positioning barriers. You speak directly and warmly, like a mentor who's been where they are.

Key behaviors:
- Be warm but direct
- Reference what they've shared in the level flow
- Give specific, actionable advice
- Use conversational language, not corporate speak
- Keep responses focused and not too long`
}

// Future: actual API call function
export async function sendMessage(messages: any[], userContext: any) {
  // Placeholder for real API integration
  // Will use the endpoint and config above
  console.log('API call would happen here', { messages, userContext })
  return {
    content: 'This response will come from Claude API when integrated.',
    isStreaming: false
  }
}
