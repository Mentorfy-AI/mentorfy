import type { FlowDefinition } from './types'

export const growthoperatorFlow: FlowDefinition = {
  id: 'growthoperator',

  mentor: {
    name: 'Brady Badour',
    handle: '@growthoperator',
    avatar: '/brady.jpg',
    welcome: {
      callout: "If you're an agency owner whos {{green:burnt out}} from competing in a saturated market",
      headline: "I'll Show You How {{green:1000s}} Are Partnering With Creators To Scale\n{{green:\"AI Education Companies\"}} While\nStaying Behind The Scenes",
      closingCallout: "...Without Ever Begging For New Clients Again",
      buttonText: 'Start Assessment',
      disclaimer: "Warning: This experience adapts based on your answers. Answer honestly... your diagnosis depends on it.",
    },
    videos: {
      'video-1-frame': { url: 'https://kile.wistia.com/medias/xr4873j8ps' },
      'video-2-reveal': { url: 'https://kile.wistia.com/medias/xr4873j8ps' },
    },
  },

  agents: {
    chat: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, temperature: 0.7 },
    diagnosis: { model: 'claude-opus-4-5-20251101', maxTokens: 8192 },
    summary: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024 },
  },

  embeds: {
    calendlyUrl: 'https://calendly.com/brady-mentorfy/30min',
  },

  webhookUrl: process.env.GROWTHOPERATOR_WEBHOOK_URL,
  webhookFormat: 'slack',

  // Maps session context paths to semantic AI-friendly paths for diagnosis
  // Format: { outputPath: inputPath } - AI receives data at outputPath
  contextMapping: {
    // V3 Questions
    'assessment.timeInGame': 'assessment.timeInGame',
    'assessment.skillLevel': 'assessment.skillLevel',
    'assessment.goal': 'assessment.goal',
    'assessment.currentReality': 'assessment.currentReality',
    'assessment.whatTried': 'assessment.whatTried',
    'assessment.dailyReality': 'assessment.dailyReality',
    'assessment.performanceGap': 'assessment.performanceGap',
    'assessment.fear': 'assessment.fear',
    'assessment.identityFriction': 'assessment.identityFriction',
    'assessment.confession': 'assessment.confession',
    // Contact
    'user.name': 'user.name',
    'user.email': 'user.email',
    'user.phone': 'user.phone',
  },

  phases: [
    {
      id: 1,
      name: 'Assessment',
      steps: [
        // ============================================================
        // Q1-Q4: QUALIFICATION QUESTIONS
        // ============================================================

        // Q1: Time in the Game
        {
          stepKey: 'q1-time',
          type: 'question',
          questionType: 'multiple-choice',
          question: "But first, I need to know who I'm speaking to… how long have you been in the game for?",
          options: [
            { value: '5plus', label: "Longer than most — 5+ years" },
            { value: '3-5', label: "It's been a while — 3 to 5 years" },
            { value: '1-3', label: "Relatively new — 1 to 3 years" },
            { value: '6mo-1yr', label: "Just started — 6 months to 1 year" },
            { value: 'brand-new', label: "Brand new — not the right fit yet" },
          ],
          stateKey: 'assessment.timeInGame',
          sectionLabel: 'Your Situation',
          sectionIndex: 0,
        },

        // Q2: Skill Level
        {
          stepKey: 'q2-skills',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Okay cool, so you've got some experience. How would you describe your skill level?",
          options: [
            { value: 'wizard', label: "Wizard — I've generated well over $1M in business revenue throughout my career" },
            { value: 'advanced', label: "Advanced — I've got skills that have generated $250K-$1M in business revenue" },
            { value: 'professional', label: "Professional — I've had a massive impact on the businesses I've worked with" },
            { value: 'intermediate', label: "Intermediate — I definitely have a valuable skillset" },
            { value: 'rookie', label: "Rookie — I'm skill stacking right now" },
            { value: 'beginner', label: "Just getting started — I should probably get some experience first" },
          ],
          stateKey: 'assessment.skillLevel',
          sectionLabel: 'Your Situation',
          sectionIndex: 0,
        },

        // Q3: The Goal
        {
          stepKey: 'q3-goal',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Great, now I have a better idea of where you're at. But tell me what kind of person you are…\n\nWhat's your big goal in business?",
          options: [
            { value: '1m-plus', label: "Over $1M a month — I know it's possible" },
            { value: '500k-1m', label: "$500K - $1M a month — I wanna get here before I go any higher" },
            { value: '100k-500k', label: "$100K - $500K a month — I've gotta touch a six figure month soon" },
            { value: '50k-100k', label: "$50K - $100K a month — I'd be extremely happy if I got here" },
            { value: '10k-50k', label: "$10K - $50K a month — This is achievable for me" },
            { value: '5k-10k', label: "$5K - $10K a month — I need room to breathe" },
          ],
          stateKey: 'assessment.goal',
          sectionLabel: 'Your Situation',
          sectionIndex: 0,
        },

        // Q4: Current Reality
        {
          stepKey: 'q4-current',
          type: 'question',
          questionType: 'multiple-choice',
          question: "So be honest with me… where are you at right now?",
          options: [
            { value: '100k-plus', label: "Above $100K a month — I'm looking for something that can get to the next level" },
            { value: '50k-100k', label: "Between $50K - $100K a month — I need something more consistent" },
            { value: '10k-50k', label: "Around $10K - $50K a month — I've been fluctuating for a while" },
            { value: '5k-10k', label: "Between $5K - $10K a month — I've been struggling to get new business" },
            { value: '1k-5k', label: "Between $1K - $5K a month — I've got something going but it's not consistent yet" },
            { value: 'below-1k', label: "Below $1K a month — I'm still trying to get real traction" },
          ],
          stateKey: 'assessment.currentReality',
          sectionLabel: 'Your Situation',
          sectionIndex: 0,
        },

        // ============================================================
        // CONTACT CAPTURE (After Q4)
        // ============================================================
        {
          stepKey: 'contact-gate',
          type: 'question',
          questionType: 'contact-info',
          question: "Thanks for being honest with me.\n\nI'm about to show you something that'll change how you see your entire situation.\n\nBut I need your contact info first so my team can send this to you when we're done.",
          fields: [
            { key: 'name', label: 'Name', type: 'text', placeholder: 'Your name', autoComplete: 'name' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', autoComplete: 'email' },
            { key: 'phone', label: 'Phone', type: 'tel', placeholder: '(555) 123-4567', autoComplete: 'tel' },
          ],
          stateKey: 'user',
          sectionLabel: 'Your Info',
          sectionIndex: 1,
          noBackButton: true,
        },

        // ============================================================
        // AI REFLECTION #1 (After Contact Capture)
        // ============================================================
        {
          stepKey: 'ai-reflection-1',
          type: 'ai-moment',
          promptKey: 'ai-reflection-1',
          noBackButton: true,
          sectionLabel: 'Going Deeper',
          sectionIndex: 3,
        },

        // ============================================================
        // Q5-Q7: DEEPER QUESTIONS
        // ============================================================

        // Q5: What They've Tried (Multi-select)
        {
          stepKey: 'q5-tried',
          type: 'question',
          questionType: 'multi-select',
          question: "Let's talk about what you've already tried to close that gap.\n\nSelect everything that applies:",
          instruction: "Select all that apply",
          options: [
            { value: 'niched-down', label: 'Niched down to a specific industry or service — told myself "the riches are in the niches"' },
            { value: 'raised-prices', label: 'Raised my prices — convinced myself I just needed to "charge my worth"' },
            { value: 'hired-help', label: "Hired help or built out systems — got more efficient at a business that still wasn't scaling" },
            { value: 'bought-courses', label: "Bought courses or joined coaching programs — learned a lot, implemented little, changed nothing" },
            { value: 'personal-brand', label: "Tried to build a personal brand — felt like shouting into the void" },
            { value: 'worked-longer', label: "Worked longer hours — thought grinding harder was the answer" },
            { value: 'switched-niches', label: "Switched services or niches entirely — same problems, different packaging" },
          ],
          stateKey: 'assessment.whatTried',
          sectionLabel: 'Going Deeper',
          sectionIndex: 3,
        },

        // Q6: The Daily Reality
        {
          stepKey: 'q6-daily',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Now let's talk about what your life actually looks like right now.\n\nWhich one of these hits closest to home?",
          options: [
            { value: 'client-work', label: 'I spend most of my time doing client work — growing the business always gets pushed to "later"' },
            { value: 'no-normal', label: "There's no such thing as a \"normal\" week — I'm constantly reacting, never getting ahead" },
            { value: 'feast-famine', label: "I'm either drowning in work or panicking about where the next client is coming from — no in-between" },
            { value: 'false-freedom', label: 'I technically have "freedom" but I can\'t go an hour without checking my phone' },
            { value: 'more-hours', label: "I work more hours than I ever did at a job — for less money and way more uncertainty" },
            { value: 'moving-target', label: 'I keep telling myself "once I hit [X], things will calm down" — but [X] keeps moving' },
          ],
          stateKey: 'assessment.dailyReality',
          sectionLabel: 'Going Deeper',
          sectionIndex: 3,
        },

        // Q7: The Performance Gap
        {
          stepKey: 'q7-performance',
          type: 'question',
          questionType: 'multiple-choice',
          question: "One more. And I need you to be honest with this one.\n\nWhen someone asks 'how's business going?' — what do you usually SAY versus what's actually TRUE?",
          options: [
            { value: 'same', label: "What I say and what's true are basically the same — things are legitimately going well" },
            { value: 'great-fine', label: 'I say "it\'s going great" but really it\'s just... fine' },
            { value: 'growing-stuck', label: 'I say "we\'re growing" but honestly I\'ve been stuck at the same level for a while' },
            { value: 'keeping-busy', label: 'I say "keeping busy" because I don\'t want to explain that I\'m struggling' },
            { value: 'stopped-talking', label: "I've stopped bringing it up — I don't know what to say anymore and I'm tired of performing" },
          ],
          stateKey: 'assessment.performanceGap',
          sectionLabel: 'Going Deeper',
          sectionIndex: 3,
        },

        // ============================================================
        // AI REFLECTION #2 (After Q7)
        // ============================================================
        {
          stepKey: 'ai-reflection-2',
          type: 'ai-moment',
          promptKey: 'ai-reflection-2',
          noBackButton: true,
          sectionLabel: 'The Pattern',
          sectionIndex: 4,
        },

        // ============================================================
        // Q8-Q10: PERSONAL QUESTIONS
        // ============================================================

        // Q8: The Fear
        {
          stepKey: 'q8-fear',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Be honest with me — what scares you the most right now?",
          options: [
            { value: 'same-place', label: "That I'll still be in this exact same place a year from now — grinding, hoping, nothing actually different" },
            { value: 'wrong-call', label: 'That I made the wrong call leaving the "safe" path — and the people who doubted me were right' },
            { value: 'never-work', label: "That I'm working this hard for something that's never actually going to work" },
            { value: 'burn-out', label: "That I'm going to burn out completely before I ever figure this out" },
            { value: 'others-see', label: "That the people closest to me can see I'm struggling — even when I pretend I'm not" },
            { value: 'wasted-years', label: "That I've already wasted the best years of my twenties building something with no real future" },
          ],
          stateKey: 'assessment.fear',
          sectionLabel: 'The Truth',
          sectionIndex: 5,
        },

        // Q9: The Identity Friction
        {
          stepKey: 'q9-identity',
          type: 'question',
          questionType: 'multiple-choice',
          question: "Which of these do you relate to most right now?",
          options: [
            { value: 'freelancer-website', label: "I call myself an agency owner — but if I'm being honest, I'm really just a freelancer with a website" },
            { value: 'cant-consistent', label: "I've proven I can get results — I just can't seem to make this thing consistent no matter what I try" },
            { value: 'performing', label: "I feel like I'm performing success way more than I'm actually experiencing it" },
            { value: 'work-harder', label: "I work harder than almost anyone I know — and somehow have less to show for it" },
            { value: 'skills-freedom', label: "I've built real skills — but I'm starting to wonder if they'll ever translate into real freedom" },
            { value: 'never-fit', label: "Something about this model has never fully fit me — but I don't know what else I'd do" },
          ],
          stateKey: 'assessment.identityFriction',
          sectionLabel: 'The Truth',
          sectionIndex: 5,
        },

        // Q10: The Confession (Open-ended)
        {
          stepKey: 'q10-confession',
          type: 'question',
          questionType: 'open-ended',
          question: "Last question. And this one matters.\n\nWhat's the thing you don't usually say out loud about where you're at right now?\n\nThe thing you'd only tell someone who really gets it.",
          placeholder: "Take your time with this. What you write here will shape what I show you next.",
          stateKey: 'assessment.confession',
          sectionLabel: 'The Truth',
          sectionIndex: 5,
          noBackButton: true,
        },

        // ============================================================
        // VIDEO + LOADING (Combined)
        // ============================================================
        {
          stepKey: 'loading-diagnosis',
          type: 'loading',
          promptKey: 'diagnosis-v3',
          videoKey: 'video-2-reveal',
          introText: "Alright, I've got everything I need. I'm putting together your diagnosis now. This usually takes about 90 seconds, so watch this while you wait.",
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
            ready: "Alright, it's ready.",
          },
          minDuration: 12000,
          noBackButton: true,
          hideProgressBar: true,
        },

        // ============================================================
        // 5-SCREEN DIAGNOSIS SEQUENCE
        // ============================================================
        {
          stepKey: 'diagnosis-sequence',
          type: 'diagnosis-sequence',
          promptKey: 'diagnosis-v3',
          noBackButton: true,
          hideProgressBar: true,
        },
      ],
    },
  ],
}
