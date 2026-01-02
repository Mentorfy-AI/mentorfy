"use client"

import { useState } from 'react'
import { ChevronDown, ChevronRight, FolderOpen, FileText, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAllDescendantFileIds, countAllFilesInTree } from '@/lib/tree-utils'
import type { FolderTree } from '@/hooks/use-google-drive-file-tree'

interface GoogleDriveFolderSelectorProps {
  tree: FolderTree | null
  loading: boolean
  selectedFileIds: Set<string>
  onSelectionChange: (fileIds: Set<string>) => void
  onImport: () => void
}

/**
 * Recursive folder tree node component with checkbox selection
 */
function FolderTreeNode({
  node,
  level = 0,
  selectedFileIds,
  onSelectionChange,
}: {
  node: FolderTree
  level?: number
  selectedFileIds: Set<string>
  onSelectionChange: (fileIds: Set<string>) => void
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2)

  const hasChildren = node.children.length > 0
  const fileCount = node.files.length

  const allDescendantFileIds = getAllDescendantFileIds(node)
  const totalDescendantFiles = allDescendantFileIds.size

  // Debug logging for root node
  if (level === 0) {
    console.log(`📊 Root folder "${node.name}": ${totalDescendantFiles} total files, ${fileCount} direct files, ${hasChildren} children`)
  }

  // Count selected files in this folder and all subfolders
  const selectedInFolder = Array.from(allDescendantFileIds).filter(id => selectedFileIds.has(id)).length
  const allFilesSelectedInFolder = totalDescendantFiles > 0 && selectedInFolder === totalDescendantFiles
  const someFilesSelectedInFolder = selectedInFolder > 0 && selectedInFolder < totalDescendantFiles

  const handleFolderCheckboxChange = () => {
    const newSelection = new Set(selectedFileIds)

    if (allFilesSelectedInFolder) {
      // Deselect all descendant files
      allDescendantFileIds.forEach(id => newSelection.delete(id))
    } else {
      // Select all descendant files
      allDescendantFileIds.forEach(id => newSelection.add(id))
    }

    onSelectionChange(newSelection)
  }

  const handleFileCheckboxChange = (fileId: string) => {
    const newSelection = new Set(selectedFileIds)

    if (newSelection.has(fileId)) {
      newSelection.delete(fileId)
    } else {
      newSelection.add(fileId)
    }

    onSelectionChange(newSelection)
  }

  return (
    <div className="space-y-1">
      {/* Folder Row */}
      <div className="flex items-center space-x-1 cursor-pointer hover:bg-gray-600/30 rounded px-1 py-1"
        style={{ marginLeft: `${level * 16}px` }}>
        {/* Checkbox for folder */}
        <button
          className="p-0.5 hover:bg-gray-500/20 rounded"
          onClick={handleFolderCheckboxChange}
        >
          {allFilesSelectedInFolder ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : someFilesSelectedInFolder ? (
            <div className="w-4 h-4 bg-yellow-400/40 border border-yellow-400 rounded" />
          ) : (
            <div className="w-4 h-4 border border-gray-500 rounded" />
          )}
        </button>

        {/* Expand/Collapse Arrow */}
        <button
          className="p-0.5"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {(hasChildren || fileCount > 0) && (
            isExpanded ?
              <ChevronDown className="w-4 h-4 text-gray-400" /> :
              <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          {!hasChildren && fileCount === 0 && <div className="w-4 h-4" />}
        </button>

        <FolderOpen className="w-4 h-4 text-yellow-400" />
        <span className="text-sm text-gray-200 font-medium">{node.name}</span>

        {/* File count badge - shows total files in this folder and all subfolders */}
        {totalDescendantFiles > 0 && (
          <Badge variant="outline" className="ml-auto bg-blue-900/30 text-blue-300 border-blue-700 text-xs">
            {totalDescendantFiles} file{totalDescendantFiles !== 1 ? 's' : ''}
          </Badge>
        )}
        {totalDescendantFiles === 0 && (
          <span className="text-xs text-gray-500 ml-auto">0 files</span>
        )}
      </div>

      {/* Expanded folder contents */}
      {isExpanded && (
        <div>
          {/* Subfolders */}
          {hasChildren && (
            <div>
              {node.children.map((child) => (
                <FolderTreeNode
                  key={child.google_drive_folder_id}
                  node={child}
                  level={level + 1}
                  selectedFileIds={selectedFileIds}
                  onSelectionChange={onSelectionChange}
                />
              ))}
            </div>
          )}

          {/* Files */}
          {fileCount > 0 && (
            <div style={{ marginLeft: `${(level + 1) * 16}px` }} className="space-y-0.5">
              {node.files.map((file) => {
                const isSelected = selectedFileIds.has(file.id)
                return (
                  <div
                    key={file.id}
                    className="flex items-center space-x-1 px-1 py-0.5 text-gray-400 hover:bg-gray-600/20 rounded text-xs"
                    style={{ marginLeft: `${16}px` }}
                  >
                    <button
                      className="p-0.5 hover:bg-gray-500/20 rounded"
                      onClick={() => handleFileCheckboxChange(file.id)}
                    >
                      {isSelected ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <div className="w-3 h-3 border border-gray-600 rounded" />
                      )}
                    </button>
                    <FileText className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Component to display and select files from Google Drive folder tree
 */
export function GoogleDriveFolderSelector({
  tree,
  loading,
  selectedFileIds,
  onSelectionChange,
  onImport,
}: GoogleDriveFolderSelectorProps) {
  if (!tree) {
    return null
  }

  const totalFiles = countAllFilesInTree(tree)
  const selectedCount = selectedFileIds.size
  const allSelected = totalFiles > 0 && selectedCount === totalFiles

  const handleSelectAll = () => {
    const getAllFileIds = (node: FolderTree): Set<string> => {
      const ids = new Set<string>()
      node.files.forEach(f => ids.add(f.id))
      node.children.forEach(child => {
        getAllFileIds(child).forEach(id => ids.add(id))
      })
      return ids
    }

    onSelectionChange(getAllFileIds(tree))
  }

  const handleDeselectAll = () => {
    onSelectionChange(new Set())
  }

  return (
    <div className="space-y-4">
      {/* Selection Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h5 className="text-sm font-medium text-gray-300">Folder Structure</h5>
          <span className="text-xs text-gray-400">
            {selectedCount > 0 ? `${selectedCount}/${totalFiles} selected` : `${totalFiles} files`}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            disabled={allSelected}
            className="text-xs px-2 py-1 bg-emerald-700/50 hover:bg-emerald-700 text-emerald-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            disabled={selectedCount === 0}
            className="text-xs px-2 py-1 bg-gray-600/50 hover:bg-gray-600 text-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div className="p-3 bg-gray-800/50 rounded border border-gray-600 max-h-64 overflow-y-auto text-xs space-y-1">
        <FolderTreeNode
          node={tree}
          level={0}
          selectedFileIds={selectedFileIds}
          onSelectionChange={onSelectionChange}
        />
      </div>

      {/* Import Button */}
      <Button
        onClick={onImport}
        disabled={selectedCount === 0 || loading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Check className="w-4 h-4 mr-2" />
        Import {selectedCount > 0 ? `${selectedCount} file${selectedCount !== 1 ? 's' : ''}` : 'Documents'}
      </Button>
    </div>
  )
}
