import { NextRequest, NextResponse } from 'next/server';
import { listForms, saveForm } from '@/lib/forms/storage';
import { Form } from '@/lib/forms/types';
import { FormValidationError } from '@/lib/forms/validation';

/**
 * GET /api/forms - List all forms
 */
export async function GET() {
  try {
    const forms = listForms();

    const formList = forms.map((f) => ({
      id: f.id,
      name: f.name,
      updatedAt: f.updatedAt,
      questionCount: f.questions.length,
    }));

    return NextResponse.json({ forms: formList });
  } catch (error) {
    console.error('Error listing forms:', error);
    return NextResponse.json(
      { error: 'Failed to list forms' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms - Create a new form
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;

    const now = new Date().toISOString();

    const newForm: Form = {
      id: `form-${Date.now()}`,
      name: name || 'Untitled Form',
      questions: [],
      createdAt: now,
      updatedAt: now,
    };

    saveForm(newForm); // Will throw FormValidationError if invalid

    return NextResponse.json({ form: newForm });
  } catch (error) {
    if (error instanceof FormValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 } // Bad Request - validation failed
      );
    }

    console.error('Error creating form:', error);
    return NextResponse.json(
      { error: 'Failed to create form' },
      { status: 500 }
    );
  }
}
