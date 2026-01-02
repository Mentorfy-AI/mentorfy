import { useState, useEffect } from 'react';
import { useOrganization } from '@clerk/nextjs';
import { calculateLevel, getWordsToNextLevel, type UserLevel } from '@/lib/gamification';

export interface UserMemory {
  memoryText: string;
  wordCount: number;
  updatedAt: string;
}

export interface UserMemoryHookResult {
  memory: UserMemory | null;
  level: UserLevel;
  wordsToNextLevel: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Organization-keyed cache to prevent fetching wrong org's memory
// Key format: orgId -> { memory, fetchPromise }
const memoryCache = new Map<string, {
  memory: UserMemory | null;
  fetchPromise: Promise<UserMemory | null> | null;
}>();

async function fetchUserMemory(orgId: string): Promise<UserMemory | null> {
  const cached = memoryCache.get(orgId);

  // Return cached data if available
  if (cached?.memory !== undefined && cached.memory !== null) {
    console.log('[fetchUserMemory] Using cached memory for org:', orgId);
    return cached.memory;
  }

  // Return existing promise if fetch is in progress for this org
  if (cached?.fetchPromise) {
    console.log('[fetchUserMemory] Fetch already in progress for org:', orgId);
    return cached.fetchPromise;
  }

  console.log('[fetchUserMemory] Starting new fetch for org:', orgId);

  // Start new fetch for this org
  const fetchPromise = (async () => {
    try {
      const response = await fetch('/api/memory');
      const data = await response.json();

      console.log('[fetchUserMemory] API response:', { orgId, success: data.success, hasMemory: !!data.memory });

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch memory');
      }

      const memory = data.memory ? {
        memoryText: data.memory.memory_text,
        wordCount: data.memory.word_count,
        updatedAt: data.memory.updated_at,
      } : null;

      // Store in org-specific cache
      memoryCache.set(orgId, {
        memory,
        fetchPromise: null,
      });

      console.log('[fetchUserMemory] Cached memory for org:', orgId, 'wordCount:', memory?.wordCount);
      return memory;
    } catch (err) {
      console.error('[fetchUserMemory] Error fetching user memory:', err);
      // Clear failed fetch promise
      const current = memoryCache.get(orgId);
      if (current) {
        memoryCache.set(orgId, { ...current, fetchPromise: null });
      }
      throw err;
    }
  })();

  // Store the promise while fetching
  memoryCache.set(orgId, {
    memory: cached?.memory || null,
    fetchPromise,
  });

  return fetchPromise;
}

/**
 * Hook to fetch and manage user memory data
 * Automatically calculates level and progress from word count
 * Uses org-keyed cache to prevent fetching wrong org's memory
 */
export function useUserMemory(): UserMemoryHookResult {
  const { organization } = useOrganization();
  const orgId = organization?.id || '';

  const [memory, setMemory] = useState<UserMemory | null>(() => {
    // Initialize with cached memory for current org if available
    return memoryCache.get(orgId)?.memory || null;
  });
  const [isLoading, setIsLoading] = useState(() => {
    // Only show loading if we don't have cached data for this org
    return !memoryCache.get(orgId)?.memory;
  });
  const [error, setError] = useState<string | null>(null);

  const fetchMemory = async () => {
    if (!orgId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Clear cache for this org to force refetch
      memoryCache.delete(orgId);

      const result = await fetchUserMemory(orgId);
      setMemory(result);
    } catch (err) {
      console.error('[useUserMemory] Error fetching user memory:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadMemory() {
      if (!orgId) {
        console.log('[useUserMemory] No org ID yet, clearing memory');
        setMemory(null);
        setIsLoading(false);
        return;
      }

      console.log('[useUserMemory] Loading memory for org:', orgId);

      const cached = memoryCache.get(orgId);
      if (cached?.memory !== undefined) {
        // Use cached data
        console.log('[useUserMemory] Using cached memory for org:', orgId);
        setMemory(cached.memory);
        setIsLoading(false);
        return;
      }

      // Fetch fresh data
      try {
        const result = await fetchUserMemory(orgId);
        if (isMounted) {
          setMemory(result);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('[useUserMemory] Error loading memory:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    }

    loadMemory();

    return () => {
      isMounted = false;
    };
  }, [orgId]); // Re-fetch when org changes

  // Calculate level and progress from word count
  const wordCount = memory?.wordCount ?? 0;
  const level = calculateLevel(wordCount);
  const wordsToNextLevel = getWordsToNextLevel(wordCount);

  return {
    memory,
    level,
    wordsToNextLevel,
    isLoading,
    error,
    refetch: fetchMemory,
  };
}

// Export function to clear cache if needed (clears all orgs or specific org)
export function clearUserMemoryCache(orgId?: string) {
  if (orgId) {
    memoryCache.delete(orgId);
  } else {
    memoryCache.clear();
  }
}
