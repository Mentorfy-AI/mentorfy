import { config } from 'dotenv'
import { createClerkClient } from '@clerk/backend'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
config({ path: '.env.local' })

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Organization ID from environment variable
// Get this from Clerk dashboard and set in .env.local as SEED_CLERK_ORG_ID
const CLERK_ORG_ID = process.env.SEED_CLERK_ORG_ID
if (!CLERK_ORG_ID) {
  console.error('❌ Error: SEED_CLERK_ORG_ID environment variable is required')
  console.error('Set it in .env.local to the Clerk organization ID you want to seed users into')
  process.exit(1)
}

const seedUsers = [
  {
    firstName: 'Alex',
    lastName: 'Rodriguez',
    email: 'alex.rodriguez@mentorfy-demo.com',
    profile: {
      summary: `**Learning Profile & Personality:**
Alex is a kinesthetic learner who struggles with traditional lecture-style teaching. He's highly creative but lacks confidence in academic settings. Prefers hands-on activities and visual demonstrations. Has ADHD which affects his attention span but gives him unique problem-solving perspectives.

**Communication Style:**
Responds best to encouraging, patient communication. Needs frequent check-ins and positive reinforcement. Tends to shut down when criticized directly. Prefers informal, conversational tone over formal academic language.

**Strengths & Talents:**
- Exceptional spatial reasoning abilities
- Natural leadership qualities in group settings
- Strong emotional intelligence and empathy
- Creative problem-solving approach
- Excellent at explaining complex concepts to peers

**Challenges & Growth Areas:**
- Time management and organization skills
- Test anxiety, especially with timed assessments
- Difficulty with abstract mathematical concepts
- Procrastination tendencies
- Self-doubt about academic abilities`,
    },
  },
  {
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.chen@mentorfy-demo.com',
    profile: {
      summary: `**Learning Profile & Personality:**
Sarah is a perfectionist with exceptionally high standards for herself. She's an analytical thinker who excels at breaking down complex problems but often gets overwhelmed by the big picture. Highly organized and detail-oriented, but struggles with work-life balance.

**Communication Style:**
Prefers direct, structured communication with clear expectations. Appreciates detailed feedback and specific action items. Can become defensive when receiving criticism, so feedback needs to be framed constructively. Values efficiency in conversations.

**Strengths & Talents:**
- Outstanding analytical and critical thinking skills
- Exceptional attention to detail and accuracy
- Strong research and information synthesis abilities
- Natural mentor to struggling classmates
- Excellent written communication skills

**Challenges & Growth Areas:**
- Perfectionism leading to procrastination and anxiety
- Difficulty delegating or asking for help
- Tendency to overcommit and burn out
- Struggles with creative or open-ended assignments
- Social anxiety in large group settings`,
    },
  },
  {
    firstName: 'Marcus',
    lastName: 'Johnson',
    email: 'marcus.johnson@mentorfy-demo.com',
    profile: {
      summary: 'Natural leader but lacks confidence in academic abilities. Learns best through discussion and collaborative work. Motivated by real-world applications.',
    },
  },
  {
    firstName: 'Emma',
    lastName: 'Thompson',
    email: 'emma.thompson@mentorfy-demo.com',
    profile: {
      summary: 'Creative thinker with strong artistic abilities. Struggles with traditional academic structure. Responds well to creative assignments and flexible deadlines.',
    },
  },
  {
    firstName: 'David',
    lastName: 'Park',
    email: 'david.park@mentorfy-demo.com',
    profile: {
      summary: 'Analytical mind with strong problem-solving skills. Prefers independent work but benefits from occasional guidance. Goal-oriented and self-motivated.',
    },
  },
  {
    firstName: 'Lisa',
    lastName: 'Wang',
    email: 'lisa.wang@mentorfy-demo.com',
    profile: {
      summary: 'Collaborative learner who thrives in group settings. Strong communication skills but needs help with technical subjects. Very responsive to encouragement.',
    },
  },
]

async function main() {
  console.log('🌱 Starting user seeding process...\n')

  for (const seedUser of seedUsers) {
    try {
      console.log(`Processing user: ${seedUser.email}`)

      // 1. Try to find existing user or create new one
      let clerkUser
      try {
        // Try to find user by email
        const users = await clerkClient.users.getUserList({
          emailAddress: [seedUser.email],
        })

        if (users.data.length > 0) {
          clerkUser = users.data[0]
          console.log(`✅ Found existing Clerk user: ${clerkUser.id}`)
        } else {
          // Create user if not found
          clerkUser = await clerkClient.users.createUser({
            firstName: seedUser.firstName,
            lastName: seedUser.lastName,
            emailAddress: [seedUser.email],
            skipPasswordChecks: true, // For demo users
            skipPasswordRequirement: true,
          })
          console.log(`✅ Created Clerk user: ${clerkUser.id}`)
        }
      } catch (userError: any) {
        console.error(`❌ Error with user creation/lookup:`, userError.message)
        continue
      }

      // 2. Add user to organization (SKIPPED - Clerk org roles may need configuration)
      // Note: Users need to be added to the organization manually in Clerk dashboard
      // or the organization roles need to be configured first
      console.log(`⏭️  Skipping organization membership (configure Clerk org roles first)`)

      // 3. Create user profile in Supabase (or update if exists)
      // First check if profile exists
      const { data: existingProfile } = await supabase
        .from('user_profile')
        .select('id')
        .eq('clerk_user_id', clerkUser.id)
        .eq('clerk_org_id', CLERK_ORG_ID)
        .single()

      if (existingProfile) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('user_profile')
          .update({
            ...seedUser.profile,
            updated_at: new Date().toISOString(),
          })
          .eq('clerk_user_id', clerkUser.id)
          .eq('clerk_org_id', CLERK_ORG_ID)

        if (updateError) {
          console.error(`❌ Error updating profile:`, updateError)
          continue
        }
        console.log(`✅ Updated user profile in Supabase`)
      } else {
        // Create new profile (clean schema - no organization_id or user_id)
        const { error: profileError } = await supabase
          .from('user_profile')
          .insert({
            clerk_user_id: clerkUser.id,
            clerk_org_id: CLERK_ORG_ID,
            ...seedUser.profile,
          })

        if (profileError) {
          console.error(`❌ Error creating profile:`, profileError)
          continue
        }
        console.log(`✅ Created user profile in Supabase`)
      }
      console.log(`✅ Completed: ${seedUser.email}\n`)

      // Rate limiting - wait 500ms between requests
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error: any) {
      console.error(`❌ Error processing ${seedUser.email}:`, error.message)
      console.error(error)
    }
  }

  console.log('🎉 Seeding complete!')
}

main()
