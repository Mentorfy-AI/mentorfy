'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, CheckCircle2, ChevronLeft, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { Oswald, Inter } from 'next/font/google';

const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
import {
  Form,
  Question,
  LeadFormCompletion,
  Answer,
  AnswerValue,
  InformationalQuestion,
} from '@/lib/forms/types';
import { validateAnswer, validateForm } from '@/lib/forms/validators';
import { getNextQuestionFromConditional } from '@/lib/forms/conditional-logic';
import { extractUserProfile, UserProfile } from '@/lib/forms/utils';
import { Typewriter } from '@/components/form-renderer/Typewriter';
import {
  ShortTextInput,
  LongTextInput,
  EmailInput,
  PhoneInput,
  NumberInput,
  MultipleChoiceInput,
  LikertScaleInput,
  InformationalDisplay,
} from '@/components/form-renderer/FormInputs';
import { CompletionScreen } from '@/components/form-renderer/CompletionScreen';
import { WelcomeScreen } from '@/components/form-renderer/WelcomeScreen';
import { FormThemeProvider, useFormTheme } from '@/lib/forms/theme';
import { QuestionHeader } from '@/components/form-renderer/QuestionHeader';

/**
 * Public Form Renderer with FlowBuilder Design
 * Displays form to end users with premium animations and UX
 */
