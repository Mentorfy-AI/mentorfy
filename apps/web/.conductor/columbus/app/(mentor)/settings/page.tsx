'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsageStats } from '@/components/settings/usage-stats';
import { OrganizationSettings } from '@/components/settings/organization-settings';
import { BillingSettings } from '@/components/settings/billing-settings';

export default function SettingsPage() {
  return (
    <div className="container max-w-6xl py-10 px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings and preferences
        </p>
      </div>

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <UsageStats />
        </TabsContent>

        <TabsContent value="organization" className="space-y-4">
          <OrganizationSettings />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <BillingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
