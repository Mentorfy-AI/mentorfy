'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Form, Question, QuestionType } from '@/lib/forms/types';
import Link from 'next/link';

/**
 * Form Builder - Edit a specific form
 */
export default function FormEditorPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as string;

  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadForm() {
      try {
        const res = await fetch(`/api/forms/${formId}`);
        const data = await res.json();
        setForm(data.form);
      } catch (error) {
        console.error('Failed to load form:', error);
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [formId]);

  async function saveForm() {
    if (!form) return;

    setSaving(true);
    try {
      await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      alert('Form saved!');
    } catch (error) {
      console.error('Failed to save form:', error);
      alert('Failed to save form');
    } finally {
      setSaving(false);
    }
  }

  function updateFormName(name: string) {
    if (!form) return;
    setForm({ ...form, name, updatedAt: new Date().toISOString() });
  }

  function addQuestion(type: QuestionType) {
    if (!form) return;

    // Calculate position for new question (below existing questions)
    const yPosition = form.questions.length * 250;

    const baseQuestion = {
      id: `q-${Date.now()}`,
      text: 'New question',
      required: true,
      transitionStrategy: { type: 'simple' as const, nextQuestionId: null },
      position: { x: 250, y: yPosition },
    };

    let newQuestion: Question;

    switch (type) {
      case 'short_text':
        newQuestion = { ...baseQuestion, type: 'short_text' };
        break;
      case 'long_text':
        newQuestion = { ...baseQuestion, type: 'long_text' };
        break;
      case 'multiple_choice':
        newQuestion = {
          ...baseQuestion,
          type: 'multiple_choice',
          options: ['Option 1', 'Option 2'],
          maxSelections: 1,
        };
        break;
      case 'likert_scale':
        newQuestion = {
          ...baseQuestion,
          type: 'likert_scale',
          statement: 'New statement',
          options: [
            'Strongly Disagree',
            'Disagree',
            'Neutral',
            'Agree',
            'Strongly Agree'
          ],
        };
        break;
      case 'number_input':
        newQuestion = {
          ...baseQuestion,
          type: 'number_input',
          min: 0,
          step: 1,
        };
        break;
      case 'email':
        newQuestion = {
          ...baseQuestion,
          type: 'email',
          placeholder: 'you@example.com',
        };
        break;
    }

    setForm({
      ...form,
      questions: [...form.questions, newQuestion],
      updatedAt: new Date().toISOString(),
    });
  }

  function updateQuestion(questionId: string, updates: Partial<Question>) {
    if (!form) return;

    setForm({
      ...form,
      questions: form.questions.map((q) =>
        q.id === questionId ? ({ ...q, ...updates } as Question) : q
      ),
      updatedAt: new Date().toISOString(),
    });
  }

  function deleteQuestion(questionId: string) {
    if (!form) return;

    setForm({
      ...form,
      questions: form.questions.filter((q) => q.id !== questionId),
      updatedAt: new Date().toISOString(),
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading form...</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Form not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/form-builder">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <Input
                value={form.name}
                onChange={(e) => updateFormName(e.target.value)}
                className="text-2xl font-bold border-none p-0 h-auto"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {form.questions.length} question{form.questions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Link href={`/form-builder/${formId}/canvas`}>
              <Button variant="outline">Canvas View</Button>
            </Link>
            <Link href={`/f/${formId}`} target="_blank">
              <Button variant="outline">Preview</Button>
            </Link>
            <Button onClick={saveForm} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {form.questions.map((question, index) => (
            <Card key={question.id}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Question {index + 1}</Label>
                    <Input
                      value={question.text}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          text: e.target.value,
                        })
                      }
                      placeholder="Enter your question"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteQuestion(question.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Type: {question.type}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`required-${question.id}`}
                      checked={question.required}
                      onCheckedChange={(checked) =>
                        updateQuestion(question.id, {
                          required: checked as boolean,
                        })
                      }
                    />
                    <Label
                      htmlFor={`required-${question.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      Required
                    </Label>
                  </div>
                </div>

                {question.type === 'multiple_choice' && (
                  <div className="space-y-2">
                    <Label>Options (comma-separated)</Label>
                    <Input
                      value={question.options.join(', ')}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          options: e.target.value
                            .split(',')
                            .map((o) => o.trim()),
                        })
                      }
                    />
                  </div>
                )}

                {question.type === 'likert_scale' && (
                  <>
                    <div className="space-y-2">
                      <Label>Statement</Label>
                      <Textarea
                        value={question.statement}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            statement: e.target.value,
                          })
                        }
                        placeholder="I often change my mind after making decisions"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Options (comma-separated)</Label>
                      <Input
                        value={question.options.join(', ')}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            options: e.target.value
                              .split(',')
                              .map((o) => o.trim()),
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Common: Strongly Disagree, Disagree, Neutral, Agree, Strongly Agree
                      </p>
                    </div>
                  </>
                )}

                {question.type === 'number_input' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Min Value</Label>
                      <Input
                        type="number"
                        value={question.min ?? ''}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            min: e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        placeholder="No minimum"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Value</Label>
                      <Input
                        type="number"
                        value={question.max ?? ''}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            max: e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        placeholder="No maximum"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Step</Label>
                      <Input
                        type="number"
                        value={question.step ?? 1}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            step: Number(e.target.value) || 1,
                          })
                        }
                        placeholder="1"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use 0.01 for currency
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Prefix</Label>
                      <Input
                        value={question.prefix ?? ''}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            prefix: e.target.value || undefined,
                          })
                        }
                        placeholder="$ or £"
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Suffix</Label>
                      <Input
                        value={question.suffix ?? ''}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            suffix: e.target.value || undefined,
                          })
                        }
                        placeholder="hours, days, etc"
                      />
                    </div>
                  </div>
                )}

                {/* Transition Strategy */}
                <div className="space-y-2">
                  <Label>After this question, go to:</Label>
                  <Select
                    value={
                      question.transitionStrategy.type === 'simple'
                        ? question.transitionStrategy.nextQuestionId || 'end'
                        : 'conditional'
                    }
                    onValueChange={(value) => {
                      if (value === 'conditional') {
                        updateQuestion(question.id, {
                          transitionStrategy: {
                            type: 'conditional',
                            routes: [],
                            defaultNext: null,
                          },
                        });
                      } else {
                        updateQuestion(question.id, {
                          transitionStrategy: {
                            type: 'simple',
                            nextQuestionId: value === 'end' ? null : value,
                          },
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {index < form.questions.length - 1 && (
                        <SelectItem value={form.questions[index + 1].id}>
                          Next question (Question {index + 2})
                        </SelectItem>
                      )}
                      {form.questions.map((q, qIndex) => {
                        if (q.id === question.id) return null;
                        return (
                          <SelectItem key={q.id} value={q.id}>
                            Question {qIndex + 1}: {q.text.slice(0, 30)}
                            {q.text.length > 30 ? '...' : ''}
                          </SelectItem>
                        );
                      })}
                      <SelectItem value="end">End form</SelectItem>
                      <SelectItem value="conditional">Conditional (advanced)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Conditional Configuration - Placeholder for future UI */}
                {question.transitionStrategy.type === 'conditional' && (
                  <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      Conditional routing is enabled. Use the Canvas View to configure conditions visually.
                    </p>
                    <div className="mt-3 space-y-2">
                      <Label>Default next question (if no conditions match):</Label>
                      <Select
                        value={question.transitionStrategy.defaultNext || 'end'}
                        onValueChange={(value) => {
                          if (question.transitionStrategy.type === 'conditional') {
                            updateQuestion(question.id, {
                              transitionStrategy: {
                                ...question.transitionStrategy,
                                defaultNext: value === 'end' ? null : value,
                              },
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {form.questions.map((q, qIndex) => {
                            if (q.id === question.id) return null;
                            return (
                              <SelectItem key={q.id} value={q.id}>
                                Question {qIndex + 1}: {q.text.slice(0, 30)}
                                {q.text.length > 30 ? '...' : ''}
                              </SelectItem>
                            );
                          })}
                          <SelectItem value="end">End form</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          ))}

          {/* Add Question */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => addQuestion('short_text')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Short Text
            </Button>
            <Button
              variant="outline"
              onClick={() => addQuestion('long_text')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Long Text
            </Button>
            <Button
              variant="outline"
              onClick={() => addQuestion('multiple_choice')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Multiple Choice
            </Button>
            <Button
              variant="outline"
              onClick={() => addQuestion('likert_scale')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Likert Scale
            </Button>
            <Button
              variant="outline"
              onClick={() => addQuestion('number_input')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Number Input
            </Button>
            <Button
              variant="outline"
              onClick={() => addQuestion('email')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Email
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
