import type { FlowDefinition } from './types'

export const growthoperatorFlow: FlowDefinition = {
  id: 'growthoperator',

  mentor: {
    name: 'Brady Badour',
    handle: '@growthoperator',
    avatar: '/brady.jpg',
    welcome: {
      callout: "In the next 5-10 minutes I'll show you why online business hasn't worked for you yet...",
      headline: "Then I'll show you the best business model for your situation in the new 2026 AI economy",
      subheadline: '',
      buttonText: 'Start Conversation',
      disclaimer: 'Warning: This experience adapts based on your answers. Please thoughtfully respond to get the most value from this. Enjoy :)',
    },
  },

  agents: {
    chat: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, temperature: 0.7 },
    diagnosis: { model: 'claude-haiku-4-5-20251001', maxTokens: 2048 },
    summary: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024 },
  },

  embeds: {
    calendlyUrl: 'https://calendly.com/brady-mentorfy/30min',
  },

  // Maps raw session state keys to sanitized keys for AI agents
  contextMapping: {
    // Business model history
    'businessModelHistory.modelTried': 'models.tried',
    'businessModelHistory.whatHappened': 'models.whatHappened',
    'businessModelHistory.whyTheyThinkItFailed': 'models.whyFailed',
    // Future vision
    'futureVision.whatWouldChange': 'vision.whatChanges',
    'futureVision.whyNow': 'vision.whyNow',
    // Readiness/commitment
    'readiness.isCommitted': 'commitment.ready',
    'readiness.availableCapital': 'commitment.capital',
  },

  phases: [
    {
      id: 1,
      name: 'Assessment',
      steps: [
        // Q1: What business models have you tried?
        {
          stepKey: 'q1-models-tried',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Let's start easy. What have you tried?",
          options: [
            { value: 'ecommerce', label: 'Ecommerce (dropshipping, Amazon FBA, print on demand, reselling)' },
            { value: 'agency', label: 'Agency / Services (SMMA, lead gen, web dev, AI automation, freelancing)' },
            { value: 'sales', label: 'Sales (high ticket closing, appointment setting, dialing)' },
            { value: 'content', label: 'Content Creation (YouTube, TikTok, podcast, newsletter, blog)' },
            { value: 'education', label: 'Education Products (courses, coaching, consulting, communities)' },
            { value: 'affiliate', label: 'Affiliate Marketing (Amazon, ClickBank, niche sites, network marketing)' },
            { value: 'software', label: 'Software (SaaS, apps, Chrome extensions, no-code tools)' },
            { value: 'investing', label: 'Investing (crypto, forex, stocks, options, real estate)' },
            { value: 'not-tried-yet', label: 'I have not tried a business model yet' },
          ],
          stateKey: 'models.tried',
          exitCondition: {
            values: ['not-tried-yet'],
            headline: 'This is not for you',
            message: "This experience is designed for people who've already tried building something online.\n\nThe insights here won't land the same way if you haven't been through it yourself.\n\nWhen you've taken your first real swing at building something, come back. We'll be here.",
          },
        },

        // Q2: What happened? (personalized based on Q1)
        {
          stepKey: 'q2-what-happened',
          type: 'question',
          questionType: 'long-answer',
          baseQuestion: 'Tell me what happened. How far did you get? What made you stop?',
          personalizePromptKey: 'q2-personalize',
          placeholder: 'Be honest about what happened...',
          stateKey: 'models.whatHappened',
          noBackButton: true, // First step of Phase C, cannot go back to Phase B
        },

        // Q3: Why do you think it didn't work? (personalized based on Q1 + Q2)
        {
          stepKey: 'q3-why-failed',
          type: 'question',
          questionType: 'long-answer',
          baseQuestion: 'Why didn\'t it work?',
          personalizePromptKey: 'q3-personalize',
          placeholder: 'What do you think went wrong...',
          stateKey: 'models.whyFailed',
        },

        // Diagnosis 1: Problem with that specific model
        {
          stepKey: 'diag-model-problem',
          type: 'ai-moment',
          promptKey: 'diagnosis-1',
          skipThinking: true,
        },

        // Diagnosis 2: The reframe (bigger pattern)
        {
          stepKey: 'diag-reframe',
          type: 'ai-moment',
          promptKey: 'diagnosis-2',
          skipThinking: true,
        },

        // Diagnosis 3: Setup for path + future pace
        {
          stepKey: 'diag-future-pace',
          type: 'ai-moment',
          promptKey: 'diagnosis-3',
          skipThinking: true,
        },

        // Q4: Vision - what would change
        {
          stepKey: 'q4-vision',
          type: 'question',
          questionType: 'long-answer',
          question: "Imagine this works. You're making $15K-$25K a month six months from now.\n\nWhat would actually change in your life?",
          placeholder: 'What would be different...',
          stateKey: 'vision.whatChanges',
        },

        // Q5: Why now
        {
          stepKey: 'q5-why-now',
          type: 'question',
          questionType: 'long-answer',
          question: "You've seen opportunities before. You've scrolled past 100s of ads.\n\nBut you're still here.\n\nWhy today? What's actually going on that made you stop and pay attention to this?",
          placeholder: 'Be real about what brought you here...',
          stateKey: 'vision.whyNow',
        },

        // Q6: Commitment
        {
          stepKey: 'q6-commitment',
          type: 'question',
          questionType: 'multiple-choice',
          question: "This is NOT a side project.\n\nThis is building a real business. It takes real commitment. Real focus. Real work.\n\nAre you ready for that?",
          options: [
            { value: 'yes', label: "Yes, I'm ready" },
            { value: 'not-ready', label: 'Not yet' },
          ],
          stateKey: 'commitment.ready',
          exitCondition: {
            values: ['not-ready'],
            headline: "That's honest",
            message: "Most people aren't ready. And there's no shame in that.\n\nBuilding something real takes everything you've got. If you're not there yet, you're not there yet.\n\nWhen you are ready—really ready—come back. The opportunity isn't going anywhere.",
          },
        },

        // Q7: Investment capital
        {
          stepKey: 'q7-capital',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Building a real business takes capital. The more you have, the faster you can move.\n\nHow much do you have available to invest in building this?",
          options: [
            { value: 'under-1k', label: 'Less than $1K' },
            { value: '1k-5k', label: '$1K - $5K' },
            { value: '5k-10k', label: '$5K - $10K' },
            { value: '10k-25k', label: '$10K - $25K' },
            { value: '25k-plus', label: '$25K+' },
          ],
          stateKey: 'commitment.capital',
          exitCondition: {
            values: ['under-1k'],
            headline: 'Not quite yet',
            message: "Every real business takes startup capital. Under $1K makes it nearly impossible to move fast enough.\n\nThis isn't about gatekeeping. It's about setting you up to actually succeed.\n\nWhen you've got at least $1K-$5K to invest in building this properly, come back. The model will still be here.",
          },
        },

        // Path Reveal: The opportunity explained
        {
          stepKey: 'path-reveal',
          type: 'ai-moment',
          promptKey: 'path-reveal',
          skipThinking: true,
        },

        // Fit Assessment: Stack the offer + conditional booking
        {
          stepKey: 'fit-assessment',
          type: 'ai-moment',
          promptKey: 'fit-assessment',
          skipThinking: true,
        },
      ],
    },
  ],
}
