"use client"

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export interface UploadProgress {
  stage: 'idle' | 'preparing' | 'uploading' | 'storing' | 'processing' | 'indexing' | 'completed' | 'error'
  progress: number // 0-100
  message: string
  timeRemaining?: number // in milliseconds
  error?: string
}

export interface UploadResult {
  success: boolean
  documentId?: string
  error?: string
}

const PROGRESS_STAGES = {
  preparing: { min: 0, max: 10, message: 'Preparing upload...' },
  uploading: { min: 10, max: 40, message: 'Uploading file...' },
  storing: { min: 40, max: 60, message: 'Storing in database...' },
  processing: { min: 60, max: 80, message: 'Processing content...' },
  indexing: { min: 80, max: 95, message: 'Adding to knowledge base...' },
  completed: { min: 100, max: 100, message: 'Complete! Ready in chatbot.' }
}

export function useUploadProgress() {
  const [progress, setProgress] = useState<UploadProgress>({
    stage: 'idle',
    progress: 0,
    message: 'Ready to upload'
  })

  const updateProgress = useCallback((
    stage: UploadProgress['stage'],
    subProgress: number = 0,
    customMessage?: string,
    timeRemaining?: number,
    error?: string
  ) => {
    if (stage === 'error') {
      setProgress({
        stage: 'error',
        progress: 0,
        message: customMessage || 'Upload failed',
        error
      })
      return
    }

    const stageInfo = PROGRESS_STAGES[stage as keyof typeof PROGRESS_STAGES]
    if (!stageInfo) return

    const stageProgress = Math.min(100, Math.max(0, subProgress))
    const overallProgress = stageInfo.min + (stageProgress * (stageInfo.max - stageInfo.min) / 100)

    setProgress({
      stage,
      progress: Math.round(overallProgress),
      message: customMessage || stageInfo.message,
      timeRemaining,
      error: undefined
    })
  }, [])

  const uploadFile = useCallback(async (file: File, description?: string, botId?: string): Promise<UploadResult> => {
    try {
      // Validate file
      if (!file) {
        updateProgress('error', 0, 'No file provided')
        return { success: false, error: 'No file provided' }
      }

      if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
        updateProgress('error', 0, 'Only .txt files are supported')
        return { success: false, error: 'Only .txt files are supported' }
      }

      const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
      if (file.size > MAX_FILE_SIZE) {
        updateProgress('error', 0, 'File must be less than 10MB')
        return { success: false, error: 'File must be less than 10MB' }
      }

      // Calculate estimated time
      const fileSizeKB = file.size / 1024
      const BASE_UPLOAD_TIME = 1000
      const UPLOAD_TIME_PER_KB = 50
      const PROCESSING_TIME_PER_KB = 100
      
      const estimatedTotal = BASE_UPLOAD_TIME + 
                           (fileSizeKB * UPLOAD_TIME_PER_KB) + 
                           (fileSizeKB * PROCESSING_TIME_PER_KB)
      
      // Add buffer time for Graphiti processing (minimum 30 seconds, up to 2 minutes for larger files)
      const graphitiBuffer = Math.max(30000, Math.min(120000, fileSizeKB * 200))
      const totalWithBuffer = estimatedTotal + graphitiBuffer

      // Stage 1: Preparing
      updateProgress('preparing', 50, 'Validating file...', totalWithBuffer)
      await new Promise(resolve => setTimeout(resolve, 500)) // Brief delay for UX

      updateProgress('preparing', 100, 'File validated, starting upload...', totalWithBuffer - 500)

      // Stage 2: Uploading
      const formData = new FormData()
      formData.append('file', file)
      if (description) {
        formData.append('description', description)
      }
      if (botId) {
        formData.append('botId', botId)
      }

      updateProgress('uploading', 0, 'Connecting to server...', totalWithBuffer - 1000)

      const uploadStartTime = Date.now()
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const uploadEndTime = Date.now()
      const uploadDuration = uploadEndTime - uploadStartTime
      const remainingTime = Math.max(0, totalWithBuffer - uploadDuration)

      if (!response.ok) {
        const errorData = await response.json()
        updateProgress('error', 0, errorData.error || 'Upload failed')
        return { success: false, error: errorData.error || 'Upload failed' }
      }

      const result = await response.json()

      if (!result.success) {
        updateProgress('error', 0, result.error || 'Upload failed')
        return { success: false, error: result.error || 'Upload failed' }
      }

      // Stage 3: Storing
      updateProgress('storing', 100, 'File uploaded successfully', remainingTime)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Stage 4: Processing (async - don't wait for completion)
      updateProgress('processing', 50, 'Background processing started...', 1000)
      await new Promise(resolve => setTimeout(resolve, 500)) // Brief delay for UX

      // Complete immediately - processing continues in background
      updateProgress('completed', 100, 'Upload successful! Processing continues in background.')
      
      const documentId = result.documentId
      return { success: true, documentId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      updateProgress('error', 0, errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [updateProgress])

  const reset = useCallback(() => {
    setProgress({
      stage: 'idle',
      progress: 0,
      message: 'Ready to upload'
    })
  }, [])

  return {
    progress,
    uploadFile,
    reset
  }
}

async function pollProcessingStatus(
  documentId: string, 
  maxWaitTime: number,
  updateProgress: (stage: UploadProgress['stage'], subProgress: number, message?: string, timeRemaining?: number) => void
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const startTime = Date.now()
  const pollInterval = 1000 // Poll every second
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const { data: document, error } = await supabase
        .from('document')
        .select('processing_status')
        .eq('id', documentId)
        .single()

      if (error) {
        return { success: false, error: 'Failed to check processing status' }
      }

      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, maxWaitTime - elapsed)
      
      switch (document.processing_status) {
        case 'completed':
          updateProgress('indexing', 100, 'Knowledge base updated successfully', 0)
          return { success: true }
        
        case 'failed':
          return { success: false, error: 'Document processing failed' }
        
        case 'processing':
          // Calculate progress based on elapsed time
          const progressPercent = Math.min(90, (elapsed / maxWaitTime) * 100)
          
          if (elapsed < maxWaitTime * 0.4) {
            updateProgress('processing', progressPercent * 2, 'Extracting content...', remaining)
          } else if (elapsed < maxWaitTime * 0.8) {
            updateProgress('indexing', (progressPercent - 40) * 2, 'Building knowledge graph...', remaining)
          } else {
            updateProgress('indexing', 80 + (progressPercent - 80) * 0.5, 'Finalizing indexing...', remaining)
          }
          break
        
        default:
          updateProgress('processing', 10, 'Queued for processing...', remaining)
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      return { success: false, error: 'Error checking processing status' }
    }
  }

  // Timeout
  return { success: false, error: 'Processing timeout - please check back later' }
}