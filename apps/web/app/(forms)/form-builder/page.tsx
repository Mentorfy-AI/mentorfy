'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Plus } from 'lucide-react';

interface FormListItem {
  id: string;
  name: string;
  updatedAt: string;
  questionCount: number;
}

/**
 * Form Builder - List all forms
 */
export default function FormBuilderPage() {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadForms() {
      try {
        const res = await fetch('/api/forms');
        const data = await res.json();
        setForms(data.forms || []);
      } catch (error) {
        console.error('Failed to load forms:', error);
      } finally {
        setLoading(false);
      }
    }

    loadForms();
  }, []);

  async function createNewForm() {
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Form' }),
      });

      const data = await res.json();

      if (data.form) {
        window.location.href = `/form-builder/${data.form.id}`;
      }
    } catch (error) {
      console.error('Failed to create form:', error);
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">Form Builder</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage dynamic forms
            </p>
          </div>

          <Button onClick={createNewForm} size="lg">
            <Plus className="w-4 h-4 mr-2" />
            New Form
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading forms...
          </div>
        ) : forms.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No forms yet</p>
              <Button onClick={createNewForm} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Create your first form
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {forms.map((form) => (
              <Link key={form.id} href={`/form-builder/${form.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg">{form.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>{form.questionCount} question{form.questionCount !== 1 ? 's' : ''}</p>
                      <p>
                        Updated{' '}
                        {new Date(form.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
