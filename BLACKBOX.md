# Blackbox Flow (Brady/Rios)

This document describes the blackbox flow architecture for Brady's Claude Code to iterate on.

## Quick Start

The blackbox flow is accessed at `/blackbox` and consists of:
1. Assessment questions (placeholder)
2. Contact capture (name, email, phone)
3. Loading screen with diagnosis generation
4. 8-screen diagnosis sequence with Calendly booking

## Key Files to Edit

### Flow Definition
**`src/data/flows/blackbox.ts`** - Main flow configuration
- Questions, steps, and phase structure
- Mentor profile (name, avatar, Calendly URL)
- AI model settings for chat/diagnosis/summary
- Context mapping for diagnosis prompts

### Agent/Prompt
**`src/agents/blackbox/diagnosis.ts`** - Diagnosis agent configuration
- System prompt that generates the 8 diagnosis screens
- Uses Claude Opus 4.5 (4096 tokens, temp: 0.4)
- Output format: XML tags `<screen_1>` through `<screen_8>`

### Components (if UI changes needed)
- `src/components/flow/screens/LoadingScreenStepContent.tsx` - Loading animation + diagnosis fetch
- `src/components/flow/screens/DiagnosisSequenceFlow.tsx` - 8-screen diagnosis renderer

## Flow Structure

```
Phase: Assessment
├── q1: Multiple choice (placeholder)
├── q2: Multiple choice (placeholder)
├── q3: Multiple choice (placeholder)
├── contact: Name, Email, Phone collection
├── loading: 12s minimum with rotating messages
└── diagnosis-sequence: 8 screens with typing animation
```

## Current Configuration

```typescript
mentor: {
  name: 'Brady Badour',
  handle: '@blackbox',
  avatar: '/brady.jpg',
  calendlyUrl: 'https://calendly.com/brady-mentorfy/30min',
}
```

## Common Tasks

### Change Assessment Questions
Edit `src/data/flows/blackbox.ts`:
```typescript
steps: [
  {
    type: 'question',
    id: 'q1',
    content: 'Your question text here',
    options: [
      { label: 'Option A', value: 'option-a' },
      { label: 'Option B', value: 'option-b' },
      // ...
    ],
  },
  // ...
]
```

### Modify Diagnosis Prompt
Edit `src/agents/blackbox/diagnosis.ts`:
- `systemPrompt` contains the full prompt for generating diagnosis screens
- Must output `<screen_1>` through `<screen_8>` XML tags
- Each screen supports markdown formatting
- Screen 8 should include call-to-action for Calendly booking

### Update Context Mapping
The `contextMapping` in `blackbox.ts` maps session answers to prompt variables:
```typescript
contextMapping: {
  'assessment.q1': 'placeholder.q1',  // Maps to {{placeholder.q1}} in prompt
  'assessment.q2': 'placeholder.q2',
  // ...
}
```

### Change Loading Messages
Edit `loadingMessages` array in `blackbox.ts`:
```typescript
loadingMessages: [
  'Analyzing your responses...',
  'Building your personalized diagnosis...',
  // ...
],
```

## Webhook Integration

When contacts are captured, a webhook fires to the configured URL with:
```json
{
  "event": "lead.contact-captured",
  "session": {
    "flowId": "blackbox",
    "email": "...",
    "phone": "...",
    "name": "...",
    "answers": { ... }
  }
}
```

Webhook URL is configured in `src/data/flows/blackbox.ts` under `webhookUrl`.

## Testing

1. Visit `http://localhost:3000/blackbox`
2. Answer assessment questions
3. Enter contact info
4. Watch loading screen (12s minimum)
5. Navigate through 8 diagnosis screens
6. Verify Calendly embed on screen 8

## File Reference

| File | Purpose |
|------|---------|
| `src/data/flows/blackbox.ts` | Flow definition, questions, config |
| `src/agents/blackbox/diagnosis.ts` | Diagnosis prompt & agent settings |
| `src/agents/registry.ts` | Agent registry (registers blackbox-diagnosis) |
| `src/data/flows/types.ts` | TypeScript interfaces |
| `src/app/api/generate/[type]/route.ts` | Generation API endpoint |
