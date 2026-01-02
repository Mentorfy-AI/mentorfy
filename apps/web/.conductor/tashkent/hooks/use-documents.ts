"use client"

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useOrganization } from './use-organization'

export interface Document {
  id: string
  title: string
  clerk_org_id: string
  file_type: string
  file_size: number
  storage_path: string | null
  created_at: string
  processing_status: 'pending_upload' | 'uploaded' | 'processing' | 'retrying' | 'available_to_ai' | 'failed' | 'ready' | 'indexing'
  word_count: number
  source_type: string
  retry_count: number
  next_retry_at: string | null
  last_error: string | null
  error_type: 'rate_limit' | 'network_error' | 'processing_error' | 'unknown_error' | null
  folder_id: string | null
}

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalWords, setTotalWords] = useState(0)
  const [hasInitialLoad, setHasInitialLoad] = useState(false)
  const [userIdCache, setUserIdCache] = useState<string | null>(null)
  const { user } = useUser()
  const { organizationId, loading: orgLoading } = useOrganization()

  useEffect(() => {
    console.log('[useDocuments] Effect triggered:', { user: !!user, organizationId, orgLoading })

    if (!user || !organizationId) {
      if (!user) {
        console.log('[useDocuments] No user, clearing documents')
        setDocuments([])
        setLoading(false)
        setHasInitialLoad(false)
        setUserIdCache(null)
      } else if (orgLoading) {
        console.log('[useDocuments] Org still loading')
        setLoading(true)
      }
      return
    }

    // Skip if we already have data for this user
    if (hasInitialLoad && userIdCache === user.id && documents.length > 0) {
      setLoading(false)
      return
    }

    // Only show loading for first load or user change
    if (!hasInitialLoad || userIdCache !== user.id) {
      setLoading(true)
    }

    const fetchDocuments = async () => {
      try {
        console.log('[useDocuments] Fetching documents via API for org:', organizationId)
        console.time('fetchDocuments')

        const response = await fetch('/api/documents')

        if (!response.ok) {
          throw new Error('Failed to fetch documents')
        }

        const data = await response.json()

        console.log('[useDocuments] API result:', { count: data.documents?.length, totalWords: data.totalWords })
        console.timeEnd('fetchDocuments')

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch documents')
        }

        setDocuments(data.documents || [])
        setTotalWords(data.totalWords || 0)

        // Mark as loaded for this user
        setHasInitialLoad(true)
        setUserIdCache(user.id)

      } catch (err: any) {
        console.error('Error fetching documents:', err)
        setError(err.message || 'Failed to fetch documents')
      } finally {
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [user, organizationId, orgLoading, hasInitialLoad, userIdCache, documents.length])

  const deleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete document')
      }

      // Remove from local state
      setDocuments(prev => prev.filter(doc => doc.id !== documentId))

      // Recalculate total words
      const remainingDocs = documents.filter(doc => doc.id !== documentId)
      const newTotalWords = remainingDocs.reduce((total, doc) => {
        return total + doc.word_count
      }, 0)
      setTotalWords(newTotalWords)

      return { success: true }
    } catch (error: any) {
      console.error('Error deleting document:', error)
      return { success: false, error: error.message }
    }
  }

  const updateDocument = async (documentId: string, updates: Partial<Document>) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update document')
      }

      const data = await response.json()

      // Optimistically update local state
      setDocuments(prev => prev.map(doc => doc.id === documentId ? { ...doc, ...data.document } : doc))

      return data.document
    } catch (error: any) {
      console.error('Error updating document:', error)
      throw error
    }
  }

  const bulkUpdateDocuments = async (documentIds: string[], updates: Partial<Document>) => {
    try {
      const response = await fetch('/api/documents/bulk', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_ids: documentIds,
          ...updates,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to bulk update documents')
      }

      const data = await response.json()

      // Optimistically update local state
      setDocuments(prev => prev.map(doc =>
        documentIds.includes(doc.id) ? { ...doc, ...updates } : doc
      ))

      return data
    } catch (error: any) {
      console.error('Error bulk updating documents:', error)
      throw error
    }
  }

  const bulkDeleteDocuments = async (documentIds: string[]) => {
    try {
      const response = await fetch('/api/documents/bulk', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_ids: documentIds,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to bulk delete documents')
      }

      // Optimistically update local state
      setDocuments(prev => prev.filter(doc => !documentIds.includes(doc.id)))

      // Recalculate total words
      const remainingDocs = documents.filter(doc => !documentIds.includes(doc.id))
      const newTotalWords = remainingDocs.reduce((total, doc) => {
        return total + doc.word_count
      }, 0)
      setTotalWords(newTotalWords)
    } catch (error: any) {
      console.error('Error bulk deleting documents:', error)
      throw error
    }
  }

  const refetch = async () => {
    if (!user || !organizationId) return

    setLoading(true)
    try {
      const response = await fetch('/api/documents')

      if (!response.ok) {
        throw new Error('Failed to refetch documents')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to refetch documents')
      }

      setDocuments(data.documents || [])
      setTotalWords(data.totalWords || 0)
    } catch (err: any) {
      console.error('Error refetching documents:', err)
      setError(err.message || 'Failed to refetch documents')
    } finally {
      setLoading(false)
    }
  }

  return {
    documents,
    loading,
    error,
    totalWords,
    deleteDocument,
    updateDocument,
    bulkUpdateDocuments,
    bulkDeleteDocuments,
    refetch,
  }
}
