'use client';

import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Zap, DollarSign } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function UsageStats() {
  const { data, error, isLoading } = useSWR('/api/usage/current', fetcher, {
    refreshInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load usage data</AlertDescription>
      </Alert>
    );
  }

  const { tokens, cost, limit = 100000 } = data;
  const percentUsed = (tokens / limit) * 100;
  const isNearLimit = percentUsed > 80;
  const isAtLimit = percentUsed >= 100;

  return (
    <div className="space-y-4">
      {/* Alert when approaching limit */}
      {isNearLimit && (
        <Alert variant={isAtLimit ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {isAtLimit ? 'Daily Limit Reached' : 'Approaching Daily Limit'}
          </AlertTitle>
          <AlertDescription>
            {isAtLimit
              ? 'You have reached your daily token limit. Please contact support or try again tomorrow.'
              : `You have used ${percentUsed.toFixed(0)}% of your daily token limit.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Today's Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Usage</CardTitle>
          <CardDescription>
            Token consumption for {new Date().toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Tokens Used */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Tokens Used</span>
                </div>
                <span className="text-2xl font-bold">
                  {tokens?.toLocaleString() || 0}
                </span>
              </div>
              <Progress value={percentUsed} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {limit.toLocaleString()} daily limit
              </p>
            </div>

            {/* Cost */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Cost</span>
                </div>
                <span className="text-2xl font-bold">
                  ${cost?.toFixed(2) || '0.00'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Based on current model pricing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage by Model (Future) */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Model</CardTitle>
          <CardDescription>Coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Detailed breakdown by model, bot, and user will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
