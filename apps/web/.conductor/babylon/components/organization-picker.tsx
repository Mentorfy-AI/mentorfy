'use client';

import { useOrganization, useOrganizationList, useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

interface OrganizationPickerProps {
  onOrganizationChange?: (orgId: string | null) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function OrganizationPicker({
  onOrganizationChange,
  className = '',
  style = {}
}: OrganizationPickerProps) {
  const { organization } = useOrganization();
  const { user } = useUser();
  const { userMemberships, isLoaded } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  useEffect(() => {
    if (isLoaded && organization?.id && selectedOrgId !== organization.id) {
      console.log('Setting initial org:', organization.id, organization.name);
      setSelectedOrgId(organization.id);
      onOrganizationChange?.(organization.id);
    }
  }, [organization?.id, isLoaded]);

  const handleChange = async (orgId: string) => {
    console.log('Changing to org:', orgId);
    const membership = userMemberships?.data?.find(m => m.organization.id === orgId);
    if (membership) {
      await membership.organization.setActive();
      setSelectedOrgId(orgId);
      onOrganizationChange?.(orgId);
    }
  };

  if (!isLoaded) {
    return (
      <select
        disabled
        className={`${className} bg-background text-foreground border border-input rounded-md px-3 py-2`}
        style={style}
      >
        <option>Loading organizations...</option>
      </select>
    );
  }

  const orgs = userMemberships?.data || [];

  console.log('OrganizationPicker render:', {
    isLoaded,
    selectedOrgId,
    currentOrg: organization?.id,
    orgCount: orgs.length,
    orgs: orgs.map(m => ({ id: m.organization.id, name: m.organization.name }))
  });

  return (
    <select
      value={selectedOrgId}
      onChange={(e) => handleChange(e.target.value)}
      className={`${className} bg-background text-foreground border border-input rounded-md px-3 py-2 [&>option]:bg-background [&>option]:text-foreground dark:[&>option]:bg-gray-900 dark:[&>option]:text-white`}
      style={style}
    >
      <option value="">Select Organization</option>
      {orgs.map(({ organization: org }) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
