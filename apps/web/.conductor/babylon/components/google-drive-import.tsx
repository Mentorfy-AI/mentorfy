"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FolderOpen, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { useDocuments } from '@/hooks/use-documents'

interface MentorBot {
  id: string;
  name: string;
}

interface GoogleDriveImportProps {
  onImportComplete?: (documentId?: string) => void
  selectedBotId?: string
  bots?: MentorBot[]
  isLoadingBots?: boolean
  onBotChange?: (botId: string) => void
}

enum UploadState {
  IDLE = "idle",
  AUTHENTICATING = "authenticating", 
  SCANNING = "scanning",           // Identifying files in Drive
  PREPARING = "preparing",          // Creating pending_upload records
  COMPLETE = "complete"
}

interface UploadProgress {
  state: UploadState
  filesIdentified: number
  filesPrepared: number
  currentFile?: string
  error?: string
}

interface ImportProgress {
  total: number
  uploaded: number
  indexing: number
  ready: number
  failed: number
}

interface AuthError {
  error: string
  message: string
  authUrl: string
}

export function GoogleDriveImport({ 
  onImportComplete,
  selectedBotId = '',
  bots = [],
  isLoadingBots = false,
  onBotChange
}: GoogleDriveImportProps) {
  const [folderUrl, setFolderUrl] = useState('')
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    state: UploadState.IDLE,
    filesIdentified: 0,
    filesPrepared: 0
  })
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<AuthError | null>(null)
  const [authSuccess, setAuthSuccess] = useState(false)
  const { documents } = useDocuments()

  // Check for auth success/error in URL params on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const authStatus = urlParams.get('auth')
    
    if (authStatus === 'success') {
      setAuthSuccess(true)
      setAuthError(null)
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname)
      // Clear success message after 5 seconds
      setTimeout(() => setAuthSuccess(false), 5000)
    } else if (authStatus === 'error') {
      const message = decodeURIComponent(urlParams.get('message') || 'Authentication failed')
      setError(`Authentication failed: ${message}`)
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Extract folder ID from Google Drive URL
  const extractFolderId = (url: string): string | null => {
    if (!url) return null
    
    // Handle different Google Drive URL formats
    const patterns = [
      /\/folders\/([a-zA-Z0-9-_]+)/,
      /\/drive\/folders\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    
    // If it's already just an ID (no URL structure)
    if (/^[a-zA-Z0-9-_]+$/.test(url.trim())) {
      return url.trim()
    }
    
    return null
  }

  // Calculate progress from documents
  useEffect(() => {
    if (uploadProgress.state === UploadState.IDLE || !importProgress) return
    
    // Filter documents from the current import session (simple heuristic: recent documents)
    const recentDocuments = documents.filter(doc => 
      doc.source_type === 'google_drive' && 
      new Date(doc.created_at).getTime() > Date.now() - (5 * 60 * 1000) // Last 5 minutes
    )
    
    if (recentDocuments.length === 0) return
    
    const statusCounts = recentDocuments.reduce((acc, doc) => {
      // Map new status names to old ones for backward compatibility
      const legacyStatus = doc.processing_status === 'available_to_ai' ? 'ready' : 
                          doc.processing_status === 'processing' ? 'indexing' : 
                          doc.processing_status === 'pending_upload' ? 'uploaded' : 
                          doc.processing_status
      acc[legacyStatus] = (acc[legacyStatus] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const newProgress = {
      total: Math.max(importProgress.total, recentDocuments.length),
      uploaded: statusCounts.uploaded || 0,
      indexing: statusCounts.indexing || 0,
      ready: statusCounts.ready || 0,
      failed: statusCounts.failed || 0
    }
    
    setImportProgress(newProgress)
    
    // Check if import is complete
    const completed = newProgress.ready + newProgress.failed
    if (completed === newProgress.total && completed > 0) {
      setUploadProgress(prev => ({ ...prev, state: UploadState.COMPLETE }))
      if (onImportComplete) {
        onImportComplete()
      }
    }
  }, [documents, uploadProgress.state, importProgress, onImportComplete])

  const handleImport = async () => {
    const folderId = extractFolderId(folderUrl)
    if (!folderId) {
      setError('Please enter a valid Google Drive folder URL or ID')
      return
    }

    if (!selectedBotId) {
      setError('Please select a bot for the imported documents')
      return
    }

    // Step 1: Authenticating
    setUploadProgress({
      state: UploadState.AUTHENTICATING,
      filesIdentified: 0,
      filesPrepared: 0
    })
    setError(null)
    setAuthError(null)
    setImportProgress({ total: 0, uploaded: 0, indexing: 0, ready: 0, failed: 0 })

    try {
      const response = await fetch('/api/google-drive/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId, botId: selectedBotId }),
      })

      const result = await response.json()

      if (!response.ok) {
        // Check if it's an authentication error
        if (result.error === 'AUTHENTICATION_REQUIRED') {
          setAuthError({
            error: result.error,
            message: result.message,
            authUrl: result.authUrl
          })
          setUploadProgress({ state: UploadState.IDLE, filesIdentified: 0, filesPrepared: 0 })
          return
        }
        
        throw new Error(result.error || 'Import failed')
      }

      // Step 2: Show scanning results with new summary format
      const summary = result.summary || { total: 0, new: 0, updated: 0, skipped: 0 }
      setUploadProgress({
        state: UploadState.SCANNING,
        filesIdentified: summary.total,
        filesPrepared: 0
      })

      // Step 3: Preparing records (auto-transition)
      setTimeout(() => {
        setUploadProgress({
          state: UploadState.PREPARING,
          filesIdentified: summary.total,
          filesPrepared: summary.new + summary.updated
        })

        // Set initial progress with discovered file count
        setImportProgress({
          total: summary.new + summary.updated, // Only files that will be processed
          uploaded: 0,
          indexing: 0,
          ready: 0,
          failed: 0
        })

        // Show summary information in console for debugging
        console.log(`📊 Import Summary: ${summary.total} total, ${summary.new} new, ${summary.updated} updated, ${summary.skipped} skipped`)
      }, 1000) // Show scanning state briefly

    } catch (err: any) {
      setError(err.message || 'An error occurred during import')
      setUploadProgress({
        state: UploadState.IDLE,
        filesIdentified: 0,
        filesPrepared: 0,
        error: err.message
      })
      setImportProgress(null)
    }
  }

  const formatProgress = (progress: ImportProgress) => {
    const completed = progress.ready + progress.failed
    const percentage = progress.total > 0 ? Math.round((completed / progress.total) * 100) : 0
    return { completed, percentage }
  }

  const isValidUrl = folderUrl.trim() && extractFolderId(folderUrl) !== null
  const isImporting = uploadProgress.state !== UploadState.IDLE && uploadProgress.state !== UploadState.COMPLETE

  return (
    <div className="space-y-4">
      {/* Bot Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white">
          Select Bot <span className="text-red-400">*</span>
        </label>
        <Select
          value={selectedBotId}
          onValueChange={onBotChange}
          disabled={isLoadingBots || isImporting}
        >
          <SelectTrigger className="w-full border-gray-600 bg-gray-700 text-white">
            <SelectValue placeholder={isLoadingBots ? "Loading bots..." : "Choose a bot"} />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {bots.map((bot) => (
              <SelectItem key={bot.id} value={bot.id} className="text-white hover:bg-gray-700">
                {bot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* URL Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white">
          Google Drive Folder URL or ID
        </label>
        <Input
          value={folderUrl}
          onChange={(e) => {
            setFolderUrl(e.target.value)
            setError(null)
          }}
          placeholder="https://drive.google.com/drive/folders/1ABC..."
          disabled={isImporting}
          className="border-gray-600 text-white placeholder-gray-400 bg-gray-700"
        />
        <p className="text-xs text-gray-400">
          Paste the URL of a Google Drive folder you have access to
        </p>
      </div>

      {/* Import Button */}
      <Button
        onClick={handleImport}
        disabled={!isValidUrl || isImporting || !selectedBotId}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isImporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {uploadProgress.state === UploadState.AUTHENTICATING && "Authenticating..."}
            {uploadProgress.state === UploadState.SCANNING && "Scanning folder..."}
            {uploadProgress.state === UploadState.PREPARING && "Preparing files..."}
          </>
        ) : (
          <>
            <FolderOpen className="w-4 h-4 mr-2" />
            Import Documents
          </>
        )}
      </Button>

      {/* State Machine Progress Display */}
      {uploadProgress.state !== UploadState.IDLE && (
        <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
          <div className="space-y-3">
            {/* Current State Display */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-white font-medium">
                  {uploadProgress.state === UploadState.AUTHENTICATING && "Authenticating with Google Drive"}
                  {uploadProgress.state === UploadState.SCANNING && "Scanning folder contents"}
                  {uploadProgress.state === UploadState.PREPARING && "Creating document records"}
                  {uploadProgress.state === UploadState.COMPLETE && "Import complete!"}
                </span>
              </div>
              {uploadProgress.filesIdentified > 0 && (
                <Badge variant="secondary" className="bg-blue-900 text-blue-300">
                  {uploadProgress.filesIdentified} files found
                </Badge>
              )}
            </div>

            {/* Progress Details */}
            {uploadProgress.state === UploadState.PREPARING && uploadProgress.filesIdentified > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Preparing files for upload</span>
                  <span className="text-white">{uploadProgress.filesPrepared}/{uploadProgress.filesIdentified}</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress.filesIdentified > 0 ? (uploadProgress.filesPrepared / uploadProgress.filesIdentified) * 100 : 0}%` }}
                  />
                </div>
                {uploadProgress.currentFile && (
                  <p className="text-xs text-gray-400 truncate">
                    Current: {uploadProgress.currentFile}
                  </p>
                )}
              </div>
            )}

            {/* Complete State */}
            {uploadProgress.state === UploadState.COMPLETE && (
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-400 text-sm font-medium">Files prepared for processing!</p>
                  <p className="text-green-400/80 text-xs mt-1">
                    Documents will now be processed and added to your AI mentor automatically.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Authentication Success Display */}
      {authSuccess && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-400 text-sm">Google Drive authentication successful! You can now import documents.</p>
          </div>
        </div>
      )}

      {/* Authentication Error Display */}
      {authError && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-yellow-400 font-medium text-sm mb-2">Google Drive Access Expired</h4>
              <p className="text-yellow-400/80 text-sm mb-3">{authError.message}</p>
              <Button
                onClick={() => window.open(authError.authUrl, '_self')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm px-4 py-2 h-auto"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Re-authenticate with Google Drive
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Display */}
      {importProgress && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">Import Progress</h4>
            <span className="text-xs text-gray-400">
              {formatProgress(importProgress).completed} of {importProgress.total} documents
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${formatProgress(importProgress).percentage}%` }}
            />
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            {importProgress.uploaded > 0 && (
              <Badge variant="outline" className="bg-yellow-900/20 text-yellow-300 border-yellow-700">
                <FileText className="w-3 h-3 mr-1" />
                {importProgress.uploaded} Uploaded
              </Badge>
            )}
            {importProgress.indexing > 0 && (
              <Badge variant="outline" className="bg-blue-900/20 text-blue-300 border-blue-700">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                {importProgress.indexing} Adding to AI
              </Badge>
            )}
            {importProgress.ready > 0 && (
              <Badge variant="outline" className="bg-green-900/20 text-green-300 border-green-700">
                <CheckCircle className="w-3 h-3 mr-1" />
                {importProgress.ready} Ready
              </Badge>
            )}
            {importProgress.failed > 0 && (
              <Badge variant="outline" className="bg-red-900/20 text-red-300 border-red-700">
                <AlertCircle className="w-3 h-3 mr-1" />
                {importProgress.failed} Failed
              </Badge>
            )}
          </div>

          {/* Completion Message */}
          {!isImporting && importProgress.ready > 0 && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-400 text-sm font-medium">Import Complete!</p>
                  <p className="text-green-400/80 text-xs mt-1">
                    {importProgress.ready} documents are now available to your AI mentor
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>• This will import all supported documents (PDF, DOCX, DOC, TXT, Google Docs) from the folder</p>
        <p>• Documents are processed individually - some may succeed while others fail</p>
        <p>• You can continue using the app while documents are being processed</p>
      </div>
    </div>
  )
}