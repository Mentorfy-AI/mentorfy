"use client"

import React, { useState, useEffect, useMemo } from "react"
import { DndContext, DragEndEvent, PointerSensor, KeyboardSensor, useSensors, useSensor } from '@dnd-kit/core'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search,
  Plus,
  FileText,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Upload,
  X,
  Cloud,
  Link,
  Folder,
  FolderOpen,
  FolderPlus,
  Brain,
  BookOpen,
} from "lucide-react"
import { useFolders } from '@/hooks/use-folders'
import { useDocuments } from '@/hooks/use-documents'
import { useBots } from '@/hooks/use-bots'
import { toast } from 'sonner'
import { BulkActionBar } from '@/components/bulk-action-bar'
import { FolderDialog } from '@/components/folder-dialog'
import { GoogleDriveImport } from '@/components/google-drive-import'

interface DocumentType {
  id: string
  title: string
  size?: string
  file_size?: number
  uploaded?: string
  created_at?: string
  available?: boolean
  processing_status?: string
  folder_id?: string | null
  content?: string
  file_type?: string
  word_count?: number
}

interface FolderNode {
  id: string
  name: string
  description?: string | null
  parent_folder_id?: string | null
  document_count?: number
  children: FolderNode[]
}

const buildFolderTree = (folders: any[]): FolderNode[] => {
  // Create map of id -> folder with empty children array
  const map = new Map(folders.map(f => [f.id, { ...f, children: [] as FolderNode[] }]))
  const roots: FolderNode[] = []

  // Attach children to parents, or add to roots
  folders.forEach(f => {
    const node = map.get(f.id)!
    if (f.parent_folder_id && map.has(f.parent_folder_id)) {
      map.get(f.parent_folder_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [activeTab, setActiveTab] = useState("upload")
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [selectedFolder, setSelectedFolder] = useState("general")
  const [showFileModal, setShowFileModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<DocumentType | null>(null)
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [selectedBotId, setSelectedBotId] = useState<string>('')
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: { progress: number; status: string } }>({})
  const [deletingFolder, setDeletingFolder] = useState<{ id: string; name: string; count: number; subfolderCount: number } | null>(null)
  const [createFolderParent, setCreateFolderParent] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingFolder, setIsDeletingFolder] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const { folders: realFolders, createFolder, updateFolder, deleteFolder } = useFolders()
  const { documents: realDocuments, loading, totalWords, updateDocument, bulkUpdateDocuments, bulkDeleteDocuments, refetch: refetchDocuments } = useDocuments()
  const { bots, loading: botsLoading } = useBots()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Initialize expanded folders with all folders expanded
  useEffect(() => {
    setExpandedFolders(new Set(realFolders.map(f => f.id)))
  }, [realFolders])

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  // Build folder tree
  const folderTree = useMemo(() => {
    return buildFolderTree(realFolders.map(f => ({
      ...f,
      document_count: realDocuments.filter(doc => doc.folder_id === f.id).length
    })))
  }, [realFolders, realDocuments])

  // Transform real folders into UI format
  const folders = useMemo(() => {
    const generalFolder = {
      id: "general",
      name: "General",
      icon: FileText,
      count: realDocuments.filter(doc => doc.folder_id === null).length,
      description: "Documents not in any folder",
    }

    const transformedFolders = realFolders.map(folder => ({
      id: folder.id,
      name: folder.name,
      icon: Folder,
      count: realDocuments.filter(doc => doc.folder_id === folder.id).length,
      description: folder.description || "",
    }))

    return [generalFolder, ...transformedFolders]
  }, [realFolders, realDocuments])

  // Transform real documents into UI format with search and filter
  const contentItems: DocumentType[] = useMemo(() => {
    return realDocuments
      .filter(doc => {
        // Folder filter
        if (selectedFolder === "general") {
          // General folder: only show docs with no folder
          if (doc.folder_id !== null) return false
        } else {
          // Regular folders: only show docs in this specific folder
          if (doc.folder_id !== selectedFolder) return false
        }

        // Search filter
        if (searchQuery && !doc.title.toLowerCase().includes(searchQuery.toLowerCase())) return false

        // Type filter (if needed)
        if (filterType !== "all") {
          // Add type filtering logic based on file_type if needed
        }

        return true
      })
      .map(doc => ({
        id: doc.id,
        title: doc.title,
        size: doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "Unknown",
        file_size: doc.file_size,
        uploaded: doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : "Unknown",
        created_at: doc.created_at,
        available: doc.processing_status === 'available_to_ai',
        processing_status: doc.processing_status,
        folder_id: doc.folder_id,
        content: "Content preview not yet implemented", // TODO: Fetch from API
        file_type: doc.file_type,
        word_count: doc.word_count || 0,
      }))
  }, [realDocuments, selectedFolder, searchQuery, filterType])

  const totalItems = contentItems.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = contentItems.slice(startIndex, endIndex)

  const handleFolderChange = (folderId: string) => {
    setSelectedFolder(folderId)
    setCurrentPage(1)
    setSelectedDocuments(new Set())
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value))
    setCurrentPage(1)
  }

  const handleFileClick = (item: DocumentType) => {
    setSelectedFile(item)
    setShowFileModal(true)
  }

  const handleCloseFileModal = () => {
    setShowFileModal(false)
    setSelectedFile(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter((file) => {
      const validTypes = [".txt", ".pdf", ".mp3", ".mp4", ".doc", ".docx"]
      return validTypes.some((type) => file.name.toLowerCase().endsWith(type))
    })

    setSelectedFiles((prev) => [...prev, ...validFiles])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles((prev) => [...prev, ...files])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    if (!selectedBotId) {
      toast.error("Please select a bot before uploading")
      return
    }

    try {
      const uploadPromises = selectedFiles.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('botId', selectedBotId)
        if (selectedFolder && selectedFolder !== 'all') {
          formData.append('folderId', selectedFolder)
        }

        setUploadingFiles(prev => ({
          ...prev,
          [file.name]: { progress: 0, status: 'uploading' }
        }))

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        const result = await response.json()

        setUploadingFiles(prev => ({
          ...prev,
          [file.name]: { progress: 100, status: 'complete' }
        }))

        return result
      })

      toast.promise(
        Promise.all(uploadPromises),
        {
          loading: `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...`,
          success: (results) => {
            setSelectedFiles([])
            setShowUploadModal(false)
            setUploadingFiles({})
            // Refetch documents to show new uploads
            setTimeout(() => refetchDocuments(), 1000)
            return `Successfully uploaded ${results.length} file${results.length > 1 ? 's' : ''}`
          },
          error: (err) => {
            setUploadingFiles({})
            return err.message || 'Failed to upload files'
          },
        }
      )
    } catch (error) {
      console.error("Upload error:", error)
      setUploadingFiles({})
    }
  }

  const handleDocumentSelect = (documentId: string, checked: boolean) => {
    setSelectedDocuments((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(documentId)
      } else {
        next.delete(documentId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedDocuments.size === currentItems.length) {
      setSelectedDocuments(new Set())
    } else {
      setSelectedDocuments(new Set(currentItems.map((d) => d.id)))
    }
  }

  const handleSelectAllScope = (scope: 'page' | 'all') => {
    if (scope === 'page') {
      setSelectedDocuments(new Set(currentItems.map((d) => d.id)))
    } else {
      setSelectedDocuments(new Set(contentItems.map((d) => d.id)))
    }
  }

  const handleBulkMove = async (targetFolderId: string | null) => {
    try {
      await bulkUpdateDocuments(Array.from(selectedDocuments), {
        folder_id: targetFolderId === 'general' ? null : targetFolderId,
      })
      toast.success(`Moved ${selectedDocuments.size} documents`)
      setSelectedDocuments(new Set())
    } catch (error: any) {
      toast.error(error.message || 'Failed to move documents')
    }
  }

  const handleBulkDelete = async () => {
    const confirmed = confirm(`Delete ${selectedDocuments.size} documents? This cannot be undone.`)
    if (!confirmed) return

    try {
      await bulkDeleteDocuments(Array.from(selectedDocuments))
      toast.success(`Deleted ${selectedDocuments.size} documents`)
      setSelectedDocuments(new Set())
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete documents')
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    const confirmed = confirm('Delete this document? This cannot be undone.')
    if (!confirmed) return

    try {
      await bulkDeleteDocuments([documentId])
      toast.success('Document deleted')
      if (selectedFile?.id === documentId) {
        setShowFileModal(false)
        setSelectedFile(null)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete document')
    }
  }

  const handleCreateFolder = async (name: string, description?: string) => {
    try {
      await createFolder({
        name,
        description,
        parent_folder_id: createFolderParent?.id || undefined,
      })

      // Expand parent if creating subfolder
      if (createFolderParent?.id) {
        setExpandedFolders(prev => new Set([...prev, createFolderParent.id]))
      }

      toast.success(createFolderParent
        ? `Created subfolder in "${createFolderParent.name}"`
        : 'Folder created'
      )
      setCreateFolderParent(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create folder')
    }
  }

  const handleConfirmDeleteFolder = async () => {
    if (!deletingFolder) return

    setIsDeletingFolder(true)
    try {
      console.log('Deleting folder:', deletingFolder)
      console.log('Real folders:', realFolders)

      // Check if folder still exists
      const folderExists = realFolders.find(f => f.id === deletingFolder.id)
      if (!folderExists) {
        toast.error('Folder no longer exists')
        setDeletingFolder(null)
        setIsDeletingFolder(false)
        return
      }

      await deleteFolder(deletingFolder.id)
      console.log('Folder deleted successfully')
      toast.success(`Deleted folder "${deletingFolder.name}" and ${deletingFolder.count} document${deletingFolder.count !== 1 ? 's' : ''}`)
      setDeletingFolder(null)

      // If we were viewing this folder, switch to General
      if (selectedFolder === deletingFolder.id) {
        setSelectedFolder('general')
      }

      // Refetch documents to update counts
      setTimeout(() => refetchDocuments(), 500)
    } catch (error: any) {
      console.error('Delete folder error:', error)
      toast.error(error.message || 'Failed to delete folder')
    } finally {
      setIsDeletingFolder(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const documentId = active.id as string
    const targetFolderId = over.id as string

    try {
      await updateDocument(documentId, {
        folder_id: targetFolderId === 'general' ? null : targetFolderId
      })
      toast.success('Document moved to folder')
    } catch (error) {
      toast.error('Failed to move document')
      console.error('Drag error:', error)
    }
  }

  const renderFolderTree = (nodes: FolderNode[], level: number = 0): JSX.Element[] => {
    return nodes.map(node => {
      const hasChildren = node.children.length > 0
      const isExpanded = expandedFolders.has(node.id)
      const isSelected = selectedFolder === node.id
      const Icon = isSelected && !hasChildren ? FolderOpen : Folder

      return (
        <React.Fragment key={node.id}>
          <div
            onClick={() => handleFolderChange(node.id)}
            className={`w-full flex items-center gap-2 p-3 rounded-md cursor-pointer transition-colors group ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
            style={{ paddingLeft: `${12 + level * 16}px` }}
          >
            {/* Chevron for folders with children */}
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFolder(node.id)
                }}
                className="flex-shrink-0 h-4 w-4"
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-4" /> /* Spacer for alignment */
            )}

            {/* Folder icon */}
            <Icon className="h-5 w-5 flex-shrink-0" />

            {/* Folder content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium truncate text-base">{node.name}</span>
                <div className="flex items-center gap-1">
                  <Badge variant={isSelected ? "secondary" : "outline"} className="ml-1 text-xs px-1 py-0">
                    {node.document_count || 0}
                  </Badge>

                  {/* Add subfolder button */}
                  {node.id !== "general" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCreateFolderParent({ id: node.id, name: node.name })
                        setShowFolderDialog(true)
                      }}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Delete button */}
                  {node.id !== "general" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingFolder({
                          id: node.id,
                          name: node.name,
                          count: node.document_count || 0,
                          subfolderCount: node.children.length
                        })
                      }}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              {node.description && (
                <p className="text-sm mt-0.5 truncate opacity-75">{node.description}</p>
              )}
            </div>
          </div>

          {/* Render children if expanded */}
          {hasChildren && isExpanded && renderFolderTree(node.children, level + 1)}
        </React.Fragment>
      )
    })
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "upload":
        return (
          <div className="space-y-4">
            {/* Bot Selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">Select Bot *</label>
              <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                <SelectTrigger className={!selectedBotId ? "text-muted-foreground" : ""}>
                  <SelectValue placeholder={botsLoading ? "Loading bots..." : "Choose which bot can access these files"} />
                </SelectTrigger>
                <SelectContent>
                  {bots.map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>
                      {bot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedBotId && <p className="text-xs text-muted-foreground mt-1">Required for upload</p>}
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Drop files here or click to browse</h3>
              <p className="text-sm text-muted-foreground mb-4">Supported formats: .txt files only (PDF, MP3, MP4 coming soon)</p>
              <input
                type="file"
                multiple
                accept=".txt"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <Button asChild variant="outline">
                <label htmlFor="file-upload" className="cursor-pointer">
                  Choose Files
                </label>
              </Button>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-3">Selected Files ({selectedFiles.length})</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(index)} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case "google-drive":
        return (
          <GoogleDriveImport
            selectedBotId={selectedBotId}
            bots={bots}
            isLoadingBots={botsLoading}
            onBotChange={setSelectedBotId}
            onImportComplete={() => {
              setShowUploadModal(false)
              setTimeout(() => refetchDocuments(), 1000)
            }}
          />
        )

      case "other":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Link className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Import from Other Sources</h3>
              <p className="text-sm text-muted-foreground">Add content from URLs, cloud storage, or other platforms</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Website URL</label>
                <Input placeholder="https://example.com/article" />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">YouTube URL</label>
                <Input placeholder="https://youtube.com/watch?v=..." />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Dropbox Link</label>
                <Input placeholder="https://dropbox.com/s/..." />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">OneDrive Link</label>
                <Input placeholder="https://onedrive.live.com/..." />
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  // File content modal
  if (showFileModal && selectedFile) {
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-background rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="border-b p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-balance">{selectedFile.title}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{selectedFile.size}</span>
                  <span>Uploaded {selectedFile.uploaded}</span>
                  {selectedFile.available && (
                    <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                      Available to AI
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCloseFileModal} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-6">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  File Content
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full overflow-y-auto">
                <div className="prose prose-sm max-w-none">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedFile.content}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="border-t p-4 flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseFileModal}>
              Close
            </Button>
            <Button variant="destructive" onClick={() => handleDeleteDocument(selectedFile.id)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
      <div className="h-screen bg-background flex flex-col">
        <div className="border-b bg-background p-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-balance">Mind</h1>
            <p className="text-muted-foreground text-pretty">Manage Knowledge Base</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
            <Card className="lg:col-span-1 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <FolderOpen className="h-6 w-6 text-primary" />
                    Folders
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setCreateFolderParent(null)
                      setShowFolderDialog(true)
                    }}
                  >
                    <FolderPlus className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <div className="space-y-2">
                  {renderFolderTree([
                    {
                      id: "general",
                      name: "General",
                      description: "Documents not in any folder",
                      parent_folder_id: null,
                      children: [],
                      document_count: realDocuments.filter(doc => doc.folder_id === null).length,
                    } as FolderNode,
                    ...folderTree
                  ])}
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 bg-card border rounded-lg p-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Search knowledge base..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-7 h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-600 border-0 text-sm px-3 py-1"
                  >
                    {totalWords.toLocaleString()} words
                  </Badge>
                  <Button onClick={() => setShowUploadModal(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Content
                  </Button>
                </div>
              </div>

              <Card className="flex-1 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Knowledge Base Content</CardTitle>
                    <CardDescription className="text-sm">
                      {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} items
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-0">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                      <p className="text-muted-foreground">Loading documents...</p>
                    </div>
                  ) : contentItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                      <FileText className="h-12 w-12 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No documents found</p>
                      <Button onClick={() => setShowUploadModal(true)} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Upload Document
                      </Button>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="flex-1 overflow-y-auto space-y-2">
                        {currentItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                          >
                            <Checkbox
                              checked={selectedDocuments.has(item.id)}
                              onCheckedChange={(checked) => handleDocumentSelect(item.id, checked as boolean)}
                            />
                            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => handleFileClick(item)}
                                className="text-left hover:underline font-medium text-sm w-full text-foreground"
                              >
                                {item.title}
                              </button>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>{item.word_count?.toLocaleString() || 0} words</span>
                                <span>·</span>
                                <span>{item.size}</span>
                                {item.available && (
                                  <>
                                    <Badge
                                      variant="secondary"
                                      className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-600 border-0 text-xs px-2 py-0.5 ml-1"
                                    >
                                      Available to AI
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-sm text-muted-foreground">{item.uploaded}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFileClick(item)}
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDocument(item.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t mt-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Items per page:</span>
                          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                            <SelectTrigger className="w-20 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="h-8 px-3"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum
                              if (totalPages <= 5) {
                                pageNum = i + 1
                              } else if (currentPage <= 3) {
                                pageNum = i + 1
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i
                              } else {
                                pageNum = currentPage - 2 + i
                              }

                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePageChange(pageNum)}
                                  className="h-8 w-8 p-0 text-sm"
                                >
                                  {pageNum}
                                </Button>
                              )
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="h-8 px-3"
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          Page {currentPage} of {totalPages}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl">
              <div className="border-b p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight">Add Content</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowUploadModal(false)} className="h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant={activeTab === "upload" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("upload")}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                  <Button
                    variant={activeTab === "google-drive" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("google-drive")}
                  >
                    <Cloud className="h-4 w-4 mr-2" />
                    Google Drive
                  </Button>
                  <Button
                    variant={activeTab === "other" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("other")}
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Other Sources
                  </Button>
                </div>
              </div>

              <div className="p-6">{renderTabContent()}</div>

              <div className="border-t p-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </Button>
                {activeTab === 'upload' && (
                  <Button
                    onClick={handleUpload}
                    disabled={selectedFiles.length === 0 || !selectedBotId}
                  >
                    Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bulk Action Bar */}
        {selectedDocuments.size > 0 && (
          <BulkActionBar
            count={selectedDocuments.size}
            totalOnPage={currentItems.length}
            totalAll={contentItems.length}
            folders={realFolders}
            onMove={handleBulkMove}
            onDelete={handleBulkDelete}
            onClear={() => setSelectedDocuments(new Set())}
            onSelectAll={handleSelectAllScope}
          />
        )}

        {/* Folder Dialog */}
        <FolderDialog
          open={showFolderDialog}
          onOpenChange={setShowFolderDialog}
          folders={realFolders}
          onSubmit={handleCreateFolder}
          parentFolder={createFolderParent}
        />

        {/* Delete Folder Confirmation Dialog */}
        {deletingFolder && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-md border">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold mb-2">
                      {deletingFolder.subfolderCount > 0 ? `Cannot Delete "${deletingFolder.name}"` : `Delete "${deletingFolder.name}"?`}
                    </h2>
                    {deletingFolder.subfolderCount > 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground mb-4">
                          This folder contains <span className="font-medium text-foreground">{deletingFolder.subfolderCount} subfolder{deletingFolder.subfolderCount !== 1 ? 's' : ''}</span>.
                          You must delete or move all subfolders before deleting this folder.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Please delete the subfolders first, or move them to another location.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-4">
                          This folder contains <span className="font-medium text-foreground">{deletingFolder.count} document{deletingFolder.count !== 1 ? 's' : ''}</span>.
                          Deleting this folder will permanently delete all documents inside.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          If you want to keep the documents, please move them to another folder first.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t p-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeletingFolder(null)}
                >
                  {deletingFolder.subfolderCount > 0 ? 'Close' : 'Cancel'}
                </Button>
                {deletingFolder.subfolderCount === 0 && (
                  <Button
                    variant="destructive"
                    onClick={handleConfirmDeleteFolder}
                    disabled={isDeletingFolder}
                  >
                    {isDeletingFolder ? 'Deleting...' : 'Delete Folder and Contents'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
  )
}
