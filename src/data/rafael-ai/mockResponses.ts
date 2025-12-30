import { levels } from './levels'

export const mockResponses: Record<string, any> = {
  "level-1-diagnosis": () => `Here's what I see.

You're not here because you're lazy. You're not here because your work isn't good enough. You're here because you've been playing a game nobody taught you the rules to.

You've been doing what you thought you were supposed to do — posting, grinding, hoping the right people notice. And sometimes they do. But it's inconsistent. Unpredictable. You can't build a life on unpredictable.

The artists who are booked out 6+ months with premium clients? They're not more talented than you. They just figured out something most artists never learn.

And that's exactly what I'm going to show you.`,

  "level-1-action": () => `Now you see the game differently.

Here's what I want you to take from this:

Your work is already good enough. That was never the problem. The problem is visibility — the right people don't know you exist yet.

Over the next few levels, I'm going to show you exactly how to fix that. We'll rebuild your pricing, your positioning, and the system that keeps your chair full.

But first — I need you to let go of the story you've been telling yourself about why this won't work for you.

It will. If you do the work.

Ready to keep going?`,

  "level-2-diagnosis": (state: any) => {
    const feelingText = state.level2?.pricingFeeling === 'nervous' || state.level2?.pricingFeeling === 'apologetic'
      ? `You said you feel ${state.level2.pricingFeeling} when talking about your rates. That right there is costing you thousands.`
      : ''

    const storyText = state.level2?.pricingStory
      ? `You wrote: "${state.level2.pricingStory.substring(0, 100)}..."

I've heard some version of this from almost every artist I've worked with. Here's the thing — that story isn't protecting you. It's keeping you broke.`
      : ''

    return `${feelingText}

${storyText}

The artists charging $5k-$10k per session aren't more talented than you. Some of them aren't even close to your level technically.

But they figured out something nobody teaches us:

**Price is a signal, not a barrier.**

When you charge more, you don't get fewer clients. You get different clients. Better clients. Clients who value what you do.

Let me show you exactly how this works.`
  },

  "level-2-action": () => `Here's what I want you to do.

Before our next session, I want you to write out your new pricing. Not what you think the market will bear. What your work is actually worth.

For most artists at your level, that means at least doubling your current rate.

I know that feels scary. That's normal.

But here's what's going to happen: some people will say no. And that's good. Those aren't your clients.

The ones who say yes? They'll be easier to work with. They'll trust your vision. They won't nickel and dime you.

You're not losing clients by raising prices. You're filtering for the right ones.

Next up, we're going to talk about why people actually buy — so you can make that yes feel easy. Ready?`,

  "level-3-diagnosis": (state: any) => {
    const lostSaleText = state.level3?.lostSale
      ? `You described a sale that didn't convert: "${state.level3.lostSale.substring(0, 150)}..."

I can see exactly where it went wrong.`
      : 'Let me tell you why most sales conversations fail.'

    return `${lostSaleText}

Most artists think selling is convincing. It's not.

Selling is helping someone make a decision they already want to make.

When someone reaches out to you, they're already interested. They don't need to be convinced your work is good — they've seen it. They're reaching out because they want it.

Your job isn't to "close" them. Your job is to remove the friction between "I want this" and "Yes, let's do it."

That friction? It's usually fear. Fear of making the wrong choice. Fear of spending money. Fear of the unknown.

Your conversation should address those fears — not by pushing harder, but by creating safety.

Let me show you how.`
  },

  "level-3-action": () => `Here's your framework for every sales conversation:

**1. Acknowledge the want.** "I can tell you have a clear vision for this piece."

**2. Address the fear.** "It's a big decision. Let me walk you through exactly how this works so you know what to expect."

**3. Make it easy.** "We can start with a deposit to lock in your spot, and I'll send over a detailed plan."

That's it. No pressure. No tricks. Just clarity and safety.

The next time someone inquires, try this approach. Don't try to convince them. Just remove the friction.

You'll be shocked how many more yes's you get.

Now — ready to build the system that keeps your calendar full?`,

  "chat-home": (state: any) => {
    const daysSinceLastVisit = state.lastVisit
      ? Math.floor((Date.now() - new Date(state.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    const currentLevel = state.progress?.currentLevel || 2
    const completedLevels = state.progress?.completedLevels || [1]

    if (state.progress?.justCompletedLevel) {
      return {
        message: `That was a big one.

You just finished Level ${currentLevel - 1}. ${levels[currentLevel - 2]?.completionMessage || ''}

Take a breath. Let it sink in.

When you're ready, Level ${currentLevel} is about ${levels[currentLevel - 1]?.description || 'the next step'}.`,
        videoKey: levels[currentLevel - 1]?.introVideo,
        buttonText: `Start Level ${currentLevel}`
      }
    }

    if (daysSinceLastVisit > 3) {
      return {
        message: `Been a minute. No stress — life happens.

Last time we talked, you'd just finished Level ${Math.max(...completedLevels, 0)}. ${state.memory?.[state.memory.length - 1]?.insight ? `You were thinking about ${state.memory[state.memory.length - 1].insight.toLowerCase()}.` : ''}

When you're ready, Level ${currentLevel} is here.`,
        videoKey: levels[currentLevel - 1]?.introVideo,
        buttonText: `Start Level ${currentLevel}`
      }
    }

    return {
      message: `You finished Level ${currentLevel - 1} — nice work.

${levels[currentLevel - 2]?.completionMessage || "You're making progress."}

Level ${currentLevel} is **${levels[currentLevel - 1]?.name || 'next'}**. ${levels[currentLevel - 1]?.description || ''}

Ready to keep going?`,
      videoKey: levels[currentLevel - 1]?.introVideo,
      buttonText: `Start Level ${currentLevel}`
    }
  },

  "chat": (state: any, userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase()

    if (lowerMessage.includes('price') || lowerMessage.includes('pricing') || lowerMessage.includes('charge')) {
      return {
        message: `Pricing questions — this is important.

Here's how I think about it: your price is a signal, not a barrier. When you charge premium rates, you're not excluding people. You're attracting people who value what you do.

What's the specific situation you're dealing with? Are you trying to raise prices with existing clients, or set prices for new ones?`,
        videoKey: state.progress?.completedLevels?.includes(2) ? null : "pricing-objections"
      }
    }

    if (lowerMessage.includes('client') || lowerMessage.includes('booking') || lowerMessage.includes('inquiry')) {
      return {
        message: `Tell me more about what's happening with your inquiries.

Are people reaching out but not booking? Or are you not getting enough inquiries in the first place?

The fix is different depending on where the leak is in your funnel.`
      }
    }

    if (lowerMessage.includes('scared') || lowerMessage.includes('nervous') || lowerMessage.includes('confident') || lowerMessage.includes('imposter')) {
      return {
        message: `I hear you. That feeling is real.

But here's what I've learned: confidence isn't something you wait to feel. It's something you build by taking action even when you're scared.

Every artist I know who's doing well went through this same phase. The difference is they kept going anyway.

What specifically is making you nervous right now?`,
        videoKey: "confidence"
      }
    }

    return {
      message: `## Here's what I want you to understand

Most artists think they need to post more, work harder, or get "discovered." That's backwards.

The artists booking $5k-$10k sessions aren't working harder than you. They figured out something different:

1. They stopped competing on volume and started competing on *positioning*
2. They made themselves the obvious choice for a specific type of client
3. They built systems that do the selling for them

**The real question isn't "how do I get more followers."** It's "how do I become undeniable to the right people?"

---

## What this means for you

Here's what I'd focus on right now:

• Get crystal clear on your signature work — the stuff that makes people say "I need to book with *them*"
• Stop trying to appeal to everyone — specificity creates demand
• Build a body of work that sells itself while you sleep

*The goal isn't to be famous. It's to be fully booked with clients who value what you do.*

What's resonating with you here? I want to dig into whatever feels most relevant to where you're at.`
    }
  }
}
