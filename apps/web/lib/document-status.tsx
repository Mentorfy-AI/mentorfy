export interface StatusBadgeConfig {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  iconName?: string // Icon name instead of React component
  className?: string
}

export interface PipelineJobMetadata {
  retry_at?: string
  retry_count?: number
  last_error?: string
  source_name?: string
  source_platform?: string
}

export interface PipelineJob {
  status: 'processing' | 'completed' | 'failed'
  current_phase: string
  metadata?: PipelineJobMetadata | null
}

export interface RetryInfo {
  isRetrying: boolean
  retryInMinutes: number | null
  retryCount: number | null
  lastError: string | null
}

/**
 * Get retry information from pipeline job metadata.
 * Returns info about whether job is waiting for retry and when.
 */
export function getRetryInfo(metadata?: PipelineJobMetadata | null): RetryInfo {
  if (!metadata?.retry_at) {
    return { isRetrying: false, retryInMinutes: null, retryCount: null, lastError: null }
  }

  const diffMs = new Date(metadata.retry_at).getTime() - Date.now()
  if (diffMs <= 0) {
    // Retry time has passed, should be actively processing now
    return { isRetrying: false, retryInMinutes: null, retryCount: null, lastError: null }
  }

  return {
    isRetrying: true,
    retryInMinutes: Math.ceil(diffMs / 60000),
    retryCount: metadata.retry_count ?? null,
    lastError: metadata.last_error ?? null,
  }
}

export type ProcessingStatus =
  | 'pending_upload'
  | 'uploaded'
  | 'processing'
  | 'retrying'
  | 'available_to_ai'
  | 'failed'
  | 'ready'
  | 'indexing'
  | 'importing'
  | 'import_complete'
  | 'chunk_complete'
  | 'ingesting'
  | 'ingest_complete'
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'embedding'

/**
 * Derive display status from pipeline_job (new pipeline) or processing_status (legacy).
 *
 * New pipeline documents have pipeline_job with status tracking.
 * Legacy documents only have processing_status field.
 */
export function deriveDocumentStatus(
  documentId: string,
  pipeline_job: PipelineJob | null | undefined,
  processing_status: ProcessingStatus
): ProcessingStatus {
  if (!pipeline_job) {
    // Legacy document or document without pipeline tracking
    return processing_status === 'available_to_ai' ? 'ingest_complete' : processing_status
  }

  // New pipeline: derive from pipeline_job state
  if (pipeline_job.status === 'failed') {
    return 'failed'
  }

  if (pipeline_job.status === 'completed') {
    return 'ingest_complete'
  }

  // Processing: map phase to display status
  switch (pipeline_job.current_phase) {
    case 'ingestion':
      return 'importing'
    case 'extraction':
      return 'extracting'
    case 'chunking':
      return 'chunking'
    case 'kg_ingest':
      return 'ingesting'
    default:
      return 'processing'
  }
}

export function getStatusBadgeConfig(status: ProcessingStatus): StatusBadgeConfig {
  switch (status) {
    // New phased pipeline statuses
    case 'importing':
      return {
        label: 'Importing',
        variant: 'secondary',
        iconName: 'FileJson',
        className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
      }
    case 'import_complete':
      return {
        label: 'Import Complete',
        variant: 'outline',
        iconName: 'CheckSquare',
        className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      }
    case 'chunk_complete':
      return {
        label: 'Chunked',
        variant: 'default',
        iconName: 'Check',
        className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      }
    case 'ingesting':
      return {
        label: 'Ingesting',
        variant: 'default',
        iconName: 'BookOpen',
        className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
      }
    case 'ingest_complete':
      return {
        label: 'Available',
        variant: 'default',
        iconName: 'CheckCircle2',
        className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      }

    // Legacy/common statuses
    case 'queued':
      return {
        label: 'Queued',
        variant: 'outline',
        iconName: 'Clock',
        className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30',
      }
    case 'extracting':
      return {
        label: 'Extracting',
        variant: 'secondary',
        iconName: 'FileJson',
        className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
      }
    case 'chunking':
      return {
        label: 'Chunking',
        variant: 'secondary',
        iconName: 'FileJson',
        className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
      }
    case 'embedding':
      return {
        label: 'Embedding',
        variant: 'default',
        iconName: 'Zap',
        className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
      }
    case 'indexing':
      return {
        label: 'Indexing',
        variant: 'default',
        iconName: 'BookOpen',
        className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
      }
    case 'available_to_ai':
    case 'ready':
      return {
        label: 'Available',
        variant: 'default',
        iconName: 'Check',
        className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      }
    case 'processing':
      return {
        label: 'Processing',
        variant: 'default',
        iconName: 'Zap',
        className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
      }
    case 'retrying':
      return {
        label: 'Retrying',
        variant: 'outline',
        iconName: 'RefreshCw',
        className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
      }
    case 'failed':
      return {
        label: 'Failed',
        variant: 'destructive',
        iconName: 'X',
        className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
      }
    case 'uploaded':
    case 'pending_upload':
    default:
      return {
        label: 'Pending',
        variant: 'outline',
        iconName: 'Clock',
        className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30',
      }
  }
}
