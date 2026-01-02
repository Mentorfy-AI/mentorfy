/**
 * Question Edit Dialog
 *
 * Modal for editing question details from the canvas
 * Reuses form inputs from list view to avoid duplication
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Question, Form } from '@/lib/forms/types';
import { Trash2 } from 'lucide-react';

interface QuestionEditDialogProps {
  question: Question | null;
  form: Form;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (questionId: string, updates: Partial<Question>) => void;
  onDelete: (questionId: string) => void;
}

export function QuestionEditDialog({
  question,
  form,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: QuestionEditDialogProps) {
  // Track edits separately from the prop
  const [edits, setEdits] = useState<Partial<Question>>({});

  // Reset edits when dialog opens with a new question
  useEffect(() => {
    if (open && question) {
      setEdits({});
    }
  }, [open, question]);

  // Merge question prop with edits
  const displayQuestion = question ? { ...question, ...edits } : null;

  function handleSave() {
    if (!question) return;
    onSave(question.id, displayQuestion!);
    onOpenChange(false);
  }

  function handleDelete() {
    if (!question) return;
    if (confirm('Delete this question?')) {
      onDelete(question.id);
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question Text */}
          <div className="space-y-2">
            <Label>Question</Label>
            <Input
              value={displayQuestion?.text || ''}
              onChange={(e) =>
                setEdits({ ...edits, text: e.target.value })
              }
              placeholder="Enter your question"
            />
          </div>

          {/* Required Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="required"
              checked={displayQuestion?.required || false}
              onCheckedChange={(checked) =>
                setEdits({
                  ...edits,
                  required: checked as boolean,
                })
              }
            />
            <Label
              htmlFor="required"
              className="cursor-pointer"
            >
              Required
            </Label>
          </div>

          {/* Type-specific fields */}
          {displayQuestion?.type === 'multiple_choice' && (
            <div className="space-y-2">
              <Label>Options (comma-separated)</Label>
              <Input
                value={displayQuestion.options?.join(', ') || ''}
                onChange={(e) =>
                  setEdits({
                    ...edits,
                    options: e.target.value.split(',').map((o) => o.trim()),
                  })
                }
              />
            </div>
          )}

          {/* Transition Strategy */}
          <div className="space-y-2">
            <Label>After this question, go to:</Label>
            <Select
              value={
                displayQuestion?.transitionStrategy.type === 'simple'
                  ? displayQuestion.transitionStrategy.nextQuestionId || 'end'
                  : 'conditional'
              }
              onValueChange={(value) => {
                if (value === 'conditional') {
                  setEdits({
                    ...edits,
                    transitionStrategy: {
                      type: 'conditional',
                      routes: [],
                      defaultNext: null,
                    },
                  });
                } else {
                  setEdits({
                    ...edits,
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
                {form.questions
                  .filter((q) => q.id !== displayQuestion?.id)
                  .map((q, idx) => (
                    <SelectItem
                      key={q.id}
                      value={q.id}
                    >
                      {q.text.slice(0, 40)}
                      {q.text.length > 40 ? '...' : ''}
                    </SelectItem>
                  ))}
                <SelectItem value="end">End form</SelectItem>
                <SelectItem value="conditional">Conditional (advanced)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="mr-auto"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Question
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
