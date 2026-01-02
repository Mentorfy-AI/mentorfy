'use client'

import { Folder as FolderIcon, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Folder } from '@/hooks/use-folders'

interface BulkActionBarProps {
  count: number
  totalOnPage: number
  totalAll: number
  folders: Folder[]
  onMove: (targetFolderId: string | null) => void
  onDelete: () => void
  onClear: () => void
  onSelectAll: (scope: 'page' | 'all') => void
}

export function BulkActionBar({ count, totalOnPage, totalAll, folders, onMove, onDelete, onClear, onSelectAll }: BulkActionBarProps) {
  const allOnPageSelected = count === totalOnPage && totalOnPage > 0
  const allSelected = count === totalAll

  return (
    <Card className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg border-2 border-primary/50 z-50">
      <div className="flex items-center gap-4 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {count} {count === 1 ? 'item' : 'items'} selected
          </span>
          {!allSelected && (
            <div className="flex gap-2 text-xs">
              {!allOnPageSelected && totalOnPage > count && (
                <button
                  onClick={() => onSelectAll('page')}
                  className="text-primary hover:underline"
                >
                  Select all {totalOnPage} on this page
                </button>
              )}
              {allOnPageSelected && totalAll > totalOnPage && (
                <button
                  onClick={() => onSelectAll('all')}
                  className="text-primary hover:underline"
                >
                  Select all {totalAll} items
                </button>
              )}
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-border" />

        <Select onValueChange={(value) => onMove(value === 'general' ? null : value)}>
          <SelectTrigger className="w-[200px]">
            <FolderIcon className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Move to folder..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>

        <div className="h-6 w-px bg-border" />

        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
