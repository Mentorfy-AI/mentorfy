"use client"

import { AlertCircle, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GoogleDriveAuthErrorProps {
  message: string
  authUrl: string
  onRetry?: () => void
}

/**
 * Component to handle Google Drive authentication errors
 */
export function GoogleDriveAuthError({
  message,
  authUrl,
  onRetry,
}: GoogleDriveAuthErrorProps) {
  const handleReauth = () => {
    // Add popup flag to auth URL
    const url = new URL(authUrl)
    url.searchParams.set('popup', 'true')

    // Open popup window (width: 500px, height: 600px, centered)
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    window.open(url.toString(), 'google-drive-auth', `width=${width},height=${height},left=${left},top=${top}`)

    // Call retry callback if provided
    onRetry?.()
  }

  return (
    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-yellow-400 font-medium text-sm mb-2">Google Drive Access Expired</h4>
          <p className="text-yellow-400/80 text-sm mb-3">{message}</p>
          <Button
            onClick={handleReauth}
            className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm px-4 py-2 h-auto"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Re-authenticate with Google Drive
          </Button>
        </div>
      </div>
    </div>
  )
}
