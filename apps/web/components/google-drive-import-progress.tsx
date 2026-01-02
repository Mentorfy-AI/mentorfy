"use client"

import { Loader2, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type ImportState = 'authenticating' | 'scanning' | 'selecting' | 'importing' | 'complete'

interface GoogleDriveImportProgressProps {
  state: ImportState
  filesIdentified?: number
  filesSelected?: number
}

/**
 * Component to show Google Drive import progress and state
 */
export function GoogleDriveImportProgress({
  state,
  filesIdentified,
  filesSelected,
}: GoogleDriveImportProgressProps) {
  const getStateMessage = (): string => {
    switch (state) {
      case 'authenticating':
        return 'Authenticating with Google Drive'
      case 'scanning':
        return 'Scanning folder contents'
      case 'selecting':
        return 'Select files to import'
      case 'importing':
        return 'Importing selected files'
      case 'complete':
        return 'Import complete!'
      default:
        return 'Processing'
    }
  }

  const isLoading = state !== 'selecting' && state !== 'complete'

  return (
    <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          ) : state === 'complete' ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : null}
          <span className="text-white font-medium">{getStateMessage()}</span>
        </div>

        <div className="flex gap-2">
          {filesIdentified !== undefined && (
            <Badge variant="secondary" className="bg-blue-900 text-blue-300">
              {filesIdentified} documents
            </Badge>
          )}
          {filesSelected !== undefined && filesSelected > 0 && (
            <Badge variant="secondary" className="bg-emerald-900 text-emerald-300">
              {filesSelected} selected
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
