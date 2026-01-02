import { useMemo, useState } from 'react'
import { Folder } from './use-folders'

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[]
  level: number
}

export function useFolderTree(folders: Folder[]) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Build tree structure from flat list
  const tree = useMemo(() => {
    const buildTree = (parentId: string | null = null, level: number = 0): FolderTreeNode[] => {
      return folders
        .filter(folder => folder.parent_folder_id === parentId)
        .map(folder => ({
          ...folder,
          children: buildTree(folder.id, level + 1),
          level,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    return buildTree()
  }, [folders])

  const toggleExpand = (folderId: string) => {
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

  const expandAll = () => {
    setExpandedFolders(new Set(folders.map(f => f.id)))
  }

  const collapseAll = () => {
    setExpandedFolders(new Set())
  }

  const isExpanded = (folderId: string) => {
    return expandedFolders.has(folderId)
  }

  // Get all ancestor IDs for a folder
  const getAncestors = (folderId: string): string[] => {
    const folder = folders.find(f => f.id === folderId)
    if (!folder || !folder.parent_folder_id) return []

    return [folder.parent_folder_id, ...getAncestors(folder.parent_folder_id)]
  }

  // Expand path to a specific folder
  const expandTo = (folderId: string) => {
    const ancestors = getAncestors(folderId)
    setExpandedFolders(prev => new Set([...prev, ...ancestors, folderId]))
  }

  // Check if folder can be moved to target (prevent circular references)
  const canMoveTo = (folderId: string, targetParentId: string | null): boolean => {
    if (folderId === targetParentId) return false
    if (!targetParentId) return true

    // Check if target is a descendant of source
    const isDescendant = (parentId: string, checkId: string): boolean => {
      const parent = folders.find(f => f.id === parentId)
      if (!parent) return false
      if (parent.parent_folder_id === checkId) return true
      if (!parent.parent_folder_id) return false
      return isDescendant(parent.parent_folder_id, checkId)
    }

    return !isDescendant(targetParentId, folderId)
  }

  // Get folder path as string (e.g., "Parent/Child/Current")
  const getFolderPath = (folderId: string): string => {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return ''

    const buildPath = (id: string): string => {
      const f = folders.find(folder => folder.id === id)
      if (!f) return ''
      if (!f.parent_folder_id) return f.name
      return `${buildPath(f.parent_folder_id)}/${f.name}`
    }

    return buildPath(folderId)
  }

  return {
    tree,
    expandedFolders,
    toggleExpand,
    expandAll,
    collapseAll,
    isExpanded,
    expandTo,
    canMoveTo,
    getFolderPath,
  }
}
