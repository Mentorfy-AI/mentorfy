import { useState, useEffect } from 'react';

export interface SupermemoryProfile {
  static: string[];
  dynamic: string[];
}

export interface UseSupermemoryProfileResult {
  profile: SupermemoryProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch user's Supermemory profile
 * Automatically fetches on mount and provides refetch capability
 */
export function useSupermemoryProfile(): UseSupermemoryProfileResult {
  const [profile, setProfile] = useState<SupermemoryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/supermemory/profile');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch profile (${response.status})`);
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      console.error('Error fetching Supermemory profile:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile,
  };
}
