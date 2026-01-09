/**
 * TTFT Benchmark: Compare time-to-first-token across models
 *
 * Usage:
 *   bun scripts/benchmark-ttft.ts
 *
 * Requires:
 *   ANTHROPIC_API_KEY and GOOGLE_API_KEY in .env
 *   bun add @ai-sdk/google (if not installed)
 */

import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY! })

// Paste your system prompt and user message from Langfuse here
const systemPrompt = `You are analyzing an applicant for the Growth Operator program - a partnership where operators work with experts to sell $5k-$15k AI products.

Based on the promptKey in the user message, generate one of two types of diagnosis:

For "first-diagnosis" (after multiple choice questions):
Structure your response exactly like this:

Address them by name
Reflect back their situation, background, experience level, time commitment, and capital
Explain how the Growth Operator model works for someone in their specific situation - what role they'd play, how their background fits
Transition to the deeper questions with something like: "Now I need to go deeper. The next few questions are different. I need you to actually write - not just pick from options. The more real you are, the more I can actually tell you if this is right for you. Take your time."
Keep it conversational and personal. Reference their specific answers.

For "final-diagnosis" (after open-ended questions):
Use ALL their answers to make a qualification decision:

Reflect their situation with depth - Pull from their "what's going on" answer. Use their words. Make them feel seen.

Connect to the opportunity - Pull from their "why this" answer. Validate what they noticed. Explain how the model fits what they're looking for.

Honest assessment of fit - Pull from their "why you" answer. Reflect back what they bring. Be real about whether they're a fit.

The decision:

If they seem like a good fit (shows initiative, has relevant background, realistic time/capital, thoughtful answers): Call the showBooking tool with your diagnosis text as beforeText
If NOT a good fit (unrealistic expectations, insufficient time/capital, vague answers): Don't call any tools. Be honest and kind about why it's not the right timing. Leave the door open for the future.
IMPORTANT:

Never mention "phases", "steps", "levels", or structured progression
Be conversational, not corporate
If calling showBooking, put your full diagnosis in the beforeText parameter
Basic qualification criteria: 10+ hours/week, $5k+ capital, relevant experience or strong initiative, thoughtful answers
Format your response with clear markdown headers (## Section Name) for each major section. Use bold for emphasis within paragraphs.`

const userMessage = `User context:
{
"user": {
"name": "Testing"
},
"applicantProfile": {
"currentSituation": "full-time",
"professionalBackground": "sales",
"entrepreneurExperience": "no",
"weeklyTimeAvailable": "less-5",
"startupCapital": "under-1k"
}
}
Prompt key: first-diagnosis

Generate the diagnosis based on this information.`

interface ModelConfig {
  name: string
  model: any
}

const models: ModelConfig[] = [
  { name: 'Claude Haiku 4.5', model: anthropic('claude-haiku-4-5-20251001') },
  { name: 'Gemini 2.5 Flash Lite', model: google('gemini-2.5-flash-lite') },
  { name: 'Gemini 3 Flash Preview', model: google('gemini-3-flash-preview') },
]

async function measureTTFT(config: ModelConfig): Promise<{ ttft: number; totalTime: number; output: string }> {
  const startTime = performance.now()
  let firstChunkTime: number | null = null
  let output = ''

  const result = streamText({
    model: config.model,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    maxOutputTokens: 2048,
  })

  for await (const chunk of result.textStream) {
    if (firstChunkTime === null) {
      firstChunkTime = performance.now()
    }
    output += chunk
  }

  const endTime = performance.now()

  return {
    ttft: firstChunkTime! - startTime,
    totalTime: endTime - startTime,
    output,
  }
}

async function runBenchmark(runs: number = 3) {
  console.log(`\n🏁 TTFT Benchmark (${runs} runs per model)\n`)
  console.log('='.repeat(60))

  const results: Record<string, { ttft: number[]; totalTime: number[] }> = {}

  for (const config of models) {
    results[config.name] = { ttft: [], totalTime: [] }
    console.log(`\n📊 Testing: ${config.name}`)

    for (let i = 0; i < runs; i++) {
      try {
        const { ttft, totalTime, output } = await measureTTFT(config)
        results[config.name].ttft.push(ttft)
        results[config.name].totalTime.push(totalTime)
        console.log(`   Run ${i + 1}: TTFT=${ttft.toFixed(0)}ms, Total=${totalTime.toFixed(0)}ms`)

        // Show first 100 chars of output on first run
        if (i === 0) {
          console.log(`   Preview: "${output.slice(0, 100).replace(/\n/g, ' ')}..."`)
        }
      } catch (err: any) {
        console.log(`   Run ${i + 1}: ERROR - ${err.message}`)
      }

      // Small delay between runs
      await new Promise(r => setTimeout(r, 500))
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('\n📈 SUMMARY\n')

  for (const [name, data] of Object.entries(results)) {
    if (data.ttft.length === 0) continue

    const avgTTFT = data.ttft.reduce((a, b) => a + b, 0) / data.ttft.length
    const minTTFT = Math.min(...data.ttft)
    const maxTTFT = Math.max(...data.ttft)
    const avgTotal = data.totalTime.reduce((a, b) => a + b, 0) / data.totalTime.length

    console.log(`${name}:`)
    console.log(`   TTFT:  avg=${avgTTFT.toFixed(0)}ms, min=${minTTFT.toFixed(0)}ms, max=${maxTTFT.toFixed(0)}ms`)
    console.log(`   Total: avg=${avgTotal.toFixed(0)}ms`)
    console.log()
  }
}

// Run it
runBenchmark(3)
