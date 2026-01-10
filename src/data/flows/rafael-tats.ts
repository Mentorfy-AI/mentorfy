import type { FlowDefinition } from './types'

export const rafaelTatsFlow: FlowDefinition = {
  id: 'rafael-tats',

  mentor: {
    name: 'Rafael Tats',
    handle: '@rafaeltats',
    avatar: '/rafael.jpg',
    welcome: {
      headline: "Steal The Method That Seems Invisible To YOU But Keeps Me Booked Out All Year With $2k-$10k Sessions...",
      subheadline: 'Without Spending More Than 30 Minutes A Day On Content',
      buttonText: 'Start Your Diagnosis',
      videoUrl: 'https://rafaeltats.wistia.com/medias/4i06zkj7fg',
      socialProof: 'Trusted by 500+ tattoo artists',
    },
  },

  agents: {
    chat: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, temperature: 0.7 },
    diagnosis: { model: 'claude-haiku-4-5-20251001', maxTokens: 2048 },
    summary: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024 },
  },

  embeds: {
    checkoutPlanId: 'plan_joNwbFAIES0hH',
    calendlyUrl: 'https://calendly.com/brady-mentorfy/30min',
    bookingAfterPhase: 4,
  },

  // Maps raw session state keys to sanitized keys for AI agents
  contextMapping: {
    // Business status from situation
    'businessStatus.bookingStatus': 'situation.bookingStatus',
    'businessStatus.dayRate': 'situation.dayRate',
    'businessStatus.mainBlocker': 'situation.blocker',
    'businessStatus.selfReflection': 'situation.confession',
    // Content strategy from phase2 + phase3
    'contentStrategy.primaryMetric': 'phase2.checkFirst',
    'contentStrategy.followerGoalMindset': 'phase2.hundredKFollowers',
    'contentStrategy.successDefinition': 'phase2.postWorked',
    'contentStrategy.viewsReflection': 'phase2.viewsReflection',
    'contentStrategy.weeklyTimeInvested': 'phase3.timeOnContent',
    'contentStrategy.biggestChallenge': 'phase3.hardestPart',
    'contentStrategy.creatorIdentity': 'phase3.contentCreatorIdentity',
    'contentStrategy.timeGoals': 'phase3.extraTime',
    // Pricing mindset from phase4
    'pricingMindset.lastPriceIncrease': 'phase4.lastPriceRaise',
    'pricingMindset.objectionResponse': 'phase4.tooExpensiveResponse',
    'pricingMindset.mainFear': 'phase4.pricingFear',
    'pricingMindset.revenueGoals': 'phase4.doubleRevenue',
  },

  phases: [
    {
      id: 1,
      name: 'The Diagnosis',
      steps: [
        {
          stepKey: 'q1-booking-status',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'What stage is your tattoo business at now?',
          options: [
            { value: 'booked-3-months', label: 'Fully booked out 3+ months' },
            { value: 'booked-1-2-months', label: 'Booked out 1-2 months' },
            { value: 'booked-1-month', label: 'Booked out about 1 month' },
            { value: 'booked-1-2-weeks', label: 'Booked out 1-2 weeks' },
            { value: 'inconsistent', label: 'Bookings are inconsistent' },
          ],
          stateKey: 'situation.bookingStatus',
        },
        {
          stepKey: 'q2-day-rate',
          type: 'question',
          questionType: 'multiple-choice',
          question: "What's your day rate?",
          options: [
            { value: '4k-plus', label: '$4k+' },
            { value: '3k-4k', label: '$3k - $4k' },
            { value: '2k-3k', label: '$2k - $3k' },
            { value: '1k-2k', label: '$1k - $2k' },
            { value: '500-1k', label: '$500 - $1k' },
            { value: 'under-500', label: 'Under $500' },
          ],
          stateKey: 'situation.dayRate',
        },
        {
          stepKey: 'q3-blocker',
          type: 'question',
          questionType: 'multiple-choice',
          question: "What's stopping you from being booked out?",
          options: [
            { value: 'unpredictable-posting', label: 'Posting but results are unpredictable' },
            { value: 'price-shoppers', label: 'DMs are all price shoppers' },
            { value: 'no-time', label: 'No time — tattooing all day' },
            { value: 'invisible', label: 'Good work but invisible' },
          ],
          stateKey: 'situation.blocker',
        },
        {
          stepKey: 'q4-contact-info',
          type: 'question',
          questionType: 'contact-info',
          question: "What's your contact info?",
          fields: [
            { key: 'name', label: 'Name', type: 'text', placeholder: 'Your name', autoComplete: 'name' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', autoComplete: 'email' },
            { key: 'phone', label: 'Phone', type: 'tel', placeholder: '(555) 123-4567', autoComplete: 'tel' },
          ],
          stateKey: 'user',
        },
        {
          stepKey: 'q5-confession',
          type: 'question',
          questionType: 'long-answer',
          question: "Be honest: why aren't you booked out yet?",
          placeholder: 'No wrong answer...',
          stateKey: 'situation.confession',
        },
        {
          stepKey: 'ai-phase1-relief',
          type: 'ai-moment',
          promptKey: 'phase-1-relief',
          skipThinking: true,
        },
      ],
    },
    {
      id: 2,
      name: 'Get Booked Without Going Viral',
      steps: [
        {
          stepKey: 'q6-check-first',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'What do you check first after posting?',
          options: [
            { value: 'views-likes', label: 'Views and likes' },
            { value: 'follower-count', label: 'Follower count' },
            { value: 'comments-dms', label: 'Comments and DMs' },
            { value: 'saves-shares', label: 'Saves and shares' },
          ],
          stateKey: 'phase2.checkFirst',
        },
        {
          stepKey: 'q7-hundred-k',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'If you had 100k followers, what would change?',
          options: [
            { value: 'consistent-bookings', label: 'Finally be consistently booked' },
            { value: 'charge-more', label: 'Charge more' },
            { value: 'not-much', label: 'Probably not much' },
            { value: 'made-it', label: 'Feel like I made it' },
          ],
          stateKey: 'phase2.hundredKFollowers',
        },
        {
          stepKey: 'q8-post-worked',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'When does a post feel like it worked?',
          options: [
            { value: '10k-views', label: 'Gets over 10k views' },
            { value: 'lots-comments', label: 'Gets lots of comments' },
            { value: 'booking-dm', label: 'Someone DMs about booking' },
            { value: 'nothing-consistent', label: 'Nothing feels consistent' },
          ],
          stateKey: 'phase2.postWorked',
        },
        {
          stepKey: 'q9-views-reflection',
          type: 'question',
          questionType: 'long-answer',
          question: "What would change if views didn't matter?",
          placeholder: 'Think about it...',
          stateKey: 'phase2.viewsReflection',
        },
        {
          stepKey: 'ai-phase2-relief',
          type: 'ai-moment',
          promptKey: 'phase-2-relief',
          skipThinking: true,
        },
      ],
    },
    {
      id: 3,
      name: 'The 30-Minute Content System',
      steps: [
        {
          stepKey: 'q10-time-on-content',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'How much time on content each week?',
          options: [
            { value: 'almost-none', label: 'Almost none' },
            { value: '1-2-hours', label: '1-2 hours' },
            { value: '3-5-hours', label: '3-5 hours' },
            { value: '5-plus-hours', label: '5+ hours' },
          ],
          stateKey: 'phase3.timeOnContent',
        },
        {
          stepKey: 'q11-hardest-part',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'Hardest part about content?',
          options: [
            { value: 'dont-know-what', label: "Don't know what to post" },
            { value: 'no-time', label: 'No time' },
            { value: 'awkward-camera', label: 'Awkward on camera' },
            { value: 'no-conversion', label: 'Nothing converts' },
          ],
          stateKey: 'phase3.hardestPart',
        },
        {
          stepKey: 'q12-creator-identity',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'Do you see yourself as a content creator?',
          options: [
            { value: 'not-really', label: "No, I'm an artist" },
            { value: 'kind-of', label: 'Kind of' },
            { value: 'accepted', label: 'Yeah, part of the game' },
            { value: 'never-thought', label: 'Never thought about it' },
          ],
          stateKey: 'phase3.contentCreatorIdentity',
        },
        {
          stepKey: 'q13-extra-time',
          type: 'question',
          questionType: 'long-answer',
          question: 'What would you do with 5 extra hours a week?',
          placeholder: 'Be specific...',
          stateKey: 'phase3.extraTime',
        },
        {
          stepKey: 'ai-phase3-relief',
          type: 'ai-moment',
          promptKey: 'phase-3-relief',
          skipThinking: true,
        },
      ],
    },
    {
      id: 4,
      name: 'Double Your Revenue',
      steps: [
        {
          stepKey: 'q14-last-price-raise',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'Last time you raised prices?',
          options: [
            { value: 'within-3-months', label: 'Within 3 months' },
            { value: '6-months', label: '6 months ago' },
            { value: 'over-year', label: 'Over a year' },
            { value: 'never', label: 'Never' },
          ],
          stateKey: 'phase4.lastPriceRaise',
        },
        {
          stepKey: 'q15-too-expensive',
          type: 'question',
          questionType: 'multiple-choice',
          question: "When someone says 'too expensive'?",
          options: [
            { value: 'discount', label: 'Offer a discount' },
            { value: 'explain', label: "Explain why I'm worth it" },
            { value: 'let-walk', label: 'Let them walk' },
            { value: 'panic', label: 'Panic and give in' },
          ],
          stateKey: 'phase4.tooExpensiveResponse',
        },
        {
          stepKey: 'q16-pricing-fear',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'Biggest fear about raising prices?',
          options: [
            { value: 'lose-clients', label: 'Lose clients' },
            { value: 'greedy', label: 'Look greedy' },
            { value: 'not-worth-more', label: 'Not worth more yet' },
            { value: 'no-fear', label: "No fear, just don't know how" },
          ],
          stateKey: 'phase4.pricingFear',
        },
        {
          stepKey: 'q17-double-revenue',
          type: 'question',
          questionType: 'long-answer',
          question: 'What would you do with double the revenue?',
          placeholder: 'Dream big...',
          stateKey: 'phase4.doubleRevenue',
        },
        {
          stepKey: 'ai-phase4-relief',
          type: 'ai-moment',
          promptKey: 'phase-4-relief',
          skipThinking: true,
        },
        {
          stepKey: 'sales-calendly',
          type: 'sales-page',
          variant: 'calendly',
          headline: "You're a great fit for 1-on-1.",
          copyAboveVideo: `Based on everything you've shared, I think you'd benefit from working with me directly.

This isn't for everyone. But you've done the work. You understand the framework. Now you need someone to look at your specific situation and tell you exactly what to do.

That's what these calls are for.`,
          copyBelowVideo: `Here's how it works:

Book a 30-minute call with my team. We'll look at where you are, where you want to be, and whether working together makes sense.

**No pressure.** If it's not the right fit, we'll tell you — and point you in the right direction.

**If it is the right fit**, we'll map out exactly what working together would look like.

This is for artists who are serious about making the jump. If that's you, grab a time:`,
          calendlyUrl: 'https://calendly.com/brady-mentorfy/30min',
        },
      ],
    },
  ],
}
