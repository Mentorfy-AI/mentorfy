'use client'

import { useDraggable } from '@dnd-kit/core'
import { File, FileText, Image, Video, Music, Archive, CheckSquare } from 'lucide-react'
import { Document } from '@/hooks/use-documents'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface DraggableDocumentProps {
  document: Document
  isSelected: boolean
  onSelect: (documentId: string, multi: boolean) => void
  onClick?: () => void
}

function getFileIcon(fileType: string) {
  const type = fileType.toLowerCase()

  if (type.includes('pdf')) return FileText
  if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg')) return Image
  if (type.includes('video') || type.includes('mp4')) return Video
  if (type.includes('audio') || type.includes('mp3')) return Music
  if (type.includes('zip') || type.includes('rar')) return Archive

  return File
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getStatusColor(status: Document['processing_status']): string {
  switch (status) {
    case 'available_to_ai':
    case 'ready':
      return 'text-green-600'
    case 'processing':
    case 'indexing':
      return 'text-blue-600'
    case 'retrying':
      return 'text-yellow-600'
    case 'failed':
      return 'text-red-600'
    case 'uploaded':
    case 'pending_upload':
    default:
      return 'text-muted-foreground'
  }
}

export function DraggableDocument({ document, isSelected, onSelect, onClick }: DraggableDocumentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: document.id,
    data: {
      type: 'document',
      document,
    },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  const FileIcon = getFileIcon(document.file_type)

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200',
        isSelected && 'border-primary bg-accent ring-2 ring-primary/20',
        isDragging && 'opacity-50 scale-95 shadow-xl'
      )}
      onClick={(e) => {
        if (onClick) {
          onClick()
        } else {
          onSelect(document.id, e.shiftKey || e.ctrlKey || e.metaKey)
        }
      }}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(document.id, true)}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5"
        />

        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <FileIcon className="h-8 w-8 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{document.title}</h3>

          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{formatFileSize(document.file_size)}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}</span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className={cn('text-xs font-medium', getStatusColor(document.processing_status))}>
              {document.processing_status.replace(/_/g, ' ').toUpperCase()}
            </span>

            {document.word_count > 0 && (
              <>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{document.word_count.toLocaleString()} words</span>
              </>
            )}
          </div>

          {document.last_error && (
            <p className="text-xs text-red-600 mt-2 line-clamp-2">{document.last_error}</p>
          )}
        </div>
      </div>
    </Card>
  )
}
