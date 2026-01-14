import type { FlowDefinition } from './types'

export const blackboxFlow: FlowDefinition = {
  id: 'blackbox',

  mentor: {
    name: 'Brady Badour',
    handle: '@blackbox',
    avatar: '/brady.jpg',
    welcome: {
      callout: 'Placeholder callout text...',
      headline: 'Placeholder headline text',
      subheadline: 'Placeholder subheadline text.',
      buttonText: 'Start Assessment',
      disclaimer: 'Placeholder disclaimer text.',
    },
  },

  agents: {
    chat: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, temperature: 0.7 },
    diagnosis: { model: 'claude-opus-4-5-20251101', maxTokens: 4096 },
    summary: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024 },
  },

  embeds: {
    calendlyUrl: 'https://calendly.com/brady-mentorfy/30min',
  },

  webhookUrl: process.env.BLACKBOX_WEBHOOK_URL,

  contextMapping: {
    // Q1-Q3: Placeholder questions
    'assessment.q1': 'placeholder.q1',
    'assessment.q2': 'placeholder.q2',
    'assessment.q3': 'placeholder.q3',
    // Contact info
    'user.name': 'user.name',
    'user.email': 'user.email',
    'user.phone': 'user.phone',
  },

  phases: [
    {
      id: 1,
      name: 'Assessment',
      steps: [
        // Q1: Placeholder question 1
        {
          stepKey: 'q1-placeholder',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'Placeholder question 1?',
          options: [
            { value: 'option-a', label: 'Option A' },
            { value: 'option-b', label: 'Option B' },
            { value: 'option-c', label: 'Option C' },
          ],
          stateKey: 'assessment.q1',
        },

        // Q2: Placeholder question 2
        {
          stepKey: 'q2-placeholder',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'Placeholder question 2?',
          options: [
            { value: 'option-a', label: 'Option A' },
            { value: 'option-b', label: 'Option B' },
            { value: 'option-c', label: 'Option C' },
          ],
          stateKey: 'assessment.q2',
        },

        // Q3: Placeholder question 3
        {
          stepKey: 'q3-placeholder',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'Placeholder question 3?',
          options: [
            { value: 'option-a', label: 'Option A' },
            { value: 'option-b', label: 'Option B' },
            { value: 'option-c', label: 'Option C' },
          ],
          stateKey: 'assessment.q3',
        },

        // CONTACT GATE: Name, Email, Phone
        {
          stepKey: 'contact-gate',
          type: 'question',
          questionType: 'contact-info',
          question: 'Enter your info to see your personalized diagnosis.',
          fields: [
            { key: 'name', label: 'Name', type: 'text', placeholder: 'Your name', autoComplete: 'name' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', autoComplete: 'email' },
            { key: 'phone', label: 'Phone', type: 'tel', placeholder: '(555) 123-4567', autoComplete: 'tel' },
          ],
          stateKey: 'user',
          noBackButton: true,
        },

        // LOADING SCREEN
        {
          stepKey: 'loading-diagnosis',
          type: 'loading',
          loadingMessages: {
            initial: [
              'Analyzing your responses...',
              'Identifying patterns in your journey...',
              'This is interesting...',
              'Connecting the dots...',
              'I see what happened here...',
              'Preparing your diagnosis...',
            ],
            waiting: [
              'Almost there...',
              'Just a moment longer...',
              'Putting the finishing touches...',
              'This is taking a bit longer than usual...',
              'Still working on it...',
              'Hang tight...',
            ],
            ready: "Alright it's ready... let's dive in.",
          },
          minDuration: 12000,
          noBackButton: true,
        },

        // DIAGNOSIS SEQUENCE
        {
          stepKey: 'diagnosis-sequence',
          type: 'diagnosis-sequence',
          promptKey: 'blackbox-diagnosis',
          noBackButton: true,
        },
      ],
    },
  ],
}
