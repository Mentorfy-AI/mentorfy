'use client'

import { usePostHog } from 'posthog-js/react'
import { useCallback, useMemo, useRef } from 'react'

export interface AnalyticsContext {
  session_id: string
  flow_id: string
}

export function useAnalytics(context: AnalyticsContext) {
  const posthog = usePostHog()

  // Timers for duration tracking
  const stepStartTime = useRef<number>(Date.now())
  const phaseStartTime = useRef<number>(Date.now())

  // Base properties included in every event
  const baseProps = useMemo(() => ({
    session_id: context.session_id,
    flow_id: context.flow_id,
  }), [context.session_id, context.flow_id])

  const startStepTimer = useCallback(() => {
    stepStartTime.current = Date.now()
  }, [])

  const startPhaseTimer = useCallback(() => {
    phaseStartTime.current = Date.now()
  }, [])

  // ─────────────────────────────────────────────────────────────
  // flow_started
  // ─────────────────────────────────────────────────────────────
  const trackFlowStarted = useCallback(
    (props?: { utm_source?: string | null; utm_campaign?: string | null }) => {
      posthog?.capture('flow_started', {
        ...baseProps,
        utm_source: props?.utm_source ?? null,
        utm_campaign: props?.utm_campaign ?? null,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // step_completed
  // ─────────────────────────────────────────────────────────────
  const trackStepCompleted = useCallback(
    (props: {
      stepIndex: number          // Overall position in flow (0-indexed across all phases)
      phaseId: number
      phaseName: string
      phaseStepIndex: number     // Position within this phase (0-indexed)
      stepType: string
      stepKey: string            // Unique identifier for this step (e.g., 'q1-models-tried')
      answerKey?: string         // Which question (null for non-questions)
      answerValue?: string       // Multiple choice value (null for long-form)
      answerText?: string        // Full long-form text (null for multiple choice)
    }) => {
      const timeOnStep = Date.now() - stepStartTime.current
      posthog?.capture('step_completed', {
        ...baseProps,
        step_id: `phase-${props.phaseId}-step-${props.phaseStepIndex}`,
        step_key: props.stepKey,
        step_type: props.stepType,
        step_index: props.stepIndex,
        phase_id: props.phaseId,
        phase_name: props.phaseName,
        phase_step_index: props.phaseStepIndex,
        time_on_step_ms: timeOnStep,
        answer_key: props.answerKey ?? null,
        answer_value: props.answerValue ?? null,
        answer_text: props.answerText ?? null,
        answer_length: props.answerText?.length ?? props.answerValue?.length ?? null,
      })
      // Reset timer for next step
      stepStartTime.current = Date.now()
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // phase_completed
  // ─────────────────────────────────────────────────────────────
  const trackPhaseCompleted = useCallback(
    (props: {
      phaseId: number
      phaseName: string
      phasesCompletedSoFar: number[]
    }) => {
      const timeInPhase = Date.now() - phaseStartTime.current
      posthog?.capture('phase_completed', {
        ...baseProps,
        phase_id: props.phaseId,
        phase_name: props.phaseName,
        phases_completed_so_far: props.phasesCompletedSoFar,
        time_in_phase_ms: timeInPhase,
      })
      // Reset timer for next phase
      phaseStartTime.current = Date.now()
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // chat_opened
  // ─────────────────────────────────────────────────────────────
  const trackChatOpened = useCallback(
    (props: { phasesCompleted: number[]; chatAfterPhase: number }) => {
      posthog?.capture('chat_opened', {
        ...baseProps,
        phases_completed: props.phasesCompleted,
        chat_after_phase: props.chatAfterPhase,  // Which phase was just completed
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // chat_message_sent
  // ─────────────────────────────────────────────────────────────
  const trackChatMessage = useCallback(
    (props: {
      messageIndex: number
      messageLength: number
      phasesCompleted: number[]
      chatAfterPhase: number
    }) => {
      posthog?.capture('chat_message_sent', {
        ...baseProps,
        phases_completed: props.phasesCompleted,
        chat_after_phase: props.chatAfterPhase,
        message_index: props.messageIndex,
        message_length: props.messageLength,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // embed_shown
  // ─────────────────────────────────────────────────────────────
  const trackEmbedShown = useCallback(
    (props: {
      embedType: 'checkout' | 'booking' | 'video'
      source: 'sales_page' | 'chat'
      phasesCompleted: number[]
    }) => {
      posthog?.capture('embed_shown', {
        ...baseProps,
        embed_type: props.embedType,
        source: props.source,
        phases_completed: props.phasesCompleted,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // booking_clicked
  // ─────────────────────────────────────────────────────────────
  const trackBookingClicked = useCallback(
    (props: {
      source: 'sales_page' | 'chat' | 'diagnosis_sequence'
      phasesCompleted: number[]
      stepId?: string            // If source = sales_page
      chatMessageIndex?: number  // If source = chat
    }) => {
      posthog?.capture('booking_clicked', {
        ...baseProps,
        source: props.source,
        phases_completed: props.phasesCompleted,
        step_id: props.stepId ?? null,
        chat_message_index: props.chatMessageIndex ?? null,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // identify (call when contact info submitted)
  // ─────────────────────────────────────────────────────────────
  const identify = useCallback(
    (props: { email: string; name?: string; phone?: string }) => {
      posthog?.identify(context.session_id, {
        email: props.email,
        name: props.name,
        phone: props.phone,
        flow_id: context.flow_id,
      })
    },
    [posthog, context]
  )

  // ─────────────────────────────────────────────────────────────
  // disqualified
  // ─────────────────────────────────────────────────────────────
  const trackDisqualified = useCallback(
    (props: {
      reason: string
      triggerStep: string
      triggerValue: string
      headline: string
      timeInFlowMs: number
    }) => {
      posthog?.capture('disqualified', {
        ...baseProps,
        disqualification_reason: props.reason,
        trigger_step: props.triggerStep,
        trigger_value: props.triggerValue,
        headline: props.headline,
        time_in_flow_ms: props.timeInFlowMs,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // loading_started
  // ─────────────────────────────────────────────────────────────
  const trackLoadingStarted = useCallback(() => {
    posthog?.capture('loading_started', {
      ...baseProps,
      contact_gate_completed: true,
    })
  }, [posthog, baseProps])

  // ─────────────────────────────────────────────────────────────
  // loading_completed
  // ─────────────────────────────────────────────────────────────
  const trackLoadingCompleted = useCallback(
    (props: {
      loadingDurationMs: number
      generationSuccess: boolean
      errorMessage?: string | null
    }) => {
      posthog?.capture('loading_completed', {
        ...baseProps,
        loading_duration_ms: props.loadingDurationMs,
        generation_success: props.generationSuccess,
        error_message: props.errorMessage ?? null,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // diagnosis_started
  // ─────────────────────────────────────────────────────────────
  const trackDiagnosisStarted = useCallback(
    (props: {
      generationDurationMs: number
      totalQuestionsAnswered: number
    }) => {
      posthog?.capture('diagnosis_started', {
        ...baseProps,
        generation_duration_ms: props.generationDurationMs,
        total_questions_answered: props.totalQuestionsAnswered,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // diagnosis_screen_viewed
  // ─────────────────────────────────────────────────────────────
  const trackDiagnosisScreenViewed = useCallback(
    (props: {
      screenIndex: number
      screenTotal: number
      timeOnPreviousScreenMs: number | null
      isFinalScreen: boolean
    }) => {
      posthog?.capture('diagnosis_screen_viewed', {
        ...baseProps,
        screen_index: props.screenIndex,
        screen_total: props.screenTotal,
        time_on_previous_screen_ms: props.timeOnPreviousScreenMs,
        is_final_screen: props.isFinalScreen,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // diagnosis_completed
  // ─────────────────────────────────────────────────────────────
  const trackDiagnosisCompleted = useCallback(
    (props: {
      totalDiagnosisTimeMs: number
      screensViewed: number
      averageTimePerScreenMs: number
    }) => {
      posthog?.capture('diagnosis_completed', {
        ...baseProps,
        total_diagnosis_time_ms: props.totalDiagnosisTimeMs,
        screens_viewed: props.screensViewed,
        average_time_per_screen_ms: props.averageTimePerScreenMs,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // diagnosis_screen_scrolled
  // ─────────────────────────────────────────────────────────────
  const trackDiagnosisScreenScrolled = useCallback(
    (props: {
      screenIndex: number
      scrollDepthPercent: 25 | 50 | 75 | 100
      timeToReachDepthMs: number
    }) => {
      posthog?.capture('diagnosis_screen_scrolled', {
        ...baseProps,
        screen_index: props.screenIndex,
        scroll_depth_percent: props.scrollDepthPercent,
        time_to_reach_depth_ms: props.timeToReachDepthMs,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // cta_viewed
  // ─────────────────────────────────────────────────────────────
  const trackCtaViewed = useCallback(
    (props: {
      ctaType: string
      timeSinceDiagnosisStartMs: number
      diagnosisScreensViewed: number
    }) => {
      posthog?.capture('cta_viewed', {
        ...baseProps,
        cta_type: props.ctaType,
        time_since_diagnosis_start_ms: props.timeSinceDiagnosisStartMs,
        diagnosis_screens_viewed: props.diagnosisScreensViewed,
      })
    },
    [posthog, baseProps]
  )

  return {
    startStepTimer,
    startPhaseTimer,
    trackFlowStarted,
    trackStepCompleted,
    trackPhaseCompleted,
    trackChatOpened,
    trackChatMessage,
    trackEmbedShown,
    trackBookingClicked,
    identify,
    trackDisqualified,
    trackLoadingStarted,
    trackLoadingCompleted,
    trackDiagnosisStarted,
    trackDiagnosisScreenViewed,
    trackDiagnosisCompleted,
    trackDiagnosisScreenScrolled,
    trackCtaViewed,
  }
}
