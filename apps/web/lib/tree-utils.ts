/**
 * Utility functions for traversing folder and file tree structures
 */

import type { FolderTree } from '@/hooks/use-google-drive-file-tree'

/**
 * Count all files in a folder tree (including subfolders)
 */
export function countAllFilesInTree(node: FolderTree): number {
  let count = node.files.length
  node.children.forEach(child => {
    count += countAllFilesInTree(child)
  })
  return count
}

/**
 * Get all descendant file IDs from a folder tree
 */
export function getAllDescendantFileIds(node: FolderTree): Set<string> {
  const ids = new Set<string>()
  node.files.forEach(f => ids.add(f.id))
  node.children.forEach(child => {
    getAllDescendantFileIds(child).forEach(id => ids.add(id))
  })
  return ids
}

/**
 * Count documents in a folder and all its subfolders
 * @param folderId - The folder ID to count documents for
 * @param allFolders - All available folders
 * @param allDocuments - All available documents with folder_id
 */
export function countDocsInFolderTree(
  folderId: string,
  allFolders: Array<{ id: string; parent_folder_id: string | null }>,
  allDocuments: Array<{ folder_id: string | null }>
): number {
  const directDocs = allDocuments.filter(doc => doc.folder_id === folderId).length
  const subfolderIds = allFolders.filter(f => f.parent_folder_id === folderId).map(f => f.id)
  const subfoldersCount = subfolderIds.reduce((sum, id) => sum + countDocsInFolderTree(id, allFolders, allDocuments), 0)
  return directDocs + subfoldersCount
}
