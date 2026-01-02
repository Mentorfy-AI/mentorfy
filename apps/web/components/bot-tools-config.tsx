'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Wrench,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  Calendar,
  Search,
  ChevronDown,
} from 'lucide-react';

interface Tool {
  name: string;
  display_name: string;
  description: string;
  category: string;
  requires_integration: string | null;
  available: boolean;
  unavailable_reason: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
}

interface CalendlyEventType {
  uri: string;
  name: string;
  duration_minutes: number;
}

interface BotToolsConfigProps {
  botId: string;
  onToolsChange?: (enabledTools: Record<string, Record<string, unknown>>) => void;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  built_in: Search,
  scheduling: Calendar,
};

const CATEGORY_LABELS: Record<string, string> = {
  built_in: 'Built-in',
  scheduling: 'Scheduling',
};

export function BotToolsConfig({ botId, onToolsChange }: BotToolsConfigProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calendly-specific state
  const [eventTypes, setEventTypes] = useState<CalendlyEventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(false);
  const [connectingCalendly, setConnectingCalendly] = useState(false);

  // Fetch tools
  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bots/${botId}/tools`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch tools');
      }

      setTools(data.tools);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tools');
    } finally {
      setLoading(false);
    }
  }, [botId]);

  // Fetch Calendly event types when Calendly is available
  const fetchCalendlyEventTypes = useCallback(async () => {
    try {
      setLoadingEventTypes(true);
      const res = await fetch('/api/integrations/calendly/event-types');
      const data = await res.json();

      if (data.success) {
        setEventTypes(data.eventTypes || []);
      }
    } catch {
      // Silently fail - event types just won't be shown
    } finally {
      setLoadingEventTypes(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  // Fetch event types if Calendly is available
  useEffect(() => {
    const calendlyTool = tools.find(
      (t) => t.requires_integration === 'calendly' && t.available
    );
    if (calendlyTool) {
      fetchCalendlyEventTypes();
    }
  }, [tools, fetchCalendlyEventTypes]);

  // Listen for OAuth callback message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'calendly-oauth-complete' && event.data?.success) {
        // Refresh tools to get updated availability
        fetchTools();
        fetchCalendlyEventTypes();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchTools, fetchCalendlyEventTypes]);

  // Save tools
  const saveTools = async (enabledTools: Record<string, Record<string, unknown>>) => {
    try {
      setSaving(true);
      const res = await fetch(`/api/bots/${botId}/tools`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled_tools: enabledTools }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save tools');
      }

      onToolsChange?.(enabledTools);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tools');
    } finally {
      setSaving(false);
    }
  };

  // Toggle tool enabled state
  const toggleTool = (toolName: string, currentlyEnabled: boolean, config: Record<string, unknown> = {}) => {
    const enabledTools: Record<string, Record<string, unknown>> = {};

    tools.forEach((tool) => {
      if (tool.name === toolName) {
        if (!currentlyEnabled) {
          enabledTools[toolName] = config;
        }
        // If disabling, just don't include it
      } else if (tool.enabled) {
        enabledTools[tool.name] = tool.config;
      }
    });

    // Optimistically update UI
    setTools((prev) =>
      prev.map((t) =>
        t.name === toolName ? { ...t, enabled: !currentlyEnabled, config } : t
      )
    );

    saveTools(enabledTools);
  };

  // Update tool config (e.g., Calendly event type)
  const updateToolConfig = (toolName: string, config: Record<string, unknown>) => {
    const enabledTools: Record<string, Record<string, unknown>> = {};

    tools.forEach((tool) => {
      if (tool.enabled || tool.name === toolName) {
        enabledTools[tool.name] = tool.name === toolName ? config : tool.config;
      }
    });

    // Optimistically update UI
    setTools((prev) =>
      prev.map((t) => (t.name === toolName ? { ...t, config } : t))
    );

    saveTools(enabledTools);
  };

  // Connect Calendly
  const connectCalendly = async () => {
    try {
      setConnectingCalendly(true);
      const res = await fetch('/api/integrations/calendly/auth-url');
      const data = await res.json();

      if (!data.success || !data.url) {
        throw new Error(data.error || 'Failed to get auth URL');
      }

      // Open OAuth flow in popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      window.open(
        data.url,
        'calendly-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Calendly');
    } finally {
      setConnectingCalendly(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  // Group tools by category
  const toolsByCategory = tools.reduce(
    (acc, tool) => {
      const category = tool.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(tool);
      return acc;
    },
    {} as Record<string, Tool[]>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded bg-red-900/20 border border-red-800 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {Object.entries(toolsByCategory).map(([category, categoryTools]) => {
        const IconComponent = CATEGORY_ICONS[category] || Wrench;
        const label = CATEGORY_LABELS[category] || category;

        return (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider">
              <IconComponent className="w-3 h-3" />
              {label}
            </div>

            {categoryTools.map((tool) => (
              <div
                key={tool.name}
                className={`p-3 rounded border transition-colors ${
                  tool.enabled
                    ? 'border-emerald-600/50 bg-emerald-900/10'
                    : 'border-gray-700 bg-gray-800/50'
                } ${!tool.available ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">
                        {tool.display_name}
                      </span>
                      {tool.enabled && (
                        <Check className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{tool.description}</p>

                    {/* Show unavailable reason */}
                    {!tool.available && tool.unavailable_reason && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-amber-400">
                          {tool.unavailable_reason}
                        </span>
                        {tool.requires_integration === 'calendly' && (
                          <button
                            onClick={connectCalendly}
                            disabled={connectingCalendly}
                            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                          >
                            {connectingCalendly ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ExternalLink className="w-3 h-3" />
                            )}
                            Connect Calendly
                          </button>
                        )}
                      </div>
                    )}

                    {/* Calendly event type selector - shown for both Calendly tools */}
                    {tool.available &&
                      tool.enabled &&
                      tool.requires_integration === 'calendly' && (
                        <div className="mt-3">
                          <label className="text-xs text-gray-400 block mb-1">
                            Event Type
                          </label>
                          {loadingEventTypes ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <div className="relative">
                              <select
                                value={(tool.config.event_type_uri as string) || ''}
                                onChange={(e) =>
                                  updateToolConfig(tool.name, {
                                    ...tool.config,
                                    event_type_uri: e.target.value,
                                  })
                                }
                                className="w-full p-2 pr-8 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-600"
                              >
                                <option value="">Select event type...</option>
                                {eventTypes.map((et) => (
                                  <option key={et.uri} value={et.uri}>
                                    {et.name} ({et.duration_minutes} min)
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Toggle button */}
                  {tool.available && (
                    <button
                      onClick={() => toggleTool(tool.name, tool.enabled, tool.config)}
                      disabled={saving}
                      className={`px-3 py-1.5 text-xs rounded transition-colors ${
                        tool.enabled
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      {saving ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : tool.enabled ? (
                        'Disable'
                      ) : (
                        'Enable'
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
