# Prompt Iteration Guide

This guide explains how to edit Growth Operator agent prompts directly in code.

## Where Prompts Live

All prompts are in `src/agents/growthoperator/`:

| File | Agent Purpose |
|------|---------------|
| `q2-personalize.ts` | Personalizes Q2 after user selects their business model |
| `q3-personalize.ts` | Personalizes Q3 after user shares what happened |
| `diagnosis-1.ts` | Explains why THEIR specific business model failed |
| `diagnosis-2.ts` | Explains why ALL business models fail (structural) |
| `diagnosis-3.ts` | Teases the path forward |
| `path-reveal.ts` | Reveals the opportunity |
| `fit-assessment.ts` | Qualifies the user and handles booking |

## How to Edit a Prompt

Each file exports an `AgentConfig` object. The prompt is in the `systemPrompt` field:

```typescript
export const growthoperatorDiagnosis1Agent: AgentConfig = {
  id: 'growthoperator-diagnosis-1',
  name: 'GO Diagnosis 1 - Model Breakdown',
  model: 'claude-haiku-4-5-20251001',
  maxTokens: 1024,
  temperature: 0.6,
  systemPrompt: `Your prompt goes here...`,  // <-- EDIT THIS
}
```

Just edit the `systemPrompt` string. Use backticks (`` ` ``) for multi-line strings.

## Testing Your Changes

1. Run the dev server: `bun dev`
2. Open http://localhost:3000/growthoperator
3. Walk through the form to reach the step that uses your agent
4. Changes take effect immediately on save (Next.js hot reload)

## Agent Flow Order

The agents fire in this order during the Growth Operator flow:

1. User selects business model (Q1)
2. **q2-personalize** → generates personalized Q2 question
3. User answers Q2 (what happened)
4. **q3-personalize** → generates personalized Q3 question
5. User answers Q3 (why they think it failed)
6. User answers Q4-Q5 (time/capital)
7. **diagnosis-1** → "Here's why YOUR model failed"
8. **diagnosis-2** → "Here's why ALL models fail"
9. **diagnosis-3** → "But there's a path..."
10. **path-reveal** → "Here's the opportunity"
11. **fit-assessment** → Qualifies user, shows booking if qualified

## Context Available to Each Agent

Agents receive user context. The available fields are documented in `src/agents/data-docs.ts`. Key fields:

- `businessModelHistory.modelTried` - The model they selected
- `businessModelHistory.whatHappened` - Their Q2 answer
- `businessModelHistory.whyTheyThinkItFailed` - Their Q3 answer
- `questionnaire.timeAvailable` - Hours per week
- `questionnaire.capitalAvailable` - Investment capacity

## Tips

- Use `**bold**` for emphasis (renders in the UI)
- Use `*italics*` for quoting user's words
- Keep paragraphs short (2-3 sentences)
- Reference the user's specific answers when possible
- The prompts should feel conversational, not like documentation

## Model Settings

You can also adjust in each agent file:
- `model` - Which Claude model to use
- `maxTokens` - Response length limit
- `temperature` - Creativity (0.0 = deterministic, 1.0 = creative)
