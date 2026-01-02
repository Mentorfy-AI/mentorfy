"use client"

import { useState, useEffect } from 'react'
import { useGoogleDriveFileTree } from '@/hooks/use-google-drive-file-tree'
import { GoogleDriveFolderInput } from './google-drive-folder-input'
import { GoogleDriveFolderSelector } from './google-drive-folder-selector'
import { GoogleDriveAuthError } from './google-drive-auth-error'
import { GoogleDriveImportProgress } from './google-drive-import-progress'

type ImportState = 'idle' | 'authenticating' | 'scanning' | 'selecting' | 'importing' | 'complete'

interface GoogleDriveImportProps {
  onImportComplete?: () => void
}

/**
 * Clean orchestrator for Google Drive import flow
 *
 * State machine:
 * IDLE → INPUT → AUTHENTICATING → SCANNING → SELECTING → IMPORTING → COMPLETE
 */
export function GoogleDriveImport({ onImportComplete }: GoogleDriveImportProps) {
  const [state, setState] = useState<ImportState>('idle')
  const [folderUrl, setFolderUrl] = useState('')
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null)
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [authError, setAuthError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [pendingAuthFolderId, setPendingAuthFolderId] = useState<string | null>(null)

  const { tree, loading: treeLoading, error: treeError, authUrl: hookAuthUrl, fetch: fetchTree } = useGoogleDriveFileTree()

  // Handle OAuth success/error from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        console.log('✅ Google Auth Success')
        setAuthError(null)

        // Retry with pending folder ID
        if (pendingAuthFolderId) {
          console.log('🔄 Retrying import after auth')
          setState('scanning')
          await fetchTree(pendingAuthFolderId)
          setPendingAuthFolderId(null)
        }
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        console.error('❌ Google Auth Error:', event.data.error)
        setAuthError(`Authentication failed: ${event.data.error}`)
        setGeneralError(`Authentication failed: ${event.data.error}`)
        setPendingAuthFolderId(null)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [pendingAuthFolderId, fetchTree])

  // Handle tree fetch errors
  useEffect(() => {
    if (treeError === 'AUTHENTICATION_REQUIRED') {
      setState('authenticating')
      setAuthError('Your Google Drive access requires authentication. Please authenticate to proceed.')
      setAuthUrl(hookAuthUrl)
    } else if (treeError === 'CREDENTIAL_REFRESH_FAILED') {
      setState('authenticating')
      setAuthError('Your Google Drive credentials have expired. Please refresh your authorization.')
      setAuthUrl(hookAuthUrl)
    } else if (treeError) {
      setGeneralError(treeError)
      setState('idle')
    } else if (!treeLoading && tree) {
      // Successfully fetched tree
      setGeneralError(null)
      setAuthError(null)
      setState('selecting')
      // Auto-select all files by default
      const allFileIds = new Set<string>()
      const collectFileIds = (node: any) => {
        node.files.forEach((f: any) => allFileIds.add(f.id))
        node.children.forEach((child: any) => collectFileIds(child))
      }
      collectFileIds(tree)
      setSelectedFileIds(allFileIds)
    }
  }, [tree, treeLoading, treeError, hookAuthUrl])

  const extractFolderId = (url: string): string | null => {
    if (!url) return null

    const patterns = [
      /\/folders\/([a-zA-Z0-9-_]+)/,
      /\/drive\/folders\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }

    if (/^[a-zA-Z0-9-_]+$/.test(url.trim())) {
      return url.trim()
    }

    return null
  }

  const handleImportClick = async () => {
    const folderId = extractFolderId(folderUrl)
    if (!folderId) {
      setGeneralError('Please enter a valid Google Drive folder URL or ID')
      return
    }

    setGeneralError(null)
    setAuthError(null)
    setSelectedFileIds(new Set())
    setFolderUrl('')
    setState('scanning')
    setPendingFolderId(folderId)
    setPendingAuthFolderId(folderId)

    await fetchTree(folderId)
  }

  const handleImportSelected = async () => {
    if (selectedFileIds.size === 0) {
      setGeneralError('Please select at least one file to import')
      return
    }

    setState('importing')
    setGeneralError(null)

    try {
      const payload = {
        folderId: tree?.google_drive_folder_id,
        selectedFileIds: Array.from(selectedFileIds),
      }
      console.log('📤 Sending import request:', {
        folderId: payload.folderId,
        selectedFileCount: payload.selectedFileIds.length,
        selectedFileIds: payload.selectedFileIds.slice(0, 3) // Log first 3 for debugging
      })

      const response = await fetch('/api/google-drive/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      console.log('📥 Import response:', {
        success: result.success,
        documentCount: result.documents?.length,
        error: result.error
      })

      if (!response.ok) {
        throw new Error(result.error || 'Import failed')
      }

      console.log('✅ Import started:', result)
      setState('complete')

      // Close modal and trigger refresh after brief delay
      setTimeout(() => {
        onImportComplete?.()
      }, 1000)
    } catch (err: any) {
      console.error('❌ Import error:', err)
      setGeneralError(err.message || 'Failed to import files')
      setState('selecting')
    }
  }

  const handleRetryAuth = async () => {
    if (pendingAuthFolderId) {
      setAuthError(null)
      setState('scanning')
      await fetchTree(pendingAuthFolderId)
    }
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Folder Input */}
      {state === 'idle' && (
        <GoogleDriveFolderInput
          value={folderUrl}
          onChange={setFolderUrl}
          onSubmit={handleImportClick}
          isLoading={treeLoading}
          error={generalError}
        />
      )}

      {/* Step 2: Auth Error */}
      {authError && state === 'authenticating' && (
        authUrl ? (
          <GoogleDriveAuthError
            message={authError}
            authUrl={authUrl}
            onRetry={handleRetryAuth}
          />
        ) : (
          // If we get here, something is broken - authUrl should always be present with auth error
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm font-mono text-xs">
              BUG: Auth error without authUrl. Check backend response and hook logic.
            </p>
          </div>
        )
      )}

      {/* Step 2: Folder Selector */}
      {(state === 'scanning' || state === 'selecting') && (
        <>
          <GoogleDriveImportProgress
            state={state}
            filesIdentified={tree ? countAllFiles(tree) : undefined}
            filesSelected={selectedFileIds.size}
          />

          {treeLoading ? (
            <div className="p-8 text-center text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mb-3"></div>
              <p>Scanning folder structure...</p>
              <p className="text-xs mt-2">This may take a moment for large folders</p>
            </div>
          ) : tree && state === 'selecting' ? (
            <GoogleDriveFolderSelector
              tree={tree}
              loading={false}
              selectedFileIds={selectedFileIds}
              onSelectionChange={setSelectedFileIds}
              onImport={handleImportSelected}
            />
          ) : null}
        </>
      )}

      {/* Step 3: Importing */}
      {state === 'importing' && (
        <GoogleDriveImportProgress
          state="importing"
          filesIdentified={selectedFileIds.size}
          filesSelected={selectedFileIds.size}
        />
      )}

      {/* Step 4: Complete */}
      {state === 'complete' && (
        <GoogleDriveImportProgress
          state="complete"
          filesIdentified={selectedFileIds.size}
        />
      )}

      {/* General error display */}
      {generalError && state !== 'authenticating' && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3">
          <div className="text-red-400 text-sm flex-1">{generalError}</div>
        </div>
      )}

      {/* Help text */}
      {state === 'idle' && (
        <div className="text-xs text-gray-400 space-y-1">
          <p>• This will import all supported documents (PDF, DOCX, DOC, TXT, Google Docs)</p>
          <p>• You can select which files to import before processing</p>
          <p>• Documents will be processed in the background</p>
        </div>
      )}
    </div>
  )
}

// Helper function to count all files in tree
function countAllFiles(node: any): number {
  let count = node.files.length
  node.children.forEach((child: any) => {
    count += countAllFiles(child)
  })
  return count
}
