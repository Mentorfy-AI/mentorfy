'use client';

import { useState, useEffect } from 'react';

interface Organization {
  id: string;
  name: string;
}

interface SuperAdminOrganizationPickerProps {
  onOrganizationChange?: (orgId: string | null) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function SuperAdminOrganizationPicker({
  onOrganizationChange,
  className = '',
  style = {}
}: SuperAdminOrganizationPickerProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/organizations');

      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }

      const data = await response.json();
      console.log('Fetched organizations:', data);
      setOrganizations(data);

      // Auto-select first org if available
      if (data.length > 0 && !selectedOrgId) {
        const firstOrgId = data[0].id;
        setSelectedOrgId(firstOrgId);
        onOrganizationChange?.(firstOrgId);
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (orgId: string) => {
    console.log('Changing to org:', orgId);
    setSelectedOrgId(orgId);
    onOrganizationChange?.(orgId || null);
  };

  if (loading) {
    return (
      <select
        disabled
        className={`${className} bg-background text-foreground`}
        style={style}
      >
        <option className="bg-background text-foreground">Loading organizations...</option>
      </select>
    );
  }

  if (error) {
    return (
      <select
        disabled
        className={`${className} bg-background text-foreground`}
        style={style}
      >
        <option className="bg-background text-foreground">Error: {error}</option>
      </select>
    );
  }

  return (
    <select
      value={selectedOrgId}
      onChange={(e) => handleChange(e.target.value)}
      className={`${className} bg-background text-foreground`}
      style={style}
    >
      <option value="" className="bg-background text-foreground">Select Organization</option>
      {organizations.map((org) => (
        <option key={org.id} value={org.id} className="bg-background text-foreground">
          {org.name}
        </option>
      ))}
    </select>
  );
}
