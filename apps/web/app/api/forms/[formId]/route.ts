import { NextRequest, NextResponse } from 'next/server';
import { getForm, saveForm, deleteForm } from '@/lib/forms/storage';
import { FormValidationError } from '@/lib/forms/validation';

/**
 * GET /api/forms/[formId] - Get a single form
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { formId: string } }
) {
  try {
    const form = getForm(params.formId);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({ form });
  } catch (error) {
    console.error('Error getting form:', error);
    return NextResponse.json(
      { error: 'Failed to get form' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/forms/[formId] - Update a form
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { formId: string } }
) {
  try {
    const body = await req.json();

    // Ensure the ID matches
    if (body.id !== params.formId) {
      return NextResponse.json({ error: 'ID mismatch' }, { status: 400 });
    }

    saveForm(body); // Will throw FormValidationError if invalid

    return NextResponse.json({ form: body });
  } catch (error) {
    if (error instanceof FormValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 } // Bad Request - validation failed
      );
    }

    console.error('Error updating form:', error);
    return NextResponse.json(
      { error: 'Failed to update form' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/forms/[formId] - Delete a form
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { formId: string } }
) {
  try {
    deleteForm(params.formId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting form:', error);
    return NextResponse.json(
      { error: 'Failed to delete form' },
      { status: 500 }
    );
  }
}
