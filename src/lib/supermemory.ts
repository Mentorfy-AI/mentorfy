const SUPERMEMORY_API_KEY = process.env.SUPERMEMORY_API_KEY!
const SUPERMEMORY_BASE_URL = 'https://api.supermemory.ai'

interface SearchResult {
  content: string
  score: number
}

export async function searchMemories(containerId: string, query: string): Promise<string[]> {
  const res = await fetch(`${SUPERMEMORY_BASE_URL}/v4/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPERMEMORY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      containerTag: containerId,
      limit: 5,
    }),
  })

  if (!res.ok) {
    console.error('Supermemory search failed:', await res.text())
    return []
  }

  const data = await res.json()
  return (data.results || []).map((r: any) => r.memory || r.content)
}

export function writeMemory(containerId: string, content: string): void {
  // Fire-and-forget - don't await in request path
  fetch(`${SUPERMEMORY_BASE_URL}/v3/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPERMEMORY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      metadata: { containerTag: containerId },
    }),
  }).catch(err => console.error('Supermemory write failed:', err))
}

// Helper to generate container ID
// Session IDs are globally unique UUIDs, so we just use them directly
export function getContainerId(sessionId: string): string {
  return sessionId
}
