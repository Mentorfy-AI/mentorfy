'use client'

import React from 'react'
import { Folder, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FolderNode {
  id: string
  name: string
  description?: string | null
  parent_folder_id?: string | null
  document_count?: number
  children?: FolderNode[]
}

interface FolderSelectorProps {
  folders: FolderNode[]
  selectedFolder: string | null
  onSelectFolder: (folderId: string | null) => void
  generalDocCount?: number
  className?: string
}

export function FolderSelector({
  folders,
  selectedFolder,
  onSelectFolder,
  generalDocCount = 0,
  className,
}: FolderSelectorProps) {
  // Find the selected folder name
  const findFolderName = (folderId: string | null): string => {
    if (folderId === null || folderId === 'general') return 'All Documents'

    const findInTree = (nodes: FolderNode[]): string | null => {
      for (const node of nodes) {
        if (node.id === folderId) return node.name
        if (node.children && node.children.length > 0) {
          const found = findInTree(node.children)
          if (found) return found
        }
      }
      return null
    }

    return findInTree(folders) || 'All Documents'
  }

  // Render folder items recursively with indentation
  const renderFolderItems = (nodes: FolderNode[], level: number = 0): React.ReactNode[] => {
    return nodes.flatMap(node => {
      const isSelected = selectedFolder === node.id
      const items: React.ReactNode[] = [
        <DropdownMenuItem
          key={node.id}
          onClick={() => onSelectFolder(node.id)}
          className={cn(
            'cursor-pointer',
            isSelected && 'bg-accent font-medium'
          )}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="flex-1 truncate">{node.name}</span>
          {node.document_count !== undefined && (
            <Badge variant="outline" className="ml-2 text-xs flex-shrink-0">
              {node.document_count}
            </Badge>
          )}
        </DropdownMenuItem>
      ]

      // Add children if they exist
      if (node.children && node.children.length > 0) {
        items.push(...renderFolderItems(node.children, level + 1))
      }

      return items
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn('flex items-center gap-2', className)}>
          <Folder className="h-4 w-4" />
          <span className="hidden sm:inline">{findFolderName(selectedFolder)}</span>
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-96 overflow-y-auto">
        <DropdownMenuItem
          onClick={() => onSelectFolder(null)}
          className={cn(
            'cursor-pointer',
            (selectedFolder === null || selectedFolder === 'general') && 'bg-accent font-medium'
          )}
        >
          <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="flex-1">All Documents</span>
          <Badge variant="outline" className="ml-2 text-xs">
            {generalDocCount}
          </Badge>
        </DropdownMenuItem>
        {folders.length > 0 && <DropdownMenuSeparator />}
        {renderFolderItems(folders)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
