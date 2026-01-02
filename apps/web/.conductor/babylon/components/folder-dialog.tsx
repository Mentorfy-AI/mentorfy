'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Folder } from '@/hooks/use-folders'

interface FolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: Folder[]
  onSubmit: (name: string, description?: string, parentFolderId?: string) => void
  defaultParentId?: string
  parentFolder?: { id: string; name: string } | null
}

export function FolderDialog({
  open,
  onOpenChange,
  folders,
  onSubmit,
  defaultParentId,
  parentFolder,
}: FolderDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentFolderId, setParentFolderId] = useState<string | undefined>(defaultParentId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) return

    onSubmit(name.trim(), description.trim() || undefined, parentFolderId)

    // Reset form
    setName('')
    setDescription('')
    setParentFolderId(undefined)
    onOpenChange(false)
  }

  const handleCancel = () => {
    // Reset form
    setName('')
    setDescription('')
    setParentFolderId(undefined)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {parentFolder
              ? `Create subfolder in "${parentFolder.name}"`
              : 'Create New Folder'}
          </DialogTitle>
          <DialogDescription>
            {parentFolder
              ? `This folder will be created inside "${parentFolder.name}"`
              : 'Create a new folder to organize your documents'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Folder Name</Label>
              <Input
                id="name"
                placeholder="Enter folder name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter folder description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create Folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
