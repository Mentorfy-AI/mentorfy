"use client"

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { File, X } from "lucide-react"
import { useState } from "react"

interface FileAttachmentPreviewProps {
  fileType?: string
  fileName?: string
  fileBase64?: string
  fileId?: string
  readOnly?: boolean
  onRemove?: () => void
  size?: 'sm' | 'md'
}

/**
 * Shared file attachment preview component
 * Used in both MentorPromptBox (editable) and StreamingChatMessage (read-only)
 */
export function FileAttachmentPreview({
  fileType,
  fileName = 'Uploaded file',
  fileBase64,
  fileId,
  readOnly = false,
  onRemove,
  size = 'md',
}: FileAttachmentPreviewProps) {
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)

  // Image preview (only if we have base64 data)
  const isImage = fileType?.startsWith('image/')
  const hasImageData = isImage && fileBase64
  const imagePreview = hasImageData ? `data:${fileType};base64,${fileBase64}` : null

  // Size variants
  const thumbnailSize = size === 'sm' ? 'h-12 w-12' : 'h-14.5 w-14.5'
  const containerPadding = size === 'sm' ? 'px-0.5 pt-0.5' : 'px-1 pt-1'
  const removeButtonSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const removeIconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'

  if (hasImageData && imagePreview) {
    // Image with preview
    return (
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <div className={`relative mb-1 w-fit rounded-[1rem] ${containerPadding}`}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[1rem]"
              aria-label="View full size image"
            >
              <img
                src={imagePreview}
                alt="Image preview"
                className={`${thumbnailSize} rounded-[1rem] object-cover`}
              />
            </button>
          </DialogTrigger>
          {!readOnly && onRemove && (
            <button
              onClick={onRemove}
              className={`absolute right-2 top-2 z-10 flex ${removeButtonSize} items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              aria-label="Remove file"
              type="button"
            >
              <X className={removeIconSize} />
            </button>
          )}
        </div>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none">
          <img
            src={imagePreview}
            alt="Full size preview"
            className="w-full max-h-[95vh] object-contain rounded-[24px]"
          />
        </DialogContent>
      </Dialog>
    )
  }

  // Helper function to truncate filename while keeping extension visible
  const truncateFilename = (name: string, maxLength: number = 25): string => {
    if (name.length <= maxLength) return name;

    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No extension, just truncate
      return name.slice(0, maxLength - 3) + '...';
    }

    const extension = name.slice(lastDotIndex);
    const baseName = name.slice(0, lastDotIndex);
    const availableLength = maxLength - extension.length - 3; // 3 for '...'

    if (availableLength <= 0) {
      // Extension is too long, just show extension
      return '...' + extension;
    }

    return baseName.slice(0, availableLength) + '...' + extension;
  };

  if (isImage && !fileBase64) {
    // Image without preview data (after reload)
    return (
      <div className={`relative mb-1 w-fit rounded-[1rem] ${containerPadding}`}>
        <div className="flex items-center gap-2 rounded-[1rem] bg-accent/50 px-3 py-2">
          <File className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm text-foreground max-w-[200px]">
              {truncateFilename(fileName)}
            </span>
            <span className="text-xs text-muted-foreground">
              Preview unavailable
            </span>
          </div>
        </div>
        {!readOnly && onRemove && (
          <button
            onClick={onRemove}
            className={`absolute right-2 top-2 z-10 flex ${removeButtonSize} items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            aria-label="Remove file"
            type="button"
          >
            <X className={removeIconSize} />
          </button>
        )}
      </div>
    )
  }

  // Document file (PDF, DOCX, etc.)
  return (
    <div className={`relative mb-1 w-fit rounded-[1rem] ${containerPadding}`}>
      <div className="flex items-center gap-2 rounded-[1rem] bg-accent/50 px-3 py-2">
        <File className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-foreground max-w-[200px]">
          {truncateFilename(fileName)}
        </span>
      </div>
      {!readOnly && onRemove && (
        <button
          onClick={onRemove}
          className={`absolute right-2 top-2 z-10 flex ${removeButtonSize} items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          aria-label="Remove file"
          type="button"
        >
          <X className={removeIconSize} />
        </button>
      )}
    </div>
  )
}
