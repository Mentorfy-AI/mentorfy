export const phases = [
  {
    id: 1,
    name: "The Diagnosis",
    description: "Understanding where you really are",
    purpose: "Get honest about their situation. Make them feel seen.",

    steps: [
      {
        type: "question",
        questionType: "multiple-choice",
        question: "What stage is your tattoo business at now?",
        options: [
          { value: "booked-3-months", label: "Fully booked out 3+ months" },
          { value: "booked-1-2-months", label: "Booked out 1-2 months" },
          { value: "booked-1-month", label: "Booked out 1 month" },
          { value: "booked-1-2-weeks", label: "Booked out 1-2 weeks" },
          { value: "inconsistent", label: "Bookings are inconsistent" }
        ],
        stateKey: "situation.bookingStatus"
      },
      {
        type: "question",
        questionType: "multiple-choice",
        question: "What's your day rate?",
        options: [
          { value: "4k-plus", label: "$4k+" },
          { value: "3k-4k", label: "$3k - $4k" },
          { value: "2k-3k", label: "$2k - $3k" },
          { value: "1k-2k", label: "$1k - $2k" },
          { value: "500-1k", label: "$500 - $1k" },
          { value: "under-500", label: "Under $500" }
        ],
        stateKey: "situation.dayRate"
      },
      {
        type: "question",
        questionType: "multiple-choice",
        question: "Where do you want to be in 3-6 months?",
        options: [
          { value: "30-50k-months", label: "Hitting $30k-$50k months consistently" },
          { value: "booked-1-2-months", label: "Booked out 1-2 months in advance" },
          { value: "no-empty-days", label: "No more empty chair days" },
          { value: "full-rate-clients", label: "Attracting clients who pay my full rate" },
          { value: "brand-building", label: "Building a brand that brings clients to me" }
        ],
        stateKey: "situation.goal"
      },
      {
        type: "question",
        questionType: "multiple-choice",
        question: "What's stopping you from being there now?",
        options: [
          { value: "unpredictable-posting", label: "I've been posting but my results are unpredictable" },
          { value: "price-shoppers", label: "I'm getting DMs but they're all price shoppers who can't afford me" },
          { value: "no-time", label: "I don't have time because I'm tattooing all day" },
          { value: "unknown-ideal-client", label: "I don't actually know who my ideal client is" },
          { value: "invisible", label: "My work is good enough but I'm just invisible" }
        ],
        stateKey: "situation.blocker"
      },
      {
        type: "question",
        questionType: "contact-info",
        question: "What's your contact information so I can save this for ya?",
        fields: [
          { key: "name", label: "Name", type: "text", placeholder: "Your name", autoComplete: "name" },
          { key: "email", label: "Email", type: "email", placeholder: "your@email.com", autoComplete: "email" },
          { key: "phone", label: "Phone Number", type: "tel", placeholder: "(555) 123-4567", autoComplete: "tel" }
        ],
        stateKey: "user"
      },
      {
        type: "question",
        questionType: "long-answer",
        question: "Be honest with me: when you see other artists booked out 6+ months with $5k-$10k sessions... what do you tell yourself about why that's not you yet?",
        placeholder: "There's no wrong answer here. Just be real with me...",
        stateKey: "situation.honestAnswer"
      },
      {
        type: "ai-moment",
        promptKey: "level-1-diagnosis"
      },
      {
        type: "video",
        videoKey: "level-1-intro",
        introText: `What I'm about to show you changed everything for me.

This is the exact framework I used to go from inconsistent bookings to fully booked out all year — with clients who pay premium rates and never negotiate.

Watch this. Then we'll talk about what it means for your specific situation.`
      },
      {
        type: "sales-page",
        videoKey: "level-1-intro",
        checkoutPlanId: "plan_joNwbFAIES0hH"
      }
    ],

    completionMessage: "Level 1 complete. You've got clarity on where you are. Now let's fix your pricing."
  },

  {
    id: 2,
    name: "Premium Pricing",
    description: "How to set prices that attract better clients",
    purpose: "Shift their pricing psychology. Give them a new framework.",

    introVideo: "level-2-intro",

    steps: [
      {
        type: "question",
        questionType: "multiple-choice",
        question: "When a potential client asks your rate, how do you feel?",
        options: [
          { value: "confident", label: "Confident — I know my worth" },
          { value: "nervous", label: "Nervous — I worry they'll think it's too high" },
          { value: "apologetic", label: "Apologetic — I often explain or justify" },
          { value: "avoidant", label: "Avoidant — I try to delay the conversation" }
        ],
        stateKey: "level2.pricingFeeling"
      },
      {
        type: "question",
        questionType: "multiple-choice",
        question: "Have you raised your prices in the last 6 months?",
        options: [
          { value: "yes-confident", label: "Yes, and it went well" },
          { value: "yes-scared", label: "Yes, but I was terrified" },
          { value: "no-scared", label: "No — I've been too scared" },
          { value: "no-unnecessary", label: "No — I don't think I need to" }
        ],
        stateKey: "level2.raisedPrices"
      },
      {
        type: "question",
        questionType: "long-answer",
        question: "What's the story you tell yourself about why you can't charge more?",
        placeholder: "We all have one. 'My market is different,' 'I'm not good enough yet,' 'People around here won't pay that...'",
        stateKey: "level2.pricingStory"
      },
      {
        type: "ai-moment",
        promptKey: "level-2-diagnosis"
      },
      {
        type: "video",
        videoKey: "level-2-teaching"
      },
      {
        type: "sales-page",
        variant: "calendly",
        calendlyUrl: "https://calendly.com/brady-mentorfy/30min",
        videoKey: "level-2-teaching"
      }
    ],

    completionMessage: "Level 2 complete. You've got a new pricing framework. Now let's talk about why people actually buy."
  },

  {
    id: 3,
    name: "Sales Psychology",
    description: "Why people actually buy, and how to make saying yes feel easy",
    purpose: "Remove the 'ick' from selling. Show them sales is service.",

    introVideo: "level-3-intro",

    steps: [
      {
        type: "question",
        questionType: "multiple-choice",
        question: "How do you feel about 'selling' your work?",
        options: [
          { value: "natural", label: "It feels natural — I'm just sharing what I do" },
          { value: "uncomfortable", label: "Uncomfortable — I feel pushy" },
          { value: "hate", label: "I hate it — I just want to tattoo" },
          { value: "avoid", label: "I avoid it — I wait for people to come to me" }
        ],
        stateKey: "level3.sellingFeeling"
      },
      {
        type: "question",
        questionType: "long-answer",
        question: "Describe your last sales conversation that didn't convert. What happened?",
        placeholder: "Walk me through it. What did they say? What did you say? Where did it fall apart?",
        stateKey: "level3.lostSale"
      },
      {
        type: "ai-moment",
        promptKey: "level-3-diagnosis"
      },
      {
        type: "video",
        videoKey: "level-3-teaching"
      },
      {
        type: "ai-moment",
        promptKey: "level-3-action"
      }
    ],

    completionMessage: "Level 3 complete. Sales isn't sleazy when you do it right. Now let's build your system."
  }
]
