'use client';
import { useState } from 'react';

import { Dialog } from '@/components/ui/dialog';
import { ProgressPromptBox } from '@/components/progress-prompt-box';

interface ProgressChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string) => void;
}

/**
 * Progress chat modal using a customized chat interface without model selector
 * Features: Full-screen ProgressPromptBox component that fills the entire modal
 */
export function ProgressChatModal({
  isOpen,
  onClose,
  onSubmit,
}: ProgressChatModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (content: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      await onSubmit(content);
      // Don't close modal automatically - let parent handle it
    } catch (error) {
      console.error('Failed to submit progress:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={handleClose}
    >
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="fixed left-[50%] top-[50%] z-50 w-[90vw] max-w-5xl translate-x-[-50%] translate-y-[-50%] p-12">
          <div className="flex-1">
            <ProgressPromptBox
              onSubmit={handleSubmit}
              onClose={handleClose}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
