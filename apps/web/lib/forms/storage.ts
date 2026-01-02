/**
 * Form Builder Storage Layer
 *
 * Simple JSON file-based storage for MVP.
 * Will migrate to Supabase later.
 */

import { Form, LeadFormCompletion } from './types';
import { validateForm } from './validation';
import fs from 'fs';
import path from 'path';

const FORMS_DIR = path.join(process.cwd(), 'data', 'forms');
const COMPLETIONS_DIR = path.join(process.cwd(), 'data', 'completions');

// Ensure directories exist
if (!fs.existsSync(FORMS_DIR)) {
  fs.mkdirSync(FORMS_DIR, { recursive: true });
}
if (!fs.existsSync(COMPLETIONS_DIR)) {
  fs.mkdirSync(COMPLETIONS_DIR, { recursive: true });
}

// ============================================================================
// Form CRUD
// ============================================================================

/**
 * Save a form to JSON file
 * Validates form before saving - throws FormValidationError if invalid
 */
export function saveForm(form: Form): void {
  // Validate before saving
  validateForm(form);

  const filePath = path.join(FORMS_DIR, `${form.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(form, null, 2), 'utf-8');
}

/**
 * Get a form by ID
 */
export function getForm(id: string): Form | null {
  const filePath = path.join(FORMS_DIR, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Form;
}

/**
 * List all forms
 */
export function listForms(): Form[] {
  const files = fs.readdirSync(FORMS_DIR);

  return files
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const content = fs.readFileSync(path.join(FORMS_DIR, f), 'utf-8');
      return JSON.parse(content) as Form;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Delete a form
 */
export function deleteForm(id: string): void {
  const filePath = path.join(FORMS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ============================================================================
// Completion CRUD
// ============================================================================

/**
 * Save a form completion
 */
export function saveCompletion(completion: LeadFormCompletion): void {
  const filePath = path.join(COMPLETIONS_DIR, `${completion.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(completion, null, 2), 'utf-8');
}

/**
 * Get a completion by ID
 */
export function getCompletion(id: string): LeadFormCompletion | null {
  const filePath = path.join(COMPLETIONS_DIR, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as LeadFormCompletion;
}

/**
 * List all completions for a form
 */
export function listCompletionsByForm(formId: string): LeadFormCompletion[] {
  const files = fs.readdirSync(COMPLETIONS_DIR);

  return files
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const content = fs.readFileSync(path.join(COMPLETIONS_DIR, f), 'utf-8');
      return JSON.parse(content) as LeadFormCompletion;
    })
    .filter(c => c.formId === formId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

/**
 * Delete a completion
 */
export function deleteCompletion(id: string): void {
  const filePath = path.join(COMPLETIONS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
