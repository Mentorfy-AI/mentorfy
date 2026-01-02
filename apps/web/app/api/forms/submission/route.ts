import { createServiceClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/forms/submission - Create a new form submission
 * Used for anonymous users filling out forms
 * Creates submission on first answer to ensure zero data loss
 */
export async function POST(req: NextRequest) {
  try {
    const { formSlug, sessionId, email, phone, answers, currentQuestionId, currentQuestionIndex } = await req.json()

    if (!formSlug || !sessionId) {
      return NextResponse.json(
        { error: 'formSlug and sessionId required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient() // Bypass RLS for anonymous

    // Get form to derive org/bot
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('id, clerk_org_id, bot_id')
      .eq('slug', formSlug)
      .eq('published', true)
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }

    // Upsert submission (create or update if exists for this session)
    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .upsert({
        form_id: form.id,
        clerk_org_id: form.clerk_org_id,
        bot_id: form.bot_id,
        session_id: sessionId,
        email: email || null,
        phone: phone || null,
        answers: answers || [],
        current_question_id: currentQuestionId || null,
        current_question_index: currentQuestionIndex ?? null,
        status: 'in_progress',
        last_updated_at: new Date().toISOString(),
      }, {
        onConflict: 'form_id,session_id',
      })
      .select()
      .single()

    if (submissionError) {
      console.error('Failed to upsert submission:', submissionError)
      return NextResponse.json(
        { error: 'Failed to save submission' },
        { status: 500 }
      )
    }

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('Error in POST /api/forms/submission:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/forms/submission - Update an existing submission
 * Used to save progress as user navigates through form
 */
export async function PATCH(req: NextRequest) {
  try {
    const {
      submissionId,
      answers,
      currentQuestionId,
      currentQuestionIndex,
      status,
      email,
      phone,
    } = await req.json()

    if (!submissionId) {
      return NextResponse.json(
        { error: 'submissionId required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const updates: any = {
      last_updated_at: new Date().toISOString(),
    }

    if (answers) updates.answers = answers
    if (email) updates.email = email
    if (phone) updates.phone = phone
    if (currentQuestionId !== undefined) updates.current_question_id = currentQuestionId
    if (currentQuestionIndex !== undefined) updates.current_question_index = currentQuestionIndex

    if (status) {
      updates.status = status
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString()
      }
    }

    const { data, error } = await supabase
      .from('form_submissions')
      .update(updates)
      .eq('id', submissionId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update submission:', error)
      return NextResponse.json(
        { error: 'Failed to update submission' },
        { status: 500 }
      )
    }

    return NextResponse.json({ submission: data })
  } catch (error) {
    console.error('Error in PATCH /api/forms/submission:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
