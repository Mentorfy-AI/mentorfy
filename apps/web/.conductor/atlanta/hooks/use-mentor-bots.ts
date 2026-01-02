import { useState, useEffect } from 'react';
import { useOrganization } from '@clerk/nextjs';

interface MentorBot {
  id: string;
  name: string;
  description: string | null;
  icon?: any;
}

// Organization-keyed cache to prevent fetching wrong org's bots
// Key format: orgId -> { bots, fetchPromise }
const botCache = new Map<string, {
  bots: MentorBot[];
  fetchPromise: Promise<MentorBot[]> | null;
}>();

async function fetchMentorBots(orgId: string): Promise<MentorBot[]> {
  const cached = botCache.get(orgId);

  // Return cached data if available
  if (cached?.bots && cached.bots.length > 0) {
    console.log('[fetchMentorBots] Using cached bots for org:', orgId, 'count:', cached.bots.length);
    return cached.bots;
  }

  // Return existing promise if fetch is in progress for this org
  if (cached?.fetchPromise) {
    console.log('[fetchMentorBots] Fetch already in progress for org:', orgId);
    return cached.fetchPromise;
  }

  console.log('[fetchMentorBots] Starting new fetch for org:', orgId);

  // Start new fetch for this org
  const fetchPromise = (async () => {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();

      console.log('[fetchMentorBots] API response:', {
        orgId,
        success: data.success,
        agentCount: data.agents?.length || 0,
        agents: data.agents?.map((a: any) => ({ id: a.id, name: a.name }))
      });

      if (data.success && data.agents) {
        // Store in org-specific cache
        botCache.set(orgId, {
          bots: data.agents,
          fetchPromise: null,
        });
        return data.agents;
      }

      return [];
    } catch (error) {
      console.error('[fetchMentorBots] Error fetching mentor bots:', error);
      // Clear failed fetch promise
      const current = botCache.get(orgId);
      if (current) {
        botCache.set(orgId, { ...current, fetchPromise: null });
      }
      return [];
    }
  })();

  // Store the promise while fetching
  botCache.set(orgId, {
    bots: cached?.bots || [],
    fetchPromise,
  });

  return fetchPromise;
}

/**
 * Hook to fetch and cache mentor bots per organization
 * Automatically clears cache when organization changes
 */
export function useMentorBots() {
  const { organization } = useOrganization();
  const orgId = organization?.id || '';

  const [bots, setBots] = useState<MentorBot[]>(() => {
    // Initialize with cached bots for current org if available
    return botCache.get(orgId)?.bots || [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    // Only show loading if we don't have cached data for this org
    return !botCache.get(orgId)?.bots;
  });

  useEffect(() => {
    let isMounted = true;

    async function loadBots() {
      if (!orgId) {
        // No org selected yet - clear state
        console.log('[useMentorBots] No org ID yet, clearing bots')
        setBots([]);
        setIsLoading(false);
        return;
      }

      console.log('[useMentorBots] Loading bots for org:', orgId)

      try {
        setIsLoading(true);
        const data = await fetchMentorBots(orgId);

        console.log('[useMentorBots] Fetched bots:', {
          orgId,
          botCount: data.length,
          cached: !!botCache.get(orgId)?.bots,
          bots: data.map(b => ({ id: b.id, name: b.name }))
        })

        if (isMounted) {
          setBots(data);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[useMentorBots] Error loading bots:', error);
        if (isMounted) {
          setBots([]);
          setIsLoading(false);
        }
      }
    }

    loadBots();

    return () => {
      isMounted = false;
    };
  }, [orgId]); // Re-fetch when org changes

  return { bots, isLoading };
}

// Export function to clear cache if needed (clears all orgs or specific org)
export function clearMentorBotsCache(orgId?: string) {
  if (orgId) {
    botCache.delete(orgId);
  } else {
    botCache.clear();
  }
}
