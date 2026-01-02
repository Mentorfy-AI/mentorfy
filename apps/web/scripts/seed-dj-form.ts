import { createServiceClient } from '@/lib/supabase-server'
import djForm from '../data/forms/form-coaching-onboarding.json'

async function seedDJForm() {
  const supabase = createServiceClient()

  // DJ's org
  const djOrgId = 'org_34ffHs9V82vHg8QJUBOgAafpWHy'
  const djBotId = 'a5a08a49-9b3a-4809-8b0a-a14f186b48a5' // david_jacob_ai

  console.log('Seeding DJ form...')
  console.log('Org ID:', djOrgId)
  console.log('Bot ID:', djBotId)

  // Insert form
  const { data, error } = await supabase.from('forms').insert({
    clerk_org_id: djOrgId,
    name: 'High-Ticket Coaching Onboarding',
    slug: 'coaching-onboarding',
    spec: djForm,
    bot_id: djBotId,
    published: true, // Live immediately
    published_at: new Date().toISOString(),
  }).select()

  if (error) {
    console.error('❌ Failed to seed form:', error)
    throw error
  }

  console.log('✅ DJ form seeded successfully!')
  console.log('Form ID:', data[0]?.id)
  console.log('Form URL: http://localhost:3000/f/coaching-onboarding')
}

seedDJForm()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
