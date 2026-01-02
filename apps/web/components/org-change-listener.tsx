'use client';

import { useEffect, useRef } from 'react';
import { useOrganization } from '@clerk/nextjs';

/**
 * Listens for organization changes and performs a hard page reload.
 * This component should be placed in the root layout or mentor navigation to ensure
 * it's always active and can detect org changes.
 */
export function OrgChangeListener() {
  const { organization } = useOrganization();
  const prevOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentOrgId = organization?.id ?? null;

    // On first mount, set the initial org ID
    if (prevOrgIdRef.current === null) {
      prevOrgIdRef.current = currentOrgId;
      return;
    }

    // If org ID changed, do a hard page reload to reload all SSR data
    if (prevOrgIdRef.current !== currentOrgId) {
      prevOrgIdRef.current = currentOrgId;
      // Use window.location.href for a true hard reload (bypasses Next.js cache entirely)
      window.location.href = window.location.pathname;
    }
  }, [organization?.id]);

  return null;
}
