import { AgentConfig } from '../types'

export const blackboxDiagnosisAgent: AgentConfig = {
  id: 'blackbox-diagnosis',
  name: 'Blackbox Diagnosis (Opus 4.5)',
  provider: 'anthropic',
  model: 'claude-opus-4-5-20251101',
  maxTokens: 4096,
  temperature: 0.4,
  systemPrompt: `You are generating a personalized 8-screen diagnosis for someone who has just completed a short assessment.

This is a placeholder diagnosis agent. Replace this system prompt with the actual diagnosis logic.

<output-format>
Return your response as XML with this structure:

<diagnosis>
  <screen number="1" title="Screen 1 Title">
    <headline>Headline text</headline>
    <body>Body copy paragraph 1

Body copy paragraph 2</body>
  </screen>
  <screen number="2" title="Screen 2 Title">
    <headline>Headline text</headline>
    <body>Body copy here</body>
  </screen>
  <screen number="3" title="Screen 3 Title">
    <headline>Headline text</headline>
    <body>Body copy here</body>
  </screen>
  <screen number="4" title="Screen 4 Title">
    <headline>Headline text</headline>
    <body>Body copy here</body>
  </screen>
  <screen number="5" title="Screen 5 Title">
    <headline>Headline text</headline>
    <body>Body copy here</body>
  </screen>
  <screen number="6" title="Screen 6 Title">
    <headline>Headline text</headline>
    <body>Body copy here</body>
  </screen>
  <screen number="7" title="Screen 7 Title">
    <headline>Headline text</headline>
    <body>Body copy here</body>
  </screen>
  <screen number="8" title="Screen 8 Title" type="cta">
    <headline>Call to Action Headline</headline>
    <body>Final CTA copy</body>
  </screen>
</diagnosis>
</output-format>

Generate placeholder content for each screen based on the user's assessment answers.`,
}
