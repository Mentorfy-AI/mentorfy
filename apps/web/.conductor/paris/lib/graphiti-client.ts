/**
 * Server-side Graphiti client for knowledge graph search
 *
 * This client calls the FastAPI server for Graphiti operations instead of
 * using subprocess calls to Python scripts.
 */

/**
 * Search result interface
 */
export interface KnowledgeSearchResult {
  fact: string;
  confidence?: number;
  source?: string;
}

/**
 * Search the Graphiti knowledge graph for relevant information
 *
 * @param query - The search query string
 * @param limit - Maximum number of results to return (default: 5)
 * @returns Array of search results with facts and metadata
 */
export async function searchKnowledgeGraph(
  query: string,
  limit: number = 5
): Promise<KnowledgeSearchResult[]> {
  try {
    const backendApiUrl =
      process.env.BACKEND_API_URL || 'http://localhost:8000';

    const response = await fetch(`${backendApiUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `FastAPI search request failed (${response.status}): ${errorData}`
      );
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`FastAPI search error: ${data.error}`);
    }

    return data.results || [];
  } catch (error) {
    console.error('Error searching Graphiti knowledge graph:', error);
    throw new Error(
      `Failed to search knowledge graph: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Health check for Graphiti connection
 */
export async function checkGraphitiHealth(): Promise<boolean> {
  try {
    const backendApiUrl =
      process.env.BACKEND_API_URL || 'http://localhost:8000';

    const response = await fetch(`${backendApiUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    console.error('Graphiti health check failed:', error);
    return false;
  }
}

/**
 * No need to close connections since we're using HTTP calls
 */
export async function closeGraphitiClient(): Promise<void> {
  // No persistent connection to close when using HTTP calls
}