function FormPageContent() {
  const params = useParams();
  const posthog = usePostHog();
  const formSlug = params.formSlug as string; // Keep formId param name for backward compatibility
  const theme = useFormTheme();

  const [form, setForm] = useState<Form | null>(null);
  const [botId, setBotId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [botDisplayName, setBotDisplayName] = useState<string>('');
  const [botAvatarUrl, setBotAvatarUrl] = useState<string>('');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionHistory, setQuestionHistory] = useState<number[]>([0]); // Track actual navigation path
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerValue>('');
  const [currentGroupAnswers, setCurrentGroupAnswers] = useState<
    Record<string, AnswerValue>
  >({}); // For grouped questions
  const [direction, setDirection] = useState(0); // For animation direction
  const [isComplete, setIsComplete] = useState(false);
  const [completionId, setCompletionId] = useState<string | null>(null);
  const [completionData, setCompletionData] = useState<{
    profile: UserProfile;
    submissionId: string;
    botId: string;
    orgId: string;
  } | null>(null);
  const [isLoadingTransition, setIsLoadingTransition] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [llmContentCache, setLlmContentCache] = useState<
    Record<string, string>
  >({});
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [hasInteractedWithCurrentScreen, setHasInteractedWithCurrentScreen] =
    useState(false);
  const [showWelcome, setShowWelcome] = useState(false); // Will be set to true if form has welcome config
  const justNavigatedBack = useRef(false); // Track back navigation to prevent auto-advance

  // Analytics State
  const [sessionId] = useState(() =>
    typeof crypto !== 'undefined'
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random()}`
  );
  const formStartedAt = useRef<number>(Date.now());
  const questionViewedAt = useRef<number>(Date.now());
  const abandonmentTimeout = useRef<any>(null);

  // Reset abandonment timer on user interaction
  const resetAbandonmentTimer = () => {
    if (abandonmentTimeout.current) {
      clearTimeout(abandonmentTimeout.current);
    }

    if (isComplete) return;

    abandonmentTimeout.current = setTimeout(() => {
      posthog?.capture('form_abandoned', {
        form_id: form?.id,
        form_name: form?.name,
        session_id: sessionId,
        last_question_id: form?.questions[currentQuestionIndex]?.id,
        last_question_index: currentQuestionIndex,
        questions_answered: answers.length,
        time_spent_seconds: (Date.now() - formStartedAt.current) / 1000,
      });
    }, 180000); // 3 minutes
  };

  // Initialize timer and track form view
  useEffect(() => {
    resetAbandonmentTimer();
    return () => {
      if (abandonmentTimeout.current) clearTimeout(abandonmentTimeout.current);
    };
  }, [currentQuestionIndex, currentAnswer, isComplete]); // Reset on any key interaction

  useEffect(() => {
    async function loadForm() {
      try {
        const res = await fetch(`/api/forms/by-slug/${formSlug}`);

        if (!res.ok) {
          setLoadError('Form not found');
          return;
        }

        const data = await res.json();

        // Validate form structure
        const validationResult = validateForm(data.form);
        if (!validationResult.valid) {
          console.error('Form validation failed:', validationResult.error);
          setLoadError(validationResult.error || 'Form validation failed');
          return;
        }

        setForm(data.form);
        setBotId(data.botId);
        setOrgId(data.orgId);
        setBotDisplayName(data.botDisplayName || data.form.name);
        setBotAvatarUrl(data.botAvatarUrl || '');
        setShowWelcome(!!data.form.welcome); // Show welcome screen if config exists
        formStartedAt.current = Date.now();

        // Track form view
        posthog?.capture('form_viewed', {
          form_id: formSlug,
          form_name: data.form.name,
          session_id: sessionId,
          referrer: document.referrer,
        });
      } catch (error) {
        console.error('Failed to load form:', error);
        setLoadError('Failed to load form');
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [formSlug]);

  // Track question view
  useEffect(() => {
    if (!form || !form.questions[currentQuestionIndex]) return;

    const question = form.questions[currentQuestionIndex];
    questionViewedAt.current = Date.now();

    posthog?.capture('question_viewed', {
      form_id: form.id,
      form_name: form.name,
      session_id: sessionId,
      question_id: question.id,
      question_text: question.text,
      question_type: question.type,
      question_index: currentQuestionIndex,
      total_questions: form.questions.length,
    });
  }, [currentQuestionIndex, form]);

  // Reset interaction flag when screen changes
  useEffect(() => {
    setHasInteractedWithCurrentScreen(false);
  }, [currentQuestionIndex]);

  // Fetch LLM content for informational screens
  useEffect(() => {
    const question = form?.questions[currentQuestionIndex];
    if (!question || question.type !== 'informational') return;
    if (question.contentSource !== 'llm') return;

    // Check cache first
    if (llmContentCache[question.id]) return;

    // Fetch LLM content
    async function fetchContent() {
      if (!form) return;
      const q = question as InformationalQuestion;

      setIsLoadingContent(true);
      try {
        const context = answers
          .map((a) => `Q: ${a.questionText}\nA: ${a.value}`)
          .join('\n\n');

        const res = await fetch('/api/forms/generate-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formId: form.id,
            generationPrompt: q.content,
            context,
          }),
        });

        if (res.ok) {
          const { content } = await res.json();
          setLlmContentCache((prev) => ({ ...prev, [q.id]: content }));
        }
      } catch (error) {
        console.error('Failed to fetch LLM content:', error);
      } finally {
        setIsLoadingContent(false);
      }
    }

    fetchContent();
  }, [currentQuestionIndex, form, answers, llmContentCache]);

  // Helper: Get questions to display at current index (either group or single)
  const getCurrentGroup = () => {
    if (!form) return null;
    const currentQ = form.questions[currentQuestionIndex];
    if (!currentQ) return null;
    return (
      form.groups?.find((g) => g.questionIds.includes(currentQ.id)) || null
    );
  };

  const getCurrentQuestions = (): Question[] => {
    if (!form) return [];

    const currentQ = form.questions[currentQuestionIndex];
    if (!currentQ) return [];

    // Check if this question is part of a group
    const group = getCurrentGroup();

    if (group) {
      // Return all questions in the group
      return group.questionIds
        .map((qid) => form.questions.find((q) => q.id === qid))
        .filter(Boolean) as Question[];
    }

    // Single question
    return [currentQ];
  };

  const currentQuestions = getCurrentQuestions();
  const currentQuestion = currentQuestions[0]; // For backwards compatibility with single-question logic
  const currentGroup = getCurrentGroup();
  const isGrouped = currentQuestions.length > 1;

  const isLastQuestion =
    form && currentQuestionIndex === form.questions.length - 1;

  // Calculate progress based on screens, not questions
  const currentScreen = getScreenNumber(currentQuestionIndex);
  const totalScreens = getTotalScreenCount();
  const completedScreens = currentScreen - 1;
  const progress = hasInteractedWithCurrentScreen
    ? (currentScreen / totalScreens) * 100
    : (completedScreens / totalScreens) * 100;

  // Helper: Get screen number (1-indexed) for a given question index
  function getScreenNumber(questionIndex: number): number {
    if (!form || !form.questions[questionIndex]) return 1;

    let screenNumber = 0;
    const processedGroups = new Set<string>();

    for (let i = 0; i <= questionIndex; i++) {
      const q = form.questions[i];
      const group = form.groups?.find((g) => g.questionIds.includes(q.id));

      if (group) {
        // Question is in a group
        if (!processedGroups.has(group.id)) {
          screenNumber++;
          processedGroups.add(group.id);
        }
        // Skip remaining questions in this group
      } else {
        // Standalone question
        screenNumber++;
      }
    }

    return screenNumber;
  }

  // Helper: Get total number of screens in the form
  function getTotalScreenCount(): number {
    if (!form || !form.questions.length) return 1;

    let screenCount = 0;
    const processedGroups = new Set<string>();

    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      const group = form.groups?.find((g) => g.questionIds.includes(q.id));

      if (group) {
        // Question is in a group
        if (!processedGroups.has(group.id)) {
          screenCount++;
          processedGroups.add(group.id);
        }
      } else {
        // Standalone question
        screenCount++;
      }
    }

    return screenCount;
  }

  async function getNextQuestionIndex(
    currentQ: Question,
    answersToUse: Answer[]
  ): Promise<number | null> {
    if (!form) return null;

    const strategy = currentQ.transitionStrategy;

    if (strategy.type === 'simple') {
      const nextId = strategy.nextQuestionId;
      if (nextId === null) return null;
      const nextIndex = form.questions.findIndex((q) => q.id === nextId);
      return nextIndex >= 0 ? nextIndex : null;
    }

    if (strategy.type === 'conditional') {
      try {
        setIsLoadingTransition(true);

        const nextId = await getNextQuestionFromConditional(
          strategy.routes,
          answersToUse,
          formSlug
        );

        if (nextId !== undefined) {
          if (nextId === null) return null;
          const nextIndex = form.questions.findIndex((q) => q.id === nextId);
          return nextIndex >= 0 ? nextIndex : null;
        }

        if (strategy.defaultNext === null) return null;
        const nextIndex = form.questions.findIndex(
          (q) => q.id === strategy.defaultNext
        );
        return nextIndex >= 0 ? nextIndex : null;
      } catch (error) {
        console.error('Conditional transition failed:', error);

        if (strategy.defaultNext) {
          const nextIndex = form.questions.findIndex(
            (q) => q.id === strategy.defaultNext
          );
          if (nextIndex >= 0) return nextIndex;
        }

        const nextIdx = currentQuestionIndex + 1;
        return nextIdx < form.questions.length ? nextIdx : null;
      } finally {
        setIsLoadingTransition(false);
      }
    }

    return null;
  }

  function handleAnswerChange(value: AnswerValue, questionId?: string) {
    // Clear back navigation flag when user makes a new selection
    // This allows auto-advance to work after they change their answer
    justNavigatedBack.current = false;

    if (isGrouped && questionId) {
      // Update specific question in group
      setCurrentGroupAnswers((prev) => ({ ...prev, [questionId]: value }));
    } else {
      // Single question (backwards compatible)
      setCurrentAnswer(value);
    }

    // Check if all fields are now empty to determine interaction state
    const allEmpty = isGrouped
      ? currentQuestions.every((q) => {
          const val = q.id === questionId ? value : currentGroupAnswers[q.id];
          return !val || val === '' || (Array.isArray(val) && val.length === 0);
        })
      : !value || value === '' || (Array.isArray(value) && value.length === 0);

    setHasInteractedWithCurrentScreen(!allEmpty);

    // Clear any existing validation error when user types
    setValidationError('');
    resetAbandonmentTimer();
  }

  function handleBlur() {
    if (!currentQuestion) return;

    // Don't show validation errors for empty inputs on blur
    // Only validate when user tries to proceed with Continue button
    const isEmpty =
      currentAnswer === '' ||
      currentAnswer === null ||
      currentAnswer === undefined ||
      (Array.isArray(currentAnswer) && currentAnswer.length === 0);

    if (isEmpty) {
      setValidationError('');
      return;
    }

    const result = validateAnswer(currentQuestion, currentAnswer);
    if (!result.valid && result.error) {
      setValidationError(result.error);
    }
  }

  function validateCurrentQuestion(): boolean {
    if (isGrouped) {
      // Validate all questions in group
      return currentQuestions.every((q) => {
        const answer = currentGroupAnswers[q.id];
        const result = validateAnswer(q, answer);
        return result.valid;
      });
    } else {
      // Single question
      if (!currentQuestion) return false;
      const result = validateAnswer(currentQuestion, currentAnswer);
      return result.valid;
    }
  }

  function validateAndShowError(): boolean {
    if (isGrouped) {
      // Validate all questions in group
      const errors: string[] = [];
      for (const q of currentQuestions) {
        const answer = currentGroupAnswers[q.id];
        const result = validateAnswer(q, answer);
        if (!result.valid && result.error) {
          errors.push(`${q.text}: ${result.error}`);
        }
      }

      if (errors.length > 0) {
        setValidationError(errors[0]); // Show first error
        return false;
      }
      return true;
    } else {
      // Single question
      if (!currentQuestion) return false;
      const result = validateAnswer(currentQuestion, currentAnswer);

      if (!result.valid && result.error) {
        setValidationError(result.error);
      }

      return result.valid;
    }
  }

  // Create submission on first answer
  async function createSubmission(firstAnswer: Answer) {
    if (!form) {
      console.warn('No form - cannot create submission');
      return;
    }

    // Extract email/phone from answers using semantic roles
    const emailQuestion = form.questions.find(
      (q) => q.semanticRole === 'email' && q.isAuthIdentifier
    );
    const phoneQuestion = form.questions.find(
      (q) => q.semanticRole === 'phone' && q.isAuthIdentifier
    );

    if (!emailQuestion || !phoneQuestion) {
      throw new Error(
        'Form missing required auth identifier questions (email or phone)'
      );
    }

    // Check if first answer is the email or phone question
    const email =
      firstAnswer.questionId === emailQuestion.id
        ? firstAnswer.value
        : undefined;
    const phone =
      firstAnswer.questionId === phoneQuestion.id
        ? firstAnswer.value
        : undefined;

    try {
      const response = await fetch('/api/forms/submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formSlug: formSlug,
          sessionId: sessionId,
          email,
          phone,
          answers: [firstAnswer],
          currentQuestionId: currentQuestion?.id,
          currentQuestionIndex: currentQuestionIndex,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create submission');
      }

      const { submission } = await response.json();
      setSubmissionId(submission.id);
    } catch (error) {
      console.error('Failed to create submission:', error);
      // Don't block the user - they can continue filling the form
    }
  }

  // Update submission on each "Next" click
  async function updateSubmission(
    updatedAnswers: Answer[],
    nextQuestionId: string,
    nextQuestionIndex: number
  ) {
    if (!submissionId || !form) {
      console.warn('No submission ID or form - cannot save progress');
      return;
    }

    // Extract email/phone from answers using semantic roles
    const emailQuestion = form.questions.find(
      (q) => q.semanticRole === 'email' && q.isAuthIdentifier
    );
    const phoneQuestion = form.questions.find(
      (q) => q.semanticRole === 'phone' && q.isAuthIdentifier
    );

    if (!emailQuestion || !phoneQuestion) {
      throw new Error(
        'Form missing required auth identifier questions (email or phone)'
      );
    }

    const emailAnswer = updatedAnswers.find(
      (a) => a.questionId === emailQuestion.id
    );
    const phoneAnswer = updatedAnswers.find(
      (a) => a.questionId === phoneQuestion.id
    );

    try {
      await fetch('/api/forms/submission', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          answers: updatedAnswers,
          currentQuestionId: nextQuestionId,
          currentQuestionIndex: nextQuestionIndex,
          email: emailAnswer?.value,
          phone: phoneAnswer?.value,
        }),
      });
    } catch (error) {
      console.error('Failed to update submission:', error);
      // Don't block the user - they can continue filling the form
    }
  }

  async function handleNext() {
    if (!currentQuestion || !form) return;

    if (!validateAndShowError()) {
      return;
    }

    // Collect answers from current screen (grouped or single)
    // Skip informational questions - they don't collect answers
    const newAnswers: Answer[] = isGrouped
      ? currentQuestions
          .filter((q) => q.type !== 'informational')
          .map((q) => ({
            questionId: q.id,
            questionText: q.text,
            value: currentGroupAnswers[q.id],
            answeredAt: new Date().toISOString(),
          }))
      : currentQuestion.type === 'informational'
      ? []
      : [
          {
            questionId: currentQuestion.id,
            questionText: currentQuestion.text,
            value: currentAnswer,
            answeredAt: new Date().toISOString(),
          },
        ];

    const updatedAnswers = [...answers, ...newAnswers];
    setAnswers(updatedAnswers);

    // Track answer with timing
    const timeSpent = (Date.now() - questionViewedAt.current) / 1000;
    posthog?.capture('question_answered', {
      form_id: form.id,
      form_name: form.name,
      session_id: sessionId,
      question_id: currentQuestion.id,
      question_text: currentQuestion.text,
      question_type: currentQuestion.type,
      question_index: currentQuestionIndex,
      time_spent_seconds: timeSpent,
      has_answer: true,
    });

    // Create or update submission
    // Only create submission when we have an actual answer (not for informational questions)
    if (!submissionId && newAnswers.length > 0) {
      await createSubmission(newAnswers[0]);
    }

    // Get next question index (use last question in group if grouped)
    const lastQuestionInCurrentScreen = isGrouped
      ? currentQuestions[currentQuestions.length - 1]
      : currentQuestion;

    const nextIndex = await getNextQuestionIndex(
      lastQuestionInCurrentScreen,
      updatedAnswers
    );

    if (nextIndex === null) {
      // Form complete
      if (submissionId) {
        await updateSubmission(
          updatedAnswers,
          currentQuestion.id,
          currentQuestionIndex
        );
        await fetch('/api/forms/submission', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId,
            status: 'completed',
          }),
        });
      }
      await submitForm(updatedAnswers);
    } else {
      // Progress to next question
      const nextQuestion = form.questions[nextIndex];

      if (submissionId) {
        await updateSubmission(updatedAnswers, nextQuestion.id, nextIndex);
      }

      // Track progress
      posthog?.capture('question_progressed', {
        form_id: form.id,
        session_id: sessionId,
        from_question_id: currentQuestion.id,
        to_question_id: nextQuestion.id,
        timestamp: Date.now(),
      });

      setDirection(1);
      setCurrentQuestionIndex(nextIndex);
      setQuestionHistory([...questionHistory, nextIndex]); // Track navigation path
      setCurrentAnswer('');
      setCurrentGroupAnswers({}); // Clear group answers
      setValidationError('');
    }
  }

  function handleBack() {
    if (questionHistory.length > 1) {
      setDirection(-1);
      justNavigatedBack.current = true; // Prevent auto-advance on return

      // Remove current question from history
      const newHistory = questionHistory.slice(0, -1);
      const previousIndex = newHistory[newHistory.length - 1];

      // Track backtrack
      if (form && currentQuestion) {
        posthog?.capture('question_backtracked', {
          form_id: form.id,
          session_id: sessionId,
          from_question_id: currentQuestion.id,
          to_question_id: form.questions[previousIndex].id,
          timestamp: Date.now(),
        });
      }

      setQuestionHistory(newHistory);
      setCurrentQuestionIndex(previousIndex);

      // Restore previous answer(s)
      const previousQuestion = form?.questions[previousIndex];
      if (previousQuestion && form) {
        // Check if previous question is part of a group
        const previousGroup = form.groups?.find((g) =>
          g.questionIds.includes(previousQuestion.id)
        );

        if (previousGroup) {
          // Restore all answers for the group
          const groupAnswersMap: Record<string, AnswerValue> = {};
          const groupQuestionIds = previousGroup.questionIds;

          for (const qid of groupQuestionIds) {
            const answer = answers.find((a) => a.questionId === qid);
            if (answer) {
              groupAnswersMap[qid] = answer.value;
            }
          }

          setCurrentGroupAnswers(groupAnswersMap);
          setCurrentAnswer('');

          // Remove all group answers from answers array
          setAnswers(
            answers.filter((a) => !groupQuestionIds.includes(a.questionId))
          );
        } else {
          // Single question - restore single answer
          const previousAnswer = answers.find(
            (a) => a.questionId === previousQuestion.id
          );
          setCurrentAnswer(previousAnswer?.value || '');
          setCurrentGroupAnswers({});

          // Remove the last answer from answers array
          setAnswers(answers.slice(0, -1));
        }
      }

      setValidationError('');
    }
  }

  // Auto-advance for single-select multiple choice questions
  useEffect(() => {
    // Skip if loading, complete, transitioning, or no form
    if (isLoadingTransition || isComplete || !form) return;

    const question = form.questions[currentQuestionIndex];
    if (!question) return;

    // Only auto-advance for single-select multiple choice
    const isSingleSelectMultipleChoice =
      question.type === 'multiple_choice' &&
      (question.maxSelections === undefined || question.maxSelections === 1);

    if (!isSingleSelectMultipleChoice) return;

    // Check if user has selected an option
    if (!currentAnswer) return;

    // Skip auto-advance if user just navigated back (let them review their answer)
    if (justNavigatedBack.current) {
      return;
    }

    // Small delay for visual feedback before advancing
    const timer = setTimeout(() => {
      handleNext();
    }, 300);

    return () => clearTimeout(timer);
  }, [
    currentAnswer,
    currentQuestionIndex,
    isLoadingTransition,
    isComplete,
    form,
  ]);

  async function submitForm(finalAnswers: Answer[]) {
    if (!form) return;

    try {
      // Extract user profile from answers
      const profile = extractUserProfile(form, finalAnswers);

      if (!profile || !submissionId || !botId || !orgId) {
        console.error('Missing required data for form completion:', {
          hasProfile: !!profile,
          hasSubmissionId: !!submissionId,
          hasBotId: !!botId,
          hasOrgId: !!orgId,
        });
        // Fallback to simple completion screen
        setCompletionId(`completion-${Date.now()}`);
        setIsComplete(true);
        return;
      }

      // Set completion data to show SMS verification screen
      // (SMS will be sent by CompletionScreen component via Clerk)
      setCompletionData({
        profile,
        submissionId,
        botId,
        orgId,
      });
      setIsComplete(true);

      // Track completion with total time
      const totalTime = (Date.now() - formStartedAt.current) / 1000;
      posthog?.capture('form_completed', {
        form_id: form.id,
        form_name: form.name,
        session_id: sessionId,
        total_time_seconds: totalTime,
        questions_answered: finalAnswers.length,
      });
    } catch (error) {
      console.error('Failed to submit form:', error);
      alert('Failed to submit form. Please try again.');
    }
  }

  const renderInput = (
    question?: Question,
    value?: AnswerValue,
    onChange?: (val: AnswerValue) => void,
    autoFocus: boolean = true,
    hideLabel: boolean = false
  ) => {
    // Use provided params or fall back to current state (for single questions)
    const q = question || currentQuestion;
    const val = value !== undefined ? value : currentAnswer;
    const onChangeHandler = onChange || handleAnswerChange;

    if (!q) return null;

    const commonProps = {
      value: val,
      onChange: onChangeHandler,
      onEnter: handleNext,
      onBlur: handleBlur,
      autoFocus,
      hideLabel,
    };

    switch (q.type) {
      case 'short_text':
        return (
          <ShortTextInput
            question={q}
            {...commonProps}
          />
        );
      case 'email':
        return (
          <EmailInput
            question={q}
            {...commonProps}
          />
        );
      case 'phone':
        return (
          <PhoneInput
            question={q}
            {...commonProps}
          />
        );
      case 'long_text':
        return (
          <LongTextInput
            question={q}
            {...commonProps}
          />
        );
      case 'number_input':
        return (
          <NumberInput
            question={q}
            {...commonProps}
          />
        );
      case 'multiple_choice':
        return (
          <MultipleChoiceInput
            question={q}
            {...commonProps}
          />
        );
      case 'likert_scale':
        return (
          <LikertScaleInput
            question={q}
            {...commonProps}
          />
        );
      case 'informational':
        return (
          <InformationalDisplay
            question={q as InformationalQuestion}
            generatedContent={llmContentCache[q.id]}
            isLoading={isLoadingContent}
            botAvatarUrl={botAvatarUrl}
            botDisplayName={botDisplayName}
          />
        );
      default:
        return null;
    }
  };

  const isValid = validateCurrentQuestion();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-50 flex items-center justify-center">
        <Loader2
          className="w-12 h-12 text-primary animate-spin"
          style={{
            color: theme.primary,
          }}
        />
      </div>
    );
  }

  // Error state - validation or loading errors
  if (loadError) {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg text-center space-y-4">
          <div className="text-6xl">⚠️</div>
          <h1 className="text-2xl font-display font-bold text-slate-900">
            Form Configuration Error
          </h1>
          <p className="text-slate-600">{loadError}</p>
          <p className="text-sm text-slate-400">
            Please contact the form administrator to fix this issue.
          </p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!form || form.questions.length === 0) {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-xl text-slate-600">Form not found</p>
        </div>
      </div>
    );
  }

  // Completion screen - Show SMS verification if we have phone data
  if (isComplete) {
    if (completionData) {
      return (
        <CompletionScreen
          profile={completionData.profile}
          submissionId={completionData.submissionId}
          botId={completionData.botId}
          orgId={completionData.orgId}
        />
      );
    }

    // Fallback to simple completion screen (shouldn't happen)
    return (
      <div className="min-h-[100dvh] w-full bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-400/20 rounded-full blur-[100px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-400/20 rounded-full blur-[100px] animate-blob animation-delay-2000" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-12 text-center relative z-10"
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center shadow-lg text-white">
              <CheckCircle2 size={32} />
            </div>
          </div>

          {/* Success message */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 font-display"
          >
            Thank You!
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-base md:text-lg text-slate-600 mb-8 leading-relaxed"
          >
            Your responses have been submitted successfully. We're excited to
            help you on your journey.
          </motion.p>

          {/* Optional: Completion ID */}
          {completionId && (
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xs text-slate-400 font-mono mb-8"
            >
              Reference: {completionId}
            </motion.p>
          )}

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex flex-col items-center"
          >
            <button
              onClick={() => (window.location.href = '/chat')}
              className="w-1/3 md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform"
            >
              Continue to Chat
            </button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Main form UI
  return (
    <AnimatePresence mode="wait">
      {showWelcome && form.welcome ? (
        <WelcomeScreen
          key="welcome"
          botName={botDisplayName}
          botAvatarUrl={botAvatarUrl}
          welcome={form.welcome}
          onStart={() => setShowWelcome(false)}
        />
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen w-full flex flex-col items-center font-sans"
          style={{ backgroundColor: theme.bgOuter }}
        >
          {/* Progress Bar */}
          <div
            className="w-full h-1.5 fixed top-0 left-0 z-50"
            style={{ backgroundColor: theme.progressBg }}
          >
            <motion.div
              className="h-full transition-all duration-500 ease-out"
              style={{
                backgroundColor: theme.progressFill,
                width: `${progress}%`,
              }}
            />
          </div>

          {/* Main Container */}
          <div
            className="w-full max-w-lg md:max-w-full min-h-screen shadow-xl flex flex-col relative"
            style={{ backgroundColor: theme.bgContainer }}
          >
            {/* Header - Fixed at top of container */}
            <header
              className="w-full flex justify-center pt-4 pb-2 md:pt-8 md:pb-4 px-4 md:px-6 shrink-0 z-10"
              style={{ backgroundColor: theme.bgContainer }}
            >
              <div className="flex items-center gap-3 -ml-[52px]">
                {botAvatarUrl && (
                  <div className="relative">
                    <img
                      src={botAvatarUrl}
                      alt={botDisplayName || form.name}
                      className="w-8 h-8 rounded-full object-cover shadow-sm"
                    />
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-[2px]"
                      style={{
                        backgroundColor: theme.statusOnline,
                        borderColor: theme.bgContainer,
                      }}
                    />
                  </div>
                )}
                <span
                  className="text-lg font-bold tracking-tight"
                  style={{ color: theme.textHeading }}
                >
                  {botDisplayName || form.name}
                </span>
              </div>
            </header>

            {/* Content - Vertically Centered */}
            <main className="flex-1 flex flex-col justify-center px-6 md:px-20 pb-20 md:pb-24 min-h-0">
              {isLoadingTransition ? (
                <div className="flex flex-col items-center justify-center space-y-6">
                  <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
                  <Typewriter
                    text="Thinking..."
                    className="text-xl text-slate-500 font-light text-center justify-center"
                    delay={0.2}
                  />
                </div>
              ) : (
                <AnimatePresence
                  mode="wait"
                  initial={false}
                  custom={direction}
                >
                  <motion.div
                    key={currentQuestionIndex}
                    custom={direction}
                    initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full"
                  >
                    {isGrouped ? (
                      // Render grouped questions
                      <>
                        {/* Group Title with Step Number + Arrow */}
                        {currentGroup?.title && (
                          <div className="flex flex-row gap-2 md:gap-3 mb-4 md:mb-8 -ml-12 md:-ml-16">
                            {/* Hanging Number Block */}
                            <div className="flex items-start justify-end w-10 md:w-12 shrink-0 pt-0.5 md:pt-1">
                              <span
                                className="font-bold text-lg md:text-2xl leading-none"
                                style={{ color: theme.primary }}
                              >
                                {getScreenNumber(currentQuestionIndex)}
                              </span>
                              <ArrowRight
                                className="ml-1 mt-[1px] md:mt-[2px] w-3.5 h-3.5 md:w-4 md:h-4"
                                strokeWidth={2.5}
                                style={{ color: theme.primary }}
                              />
                            </div>
                            <h2
                              className="text-lg md:text-2xl font-bold leading-snug"
                              style={{ color: theme.textHeading }}
                            >
                              {currentGroup.title}
                            </h2>
                          </div>
                        )}

                        {/* Grouped Input Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                          {currentQuestions.map((q, idx) => (
                            <div
                              key={q.id}
                              className="w-full"
                            >
                              {renderInput(
                                q,
                                currentGroupAnswers[q.id],
                                (val) => handleAnswerChange(val, q.id),
                                idx === 0
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Validation Error Message */}
                        {validationError && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-8 text-sm text-center"
                            style={{ color: theme.error }}
                          >
                            {validationError}
                          </motion.p>
                        )}
                      </>
                    ) : (
                      // Render single question
                      <>
                        {/* Hide QuestionHeader for informational questions */}
                        {currentQuestion?.type !== 'informational' && (
                          <QuestionHeader
                            stepNumber={getScreenNumber(currentQuestionIndex)}
                            questionText={currentQuestion?.text || ''}
                            subtext={currentQuestion?.subtext}
                            required={currentQuestion?.required}
                          />
                        )}

                        {/* Input Area */}
                        <div
                          className={
                            currentQuestion?.type === 'informational'
                              ? 'w-full'
                              : 'w-full mt-4 md:mt-6'
                          }
                        >
                          {renderInput(
                            undefined,
                            undefined,
                            undefined,
                            true,
                            true
                          )}

                          {/* Validation Error Message */}
                          {validationError && (
                            <motion.p
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="mt-4 text-sm text-center"
                              style={{ color: theme.error }}
                            >
                              {validationError}
                            </motion.p>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </main>

            {/* Footer */}
            <footer
              className="w-full px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4 backdrop-blur-sm fixed bottom-0 max-w-lg md:max-w-full z-20 flex justify-center"
              style={{
                backgroundColor: theme.bgFooter,
                borderColor: theme.borderLight,
              }}
            >
              <div className="flex gap-3 w-full md:w-1/3">
                {currentQuestionIndex > 0 && !isLoadingTransition && (
                  <button
                    onClick={handleBack}
                    className="h-12 w-12 flex items-center justify-center rounded-lg shadow-md hover:opacity-90 active:scale-95 transition-all"
                    style={{
                      backgroundColor: theme.primary,
                      color: theme.bgContainer,
                    }}
                  >
                    <ChevronLeft
                      size={28}
                      strokeWidth={3}
                    />
                  </button>
                )}

                {!isLoadingTransition && (
                  <button
                    onClick={handleNext}
                    disabled={!isValid}
                    className={clsx(
                      'flex-1 rounded-lg font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                      currentQuestion?.buttonText
                        ? 'py-3 px-4 text-base leading-tight' // Custom text: more padding, slightly smaller text
                        : 'h-12 text-lg tracking-wide uppercase' // Default "OK": fixed height
                    )}
                    style={{
                      backgroundColor: theme.primary,
                      color: theme.bgContainer,
                    }}
                  >
                    {currentQuestion?.buttonText || 'OK'}
                  </button>
                )}
              </div>
            </footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function FormPage() {
  return (
    <div className={`${oswald.variable} ${inter.variable}`}>
      <FormThemeProvider>
        <FormPageContent />
      </FormThemeProvider>
    </div>
  );
}
