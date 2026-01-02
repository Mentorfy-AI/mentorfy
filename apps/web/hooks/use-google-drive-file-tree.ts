"use client"

import { useState, useCallback } from 'react'

export interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
}

export interface FolderTree {
  google_drive_folder_id: string
  name: string
  children: FolderTree[]
  files: GoogleDriveFile[]
}

interface UseGoogleDriveFileTreeResult {
  tree: FolderTree | null
  loading: boolean
  error: string | null
  authUrl: string | null
  fetch: (folderId: string) => Promise<void>
}

/**
 * Hook to fetch Google Drive folder tree structure once
 * No polling - just a single fetch when folderId changes
 */
export function useGoogleDriveFileTree(): UseGoogleDriveFileTreeResult {
  const [tree, setTree] = useState<FolderTree | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authUrl, setAuthUrl] = useState<string | null>(null)

  const fetchTree = useCallback(async (folderId: string) => {
    setLoading(true)
    setError(null)
    setTree(null)

    console.log('🔍 Fetching Google Drive folder tree for:', folderId)

    try {
      const response = await fetch('/api/google-drive/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId }),
      })

      console.log('📨 API response received, status:', response.status)

      const result = await response.json()
      console.log('📦 API result:', result)

      // Handle auth required - check this FIRST before checking response.ok
      // because auth errors return 401 status
      if (result.error === 'AUTHENTICATION_REQUIRED' || result.error === 'CREDENTIAL_REFRESH_FAILED') {
        const authUrl = result.auth_url || result.authUrl || null
        console.log('🔑 Auth required, authUrl:', authUrl)
        console.log('🔑 Full result:', result)
        setError(result.error)
        setAuthUrl(authUrl)
        return
      }

      if (!response.ok) {
        console.error('❌ API error:', result.error)
        setError(result.error || 'Failed to fetch folder structure')
        setAuthUrl(null)
        return
      }

      // Extract tree from response
      if (result.folders?.structure) {
        setTree(result.folders.structure)
        setAuthUrl(null)
        console.log('✅ Tree structure loaded successfully')
        return
      }

      // If no tree and not auth error, something else went wrong
      setError(result.message || 'Failed to fetch folder structure')
    } catch (err: any) {
      setError(err.message || 'Failed to fetch folder structure')
    } finally {
      setLoading(false)
    }
  }, [])

  return { tree, loading, error, authUrl, fetch: fetchTree }
}
