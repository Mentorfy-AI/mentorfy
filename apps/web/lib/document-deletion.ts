/**
 * Consolidated document deletion logic
 * Single source of truth for deleting one or more documents
 * Handles cascading deletion of knowledge graph nodes, storage files, and database records
 */

export interface DeleteDocumentsResponse {
  success: boolean;
  deleted_count?: number;
  errors?: string[];
  error?: string;
}

/**
 * Delete one or more documents with full cascading cleanup
 *
 * This function:
 * 1. Sends batch deletion request to FastAPI backend
 * 2. Backend handles:
 *    - Lookup of KG entities in kg_entity_mapping
 *    - Deletion of entities from knowledge graph (Graphiti/Supermemory)
 *    - Deletion of storage files
 *    - Deletion of document records from Supabase
 * 3. Returns aggregated results
 *
 * @param documentIds - Array of document IDs to delete (can be length 1)
 * @param orgId - Organization ID for verification
 * @returns Response with success status and deleted count
 * @throws Will throw on network errors; caller should handle
 */
export async function deleteDocuments(
  documentIds: string[],
  orgId: string
): Promise<DeleteDocumentsResponse> {
  if (!documentIds || documentIds.length === 0) {
    return {
      success: false,
      error: 'No documents specified for deletion',
    };
  }

  try {
    const backendApiUrl =
      process.env.BACKEND_API_URL || 'http://localhost:8000';

    const response = await fetch(`${backendApiUrl}/api/documents/batch`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_ids: documentIds,
        organization_id: orgId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          errorData.error ||
          errorData.detail ||
          `Failed to delete documents (${response.status})`,
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error deleting documents',
    };
  }
}
