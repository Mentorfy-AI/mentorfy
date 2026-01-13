import type { FlowDefinition } from './types'

export const growthoperatorFlow: FlowDefinition = {
  id: 'growthoperator',

  mentor: {
    name: 'Brady Badour',
    handle: '@growthoperator',
    avatar: '/brady.jpg',
    welcome: {
      callout: "If online business still hasn't worked for you YET...",
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

  webhookUrl: process.env.GROWTHOPERATOR_WEBHOOK_URL,
  webhookFormat: 'slack',

  // Maps session context paths to semantic AI-friendly paths
  // Format: 'outputPath (what AI sees)': 'inputPath (where to read from context)'
  contextMapping: {
    // Q1-Q5: Business history
    'business.modelTried': 'assessment.modelTried',
    'business.modelsCount': 'assessment.modelsCount',
    'motivation.original': 'assessment.originalMotivation',
    'progress.bestResult': 'assessment.bestResult',
    'progress.whatHappened': 'assessment.whatHappened',
    // Q6-Q8: Investment
    'journey.duration': 'assessment.duration',
    'investment.money': 'assessment.moneyInvested',
    'investment.cost': 'assessment.deeperCost',
    // Q9-Q11: Education & belief
    'education.source': 'assessment.educationSource',
    'education.teacherMoney': 'assessment.teacherMoney',
    'belief.whyFailed': 'assessment.beliefWhyFailed',
    // Q12-Q14: Emotional state
    'emotion.current': 'assessment.emotionalState',
    'emotion.shame': 'assessment.shame',
    'resilience.whyGoing': 'assessment.whyKeepGoing',
    // Q15-Q17: Vision & urgency
    'vision.whatChanges': 'assessment.whatWouldChange',
    'urgency.level': 'assessment.urgency',
    'fear.biggest': 'assessment.biggestFear',
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
        // Q1: What business model have you tried?
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

        // Q2: How many models committed to?
        {
          stepKey: 'q2-models-count',
          type: 'question',
          questionType: 'multiple-choice',
          question: "How many different business models have you actually committed to?",
          options: [
            { value: '1', label: 'Just 1 so far' },
            { value: '2-3', label: '2 to 3 different things' },
            { value: '4-5', label: '4 to 5 different things' },
            { value: '5+', label: "More than 5... I've tried a lot" },
          ],
          stateKey: 'assessment.modelsCount',
        },

        // Q3: Original motivation
        {
          stepKey: 'q3-motivation',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Why did you get into online business in the first place?",
          options: [
            { value: 'freedom', label: 'I wanted freedom and flexibility' },
            { value: 'money', label: 'I wanted to make more money than a job would ever pay' },
            { value: 'ownership', label: 'I wanted to build something that was actually mine' },
            { value: 'escape', label: 'I wanted to escape the 9-5 completely' },
            { value: 'prove', label: 'I wanted to prove to myself I could do it' },
            { value: 'others', label: 'I saw other people living that life and wanted it too' },
          ],
          stateKey: 'assessment.originalMotivation',
        },

        // Q4: Best result
        {
          stepKey: 'q4-best-result',
          type: 'question',
          questionType: 'multiple-choice',
          question: "How far did you get with your BEST attempt?",
          options: [
            { value: 'never-started', label: 'Never really got it off the ground' },
            { value: 'started-no-money', label: 'Got started but never made real money' },
            { value: 'some-money', label: "Made some money but couldn't keep it going" },
            { value: '1k-5k', label: 'Made $1K to $5K months but plateaued or stopped' },
            { value: '5k-10k', label: 'Made $5K to $10K months but burned out' },
            { value: '10k+', label: 'Made $10K+ months but something still went wrong' },
          ],
          stateKey: 'assessment.bestResult',
        },

        // Q5: What happened
        {
          stepKey: 'q5-what-happened',
          type: 'question',
          questionType: 'multiple-choice',
          question: "What actually happened?",
          options: [
            { value: 'no-traction', label: "I couldn't get traction no matter what I tried" },
            { value: 'couldnt-scale', label: "I got some traction but couldn't figure out how to scale" },
            { value: 'too-many-hours', label: 'I was making money but working way too many hours' },
            { value: 'saturated', label: 'The market got too competitive or saturated' },
            { value: 'ran-out-money', label: 'I ran out of money before it could take off' },
            { value: 'life', label: 'Life circumstances forced me to stop' },
            { value: 'lost-motivation', label: "I just lost motivation and couldn't keep pushing" },
            { value: 'not-sure', label: "I'm not actually sure what went wrong" },
          ],
          stateKey: 'assessment.whatHappened',
        },

        // Q6: Duration
        {
          stepKey: 'q6-duration',
          type: 'question',
          questionType: 'multiple-choice',
          question: "How long have you been trying to make online business work?",
          options: [
            { value: '<6mo', label: 'Less than 6 months' },
            { value: '6mo-1yr', label: '6 months to 1 year' },
            { value: '1-2yr', label: '1 to 2 years' },
            { value: '2-3yr', label: '2 to 3 years' },
            { value: '3-5yr', label: '3 to 5 years' },
            { value: '5yr+', label: 'More than 5 years' },
          ],
          stateKey: 'assessment.duration',
        },

        // Q7: Money invested
        {
          stepKey: 'q7-money-invested',
          type: 'question',
          questionType: 'multiple-choice',
          question: "How much money have you invested in courses, coaching, and tools?",
          options: [
            { value: '<500', label: 'Less than $500' },
            { value: '500-2k', label: '$500 to $2,000' },
            { value: '2k-5k', label: '$2,000 to $5,000' },
            { value: '5k-10k', label: '$5,000 to $10,000' },
            { value: '10k-25k', label: '$10,000 to $25,000' },
            { value: '25k+', label: 'More than $25,000' },
          ],
          stateKey: 'assessment.moneyInvested',
        },

        // Q8: Deeper cost
        {
          stepKey: 'q8-deeper-cost',
          type: 'question',
          questionType: 'multiple-choice',
          question: "What has this cost you beyond money?",
          options: [
            { value: 'time', label: "Time I'll never get back" },
            { value: 'confidence', label: 'Confidence in myself' },
            { value: 'relationships', label: 'Relationships or strain with people close to me' },
            { value: 'opportunities', label: 'Other opportunities I passed up' },
            { value: 'peace', label: 'My peace of mind' },
            { value: 'all', label: 'All of the above' },
          ],
          stateKey: 'assessment.deeperCost',
        },

        // Q9: Education source
        {
          stepKey: 'q9-education',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Where did you learn most of what you know about online business?",
          options: [
            { value: 'free', label: 'Free content (YouTube, podcasts, social media)' },
            { value: 'course', label: 'A course I bought' },
            { value: 'coaching', label: 'A coaching program or mastermind I joined' },
            { value: 'mix', label: 'A mix of courses and programs' },
            { value: 'self', label: 'I mostly figured it out myself' },
          ],
          stateKey: 'assessment.educationSource',
        },

        // Q10: How teachers made money
        {
          stepKey: 'q10-teacher-money',
          type: 'question',
          questionType: 'multiple-choice',
          question: "The people who taught you... how did THEY make most of their money?",
          options: [
            { value: 'teaching', label: 'Teaching the thing... not doing it' },
            { value: 'doing', label: 'Actually doing the thing successfully' },
            { value: 'both', label: 'Both teaching and doing' },
            { value: 'never-thought', label: 'I never really thought about it' },
            { value: 'self-taught', label: "I taught myself, so this doesn't apply" },
          ],
          stateKey: 'assessment.teacherMoney',
        },

        // Q11: Belief about failure
        {
          stepKey: 'q11-belief',
          type: 'question',
          questionType: 'multiple-choice',
          question: "What do YOU think was the real reason it hasn't worked?",
          options: [
            { value: 'execution', label: "I didn't execute well enough" },
            { value: 'time', label: "I didn't have enough time to fully commit" },
            { value: 'money', label: "I didn't have enough money to do it right" },
            { value: 'saturated', label: 'The model I chose was too competitive' },
            { value: 'wrong-model', label: 'I picked the wrong business model for me' },
            { value: 'bad-info', label: "The information I got wasn't good enough" },
            { value: 'dont-know', label: "I honestly don't know" },
          ],
          stateKey: 'assessment.beliefWhyFailed',
        },

        // Q12: Current emotional state
        {
          stepKey: 'q12-emotional-state',
          type: 'question',
          questionType: 'multiple-choice',
          question: 'How do you feel about "online business opportunities" at this point?',
          options: [
            { value: 'skeptical', label: "Extremely skeptical... I've seen too much bullshit" },
            { value: 'frustrated', label: "Frustrated... nothing has actually worked" },
            { value: 'cautious', label: 'Cautiously open... maybe something real exists' },
            { value: 'exhausted', label: 'Exhausted but still not ready to quit' },
            { value: 'logical', label: 'Just want something that actually makes sense' },
          ],
          stateKey: 'assessment.emotionalState',
        },

        // Q13: Shame
        {
          stepKey: 'q13-shame',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Be honest... has this journey made you feel embarrassed or ashamed?",
          options: [
            { value: 'money-shame', label: "Yes... I've spent money and time with nothing to show for it" },
            { value: 'social-shame', label: 'Yes... I\'ve told people I\'m "working on something" for too long' },
            { value: 'self-shame', label: "Yes... I feel like I should have figured this out by now" },
            { value: 'little', label: "A little... but I try not to think about it" },
            { value: 'no', label: "Not really... I see it all as part of the process" },
          ],
          stateKey: 'assessment.shame',
        },

        // Q14: What kept you going
        {
          stepKey: 'q14-keep-going',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Despite everything... what's kept you going?",
          options: [
            { value: 'seen-others', label: "I've seen others succeed... I know it's possible" },
            { value: 'refuse-normal', label: 'I refuse to go back to a "normal" path' },
            { value: 'no-backup', label: "I don't have a backup plan... I need this to work" },
            { value: 'believe', label: "I genuinely believe I'll figure it out eventually" },
            { value: 'cant-let-go', label: "I can't explain it... I just can't let it go" },
          ],
          stateKey: 'assessment.whyKeepGoing',
        },

        // Q15: What would change
        {
          stepKey: 'q15-vision',
          type: 'question',
          questionType: 'multiple-choice',
          question: "If this actually worked... what would change in your life first?",
          options: [
            { value: 'quit-job', label: "I'd quit my job" },
            { value: 'stop-stress', label: "I'd stop stressing about money constantly" },
            { value: 'made-it', label: "I'd finally feel like I made it" },
            { value: 'freedom', label: "I'd have actual freedom to live how I want" },
            { value: 'take-care', label: "I'd be able to take care of the people I love" },
            { value: 'everything', label: 'Everything would change' },
          ],
          stateKey: 'assessment.whatWouldChange',
        },

        // Q16: Urgency
        {
          stepKey: 'q16-urgency',
          type: 'question',
          questionType: 'multiple-choice',
          question: "How urgent is this for you?",
          options: [
            { value: 'patient', label: "I'm patient... I just want to find the right thing" },
            { value: '6mo', label: "I'd like to see real progress in the next 6 months" },
            { value: 'this-year', label: 'I need something to work this year' },
            { value: 'urgent', label: "It's urgent... I'm running low on time or money" },
            { value: 'ready-now', label: "No specific timeline, but I'm ready to move now" },
          ],
          stateKey: 'assessment.urgency',
        },

        // Q17: Biggest fear
        {
          stepKey: 'q17-fear',
          type: 'question',
          questionType: 'multiple-choice',
          question: "What's your biggest fear about all of this?",
          options: [
            { value: 'stuck', label: "That I'll still be stuck in the same place a year from now" },
            { value: 'waste-money', label: "That I'll waste more money on something that doesn't work" },
            { value: 'everyone-else', label: 'That everyone else will figure it out except me' },
            { value: 'give-up', label: "That I'll eventually have to give up on this dream" },
            { value: 'not-cut-out', label: "That maybe I'm just not cut out for this" },
          ],
          stateKey: 'assessment.biggestFear',
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
          minDuration: 12000, // 12 seconds minimum
          noBackButton: true,
        },

        // DIAGNOSIS SEQUENCE (8 screens handled by DiagnosisSequenceFlow)
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
