import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/forms/by-slug/[slug] - Get a published form by slug
 * This endpoint is public and uses RLS to only return published forms
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createClient() // Anon key - uses RLS
    const { slug } = params

    const { data: form, error } = await supabase
      .from('forms')
      .select(`
        id,
        spec,
        bot_id,
        clerk_org_id,
        published,
        mentor_bot:bot_id (
          display_name,
          avatar_url
        )
      `)
      .eq('slug', slug)
      .eq('published', true) // Only serve published forms
      .single()

    if (error || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }

    // Extract bot details from the joined data
    const botData = Array.isArray(form.mentor_bot) ? form.mentor_bot[0] : form.mentor_bot

    return NextResponse.json({
      form: { ...form.spec, id: form.id }, // Use database UUID as form.id
      botId: form.bot_id,
      orgId: form.clerk_org_id,
      botDisplayName: botData?.display_name,
      botAvatarUrl: botData?.avatar_url
    })
  } catch (error) {
    console.error('Error fetching form:', error)
    return NextResponse.json(
      { error: 'Failed to load form' },
      { status: 500 }
    )
  }
}
