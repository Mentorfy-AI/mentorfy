import type { FlowDefinition } from './types'

// Debug version of growth operator - minimal questions for faster dev loop
export const growthoperatorDebugFlow: FlowDefinition = {
  id: 'growthoperator-debug',

  mentor: {
    name: 'Brady Badour',
    handle: '@growthoperator',
    avatar: '/brady.jpg',
    welcome: {
      callout: "[DEBUG] If online business still hasn't worked for you YET...",
      headline: "It's not your fault. It's not the model. There's something you haven't been told.",
      subheadline: "Take this AI assessment to find out what's actually been in your way.",
      buttonText: 'Start Assessment',
      disclaimer: "Warning: This experience adapts based on your answers. Answer honestly... your diagnosis depends on it.",
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

  // Same context mapping - AI will have sparse data but that's fine for debug
  contextMapping: {
    'business.modelTried': 'assessment.modelTried',
    'business.modelsCount': 'assessment.modelsCount',
    'motivation.original': 'assessment.originalMotivation',
    'progress.bestResult': 'assessment.bestResult',
    'progress.whatHappened': 'assessment.whatHappened',
    'journey.duration': 'assessment.duration',
    'investment.money': 'assessment.moneyInvested',
    'investment.cost': 'assessment.deeperCost',
    'education.source': 'assessment.educationSource',
    'education.teacherMoney': 'assessment.teacherMoney',
    'belief.whyFailed': 'assessment.beliefWhyFailed',
    'emotion.current': 'assessment.emotionalState',
    'emotion.shame': 'assessment.shame',
    'resilience.whyGoing': 'assessment.whyKeepGoing',
    'vision.whatChanges': 'assessment.whatWouldChange',
    'urgency.level': 'assessment.urgency',
    'fear.biggest': 'assessment.biggestFear',
    'user.name': 'user.name',
    'user.email': 'user.email',
    'user.phone': 'user.phone',
  },

  phases: [
    {
      id: 1,
      name: 'Assessment',
      steps: [
        // Q1 only - keeps the exit condition for testing
        {
          stepKey: 'q1-models-tried',
          type: 'question',
          questionType: 'multiple-choice',
          question: "What business model have you tried?",
          instruction: "Select the model you've seriously attempted.",
          options: [
            { value: 'ecommerce', label: 'Ecommerce (dropshipping, Amazon FBA, print on demand)' },
            { value: 'agency', label: 'Agency or services (SMMA, lead gen, freelancing, AI automation)' },
            { value: 'sales', label: 'Sales (high ticket closing, appointment setting, remote sales)' },
            { value: 'content', label: 'Content creation (YouTube, TikTok, podcast, newsletter)' },
            { value: 'coaching', label: 'Coaching or courses (selling your own knowledge or expertise)' },
            { value: 'affiliate', label: 'Affiliate marketing (promoting other people\'s products)' },
            { value: 'software', label: 'Software or apps (SaaS, no-code tools, browser extensions)' },
            { value: 'investing', label: 'Trading or investing (crypto, forex, stocks, real estate)' },
            { value: 'not-tried-yet', label: "I haven't seriously tried anything yet" },
          ],
          stateKey: 'assessment.modelTried',
          exitCondition: {
            values: ['not-tried-yet'],
            headline: "This experience isn't for you yet.",
            message: "This assessment is designed for people who've already taken real swings at building something online. The insights won't land the same way if you haven't been through it yourself.\n\nWhen you've tried something and felt it not work the way you expected, come back. We'll be here.",
          },
        },

        // CONTACT GATE
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
          loadingMessages: [
            'Analyzing your responses...',
            'Identifying patterns...',
            'Generating your personalized diagnosis...',
          ],
          minDuration: 12000,
          noBackButton: true,
        },

        // DIAGNOSIS SEQUENCE
        {
          stepKey: 'diagnosis-sequence',
          type: 'diagnosis-sequence',
          promptKey: 'diagnosis-comprehensive',
          noBackButton: true,
        },
      ],
    },
  ],
}
