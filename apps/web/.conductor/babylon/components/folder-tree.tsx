'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ChevronRight, ChevronDown, Folder, FolderPlus, Edit2, Trash2, MoreVertical } from 'lucide-react'
import { FolderTreeNode } from '@/hooks/use-folder-tree'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FolderTreeProps {
  folders: FolderTreeNode[]
  selectedFolder: string | null
  onSelectFolder: (folderId: string | null) => void
  onRenameFolder: (folderId: string, newName: string) => void
  onDeleteFolder: (folderId: string) => void
  onCreateFolder: (name: string, parentId?: string) => void
  editingFolderId: string | null
  onEditFolder: (folderId: string | null) => void
  expandedFolders: Set<string>
  onToggleExpand: (folderId: string) => void
}

interface FolderItemProps {
  folder: FolderTreeNode
  selectedFolder: string | null
  onSelectFolder: (folderId: string | null) => void
  onRenameFolder: (folderId: string, newName: string) => void
  onDeleteFolder: (folderId: string) => void
  onCreateFolder: (name: string, parentId?: string) => void
  editingFolderId: string | null
  onEditFolder: (folderId: string | null) => void
  expandedFolders: Set<string>
  onToggleExpand: (folderId: string) => void
}

function FolderItem({
  folder,
  selectedFolder,
  onSelectFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateFolder,
  editingFolderId,
  onEditFolder,
  expandedFolders,
  onToggleExpand,
}: FolderItemProps) {
  const [editName, setEditName] = useState(folder.name)
  const isExpanded = expandedFolders.has(folder.id)
  const isSelected = selectedFolder === folder.id
  const isEditing = editingFolderId === folder.id

  const { setNodeRef, isOver } = useDroppable({
    id: folder.id,
    data: {
      type: 'folder',
      folder,
    },
  })

  const handleRename = () => {
    if (editName.trim() && editName !== folder.name) {
      onRenameFolder(folder.id, editName.trim())
    }
    onEditFolder(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setEditName(folder.name)
      onEditFolder(null)
    }
  }

  return (
    <div>
      <div
        ref={setNodeRef}
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors',
          isSelected && 'bg-accent',
          isOver && 'bg-accent/50 ring-2 ring-primary/50'
        )}
        style={{ paddingLeft: `${folder.level * 16 + 8}px` }}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(folder.id)
          }}
        >
          {folder.children.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <div className="w-4" />
          )}
        </Button>

        <Folder className="h-4 w-4 text-muted-foreground" />

        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="h-6 px-2 py-0 flex-1"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-sm truncate"
            onClick={() => onSelectFolder(folder.id)}
            onDoubleClick={() => onEditFolder(folder.id)}
          >
            {folder.name}
          </span>
        )}

        {folder.document_count !== undefined && (
          <span className="text-xs text-muted-foreground">{folder.document_count}</span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreateFolder('New Folder', folder.id)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              New Subfolder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEditFolder(folder.id)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteFolder(folder.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && folder.children.length > 0 && (
        <div>
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              selectedFolder={selectedFolder}
              onSelectFolder={onSelectFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onCreateFolder={onCreateFolder}
              editingFolderId={editingFolderId}
              onEditFolder={onEditFolder}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FolderTree({
  folders,
  selectedFolder,
  onSelectFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateFolder,
  editingFolderId,
  onEditFolder,
  expandedFolders,
  onToggleExpand,
}: FolderTreeProps) {
  return (
    <div className="space-y-0.5">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'w-full justify-start mb-2 transition-colors',
          selectedFolder === null && 'bg-accent'
        )}
        onClick={() => onSelectFolder(null)}
      >
        <Folder className="h-4 w-4 mr-2" />
        All Documents
      </Button>

      {folders.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No folders yet</p>
          <p className="text-xs mt-1">Create your first folder to organize documents</p>
        </div>
      ) : (
        folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            selectedFolder={selectedFolder}
            onSelectFolder={onSelectFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            onCreateFolder={onCreateFolder}
            editingFolderId={editingFolderId}
            onEditFolder={onEditFolder}
            expandedFolders={expandedFolders}
            onToggleExpand={onToggleExpand}
          />
        ))
      )}
    </div>
  )
}
