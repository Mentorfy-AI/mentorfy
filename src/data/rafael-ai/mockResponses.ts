// Shortened responses for testing - will restore full copy later

export const mockResponses: Record<string, any> = {
  // PHASE 1
  "phase-1-relief": (state: any) => {
    const confession = state.situation?.confession || 'something holding you back'
    return `Got it. You said: "${confession}"

That's real. Let's fix it.

Phase 1 done — now we talk about why views don't matter.`
  },

  // PHASE 2
  "phase-2-relief": (state: any) => {
    return `You've been chasing views. Wrong game.

I have students with 3k followers booked out. Students with 100k posting "available next week."

The difference? Trust, not reach.

Phase 2 done — next up: content system.`
  },

  // PHASE 3
  "phase-3-relief": (state: any) => {
    return `Content shouldn't feel like work.

Document, don't create. One day of tattooing = 5 posts.

No TikTok dances. No skits. Just capture what you're already doing.

Phase 3 done — last one: pricing.`
  },

  // PHASE 4
  "phase-4-relief": (state: any) => {
    return `You've been running a charity.

I raised from $1,200 to $4,000. Didn't lose clients — got better ones.

You hold all the cards. Raise your price.

All phases complete. You see the game now.`
  },

  // Legacy compatibility
  "phase-1-belief": () => "Trust > Views. Moving on.",
  "phase-1-action": () => "Ready for the next phase.",
  "phase-2-belief": () => "Relationships convert. Not views.",
  "phase-2-action": () => "Content system is next.",
  "phase-3-belief": () => "Document, don't create.",
  "phase-3-action": () => "Pricing is the final piece.",
  "phase-4-belief": () => "Business, not charity.",
  "phase-4-action": () => "You have the full picture.",
  "final-portrait": () => "Your journey mapped out.",
  "final-bridge": () => "Time to implement.",

  // Chat responses
  "chat": () => ({
    message: "What's on your mind? I'm here to help."
  })
}
