import type { FlowDefinition } from './types'

export const blackboxFlow: FlowDefinition = {
  id: 'blackbox',
  accentColor: '#EF4444',

  mentor: {
    name: 'Blackbox AI',
    handle: '@blackbox',
    avatar: '/blackbox-avatar.png',
    welcome: {
      headline: 'JOIN THE VIP LIST',
      subheadline: 'Get early access to hidden opportunities before they are made public to your phone',
      buttonText: 'Join Now',
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
    'user.name': 'user.name',
    'user.email': 'user.email',
    'user.phone': 'user.phone',
    'assessment.currentWork': 'assessment.currentWork',
    'assessment.goal': 'assessment.goal',
    'assessment.obstacles': 'assessment.obstacles',
    'assessment.ageConfirm': 'assessment.ageConfirm',
  },

  phases: [
    {
      id: 1,
      name: 'VIP Signup',
      steps: [
        // CONTACT GATE: Name, Email, Phone
        {
          stepKey: 'contact-gate',
          type: 'question',
          questionType: 'contact-info',
          headline: 'JOIN THE VIP LIST',
          subheadline: 'Get early access to hidden opportunities before they are made public to your phone',
          question: 'Where should I send the hidden opportunities?',
          fields: [
            { key: 'name', label: 'Name', type: 'text', placeholder: 'Your name', autoComplete: 'name' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', autoComplete: 'email' },
            { key: 'phone', label: 'Phone', type: 'tel', placeholder: '(555) 123-4567', autoComplete: 'tel' },
          ],
          stateKey: 'user',
          noBackButton: true,
        },

        // Q1: Current Work
        {
          stepKey: 'q1-current-work',
          type: 'question',
          questionType: 'open-ended',
          question: 'Level Up Your Career...\n\nWhat do you currently do for work?',
          placeholder: 'Tell us about your current role or occupation...',
          stateKey: 'assessment.currentWork',
        },

        // Q2: Goal
        {
          stepKey: 'q2-goal',
          type: 'question',
          questionType: 'open-ended',
          question: 'Set A Goal...\n\nWhat do you want to accomplish with us?',
          placeholder: 'Share your goals and aspirations...',
          stateKey: 'assessment.goal',
        },

        // Q3: Obstacles
        {
          stepKey: 'q3-obstacles',
          type: 'question',
          questionType: 'open-ended',
          question: "Overcome Your Obstacles...\n\nWhat's the biggest thing holding you back from accomplishing your goals?",
          placeholder: 'Be honest about what challenges you face...',
          stateKey: 'assessment.obstacles',
        },

        // Q4: Age Confirmation
        {
          stepKey: 'q4-age',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'Are you 18+ or older?',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
          stateKey: 'assessment.ageConfirm',
        },

        // Calendly Booking
        {
          stepKey: 'booking',
          type: 'sales-page',
          variant: 'calendly',
          headline: 'Book Your 1 on 1 Onboarding Call With Your Coach',
          copyAboveVideo: '',
          copyBelowVideo: '',
          calendlyUrl: 'https://calendly.com/brady-mentorfy/30min',
          hideFooter: true,
        },
      ],
    },
  ],
}
