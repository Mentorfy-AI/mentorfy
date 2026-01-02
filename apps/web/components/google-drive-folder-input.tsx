"use client"

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, FolderOpen, AlertCircle } from 'lucide-react'

interface GoogleDriveFolderInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
  error?: string | null
}

/**
 * Component for Google Drive folder URL input and validation
 */
export function GoogleDriveFolderInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  error,
}: GoogleDriveFolderInputProps) {
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

    // If it's already just an ID
    if (/^[a-zA-Z0-9-_]+$/.test(url.trim())) {
      return url.trim()
    }

    return null
  }

  const isValidUrl = value.trim() && extractFolderId(value) !== null

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-white block mb-2">
          Google Drive Folder URL or ID
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/1ABC... or folder ID"
          disabled={isLoading}
          className="border-gray-600 text-white placeholder-gray-400 bg-gray-700"
        />
        <p className="text-xs text-gray-400 mt-2">
          Paste the URL of a Google Drive folder you have access to
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <Button
        onClick={onSubmit}
        disabled={!isValidUrl || isLoading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Scanning folder...
          </>
        ) : (
          <>
            <FolderOpen className="w-4 h-4 mr-2" />
            Import Documents
          </>
        )}
      </Button>
    </div>
  )
}
