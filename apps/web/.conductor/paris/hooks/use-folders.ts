import { useState, useEffect } from 'react'
import { useSupabaseClient } from '@/lib/supabase-browser'

export interface Folder {
  id: string
  organization_id: string
  name: string
  description: string | null
  parent_folder_id: string | null
  created_at: string
  updated_at: string
  document_count?: number
  children?: Folder[]
}

export interface CreateFolderInput {
  name: string
  description?: string
  parent_folder_id?: string
}

export interface UpdateFolderInput {
  name?: string
  description?: string
  parent_folder_id?: string
}

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = useSupabaseClient()

  const fetchFolders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/folders')

      if (!response.ok) {
        throw new Error('Failed to fetch folders')
      }

      const data = await response.json()
      setFolders(data.folders || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFolders()
  }, [])

  const createFolder = async (input: CreateFolderInput) => {
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create folder')
      }

      const data = await response.json()

      // Optimistically update local state
      setFolders(prev => [...prev, data.folder])

      return data.folder
    } catch (err) {
      throw err
    }
  }

  const updateFolder = async (folderId: string, input: UpdateFolderInput) => {
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update folder')
      }

      const data = await response.json()

      // Optimistically update local state
      setFolders(prev => prev.map(f => f.id === folderId ? data.folder : f))

      return data.folder
    } catch (err) {
      throw err
    }
  }

  const deleteFolder = async (folderId: string) => {
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete folder')
      }

      // Optimistically update local state
      setFolders(prev => prev.filter(f => f.id !== folderId))
    } catch (err) {
      throw err
    }
  }

  const moveFolder = async (folderId: string, targetParentId: string | null) => {
    return updateFolder(folderId, { parent_folder_id: targetParentId || undefined })
  }

  return {
    folders,
    loading,
    error,
    createFolder,
    updateFolder,
    deleteFolder,
    moveFolder,
    refetch: fetchFolders,
  }
}
