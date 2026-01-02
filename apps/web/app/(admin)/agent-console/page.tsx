'use client';

import { useEffect, useState } from 'react';
import {
  Play,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Brain,
  Wrench,
  MessageSquare,
  Trash2,
  Settings,
  Save,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { SuperAdminOrganizationPicker } from '@/components/super-admin-organization-picker';
import { ConfigureAgentsModal } from '@/components/configure-agents-modal';

// TypeScript interfaces
interface Bot {
  id: string;
  name: string;
  display_name?: string;
  purpose?: string;
  model_name?: string;
  model_provider?: string;
  system_prompt?: string;
}

interface Message {
  isUser: boolean;
  content: string;
}

interface ToolCall {
  tool: string;
  query: string;
  results: string;
  tokens_used: number;
}

interface TimelineEvent {
  type: 'thinking' | 'tool_call' | 'final_answer';
  iteration?: number;
  order: number;
  content?: string; // for thinking/final_answer
  tool?: string; // for tool_call
  query?: string;
  results?: string;
  tokens_used: number;
}

interface DebugInfo {
  model_used: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  tools_available: string[];
  tool_calls: ToolCall[];
  thinking?: string[]; // Thinking blocks from Claude
  timeline?: TimelineEvent[]; // Chronological timeline
  total_tokens: {
    input: number;
    output: number;
  };
  response_time_ms: number;
}

interface DebugResponse {
  response: string;
  conversation_id?: string;
  debug_info?: DebugInfo;
}

interface ConversationResponse {
  userMessage: string;
  debugResponse: DebugResponse;
  timestamp: number;
  expanded: boolean;
}

interface ToolParameter {
  type: string;
  description?: string;
  default?: any;
}

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: {
      [key: string]: ToolParameter;
    };
    required?: string[];
  };
}

// Available models
const AVAILABLE_MODELS = [
  // OpenAI models
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (OpenAI)' },
  // Claude models
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Anthropic)' },
  { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet (Anthropic)' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Anthropic)' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Anthropic)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Anthropic)' },
  {
    value: 'claude-3-5-sonnet-20240620',
    label: 'Claude 3.5 Sonnet (Anthropic)',
  },
  {
    value: 'claude-3-7-sonnet-20250219',
    label: 'Claude 3.7 Sonnet (Anthropic)',
  },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Anthropic)' },
  {
    value: 'claude-sonnet-4-5-20250929',
    label: 'Claude Sonnet 4.5 (Anthropic)',
  },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4 (Anthropic)' },
  { value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1 (Anthropic)' },
];

// API functions
async function fetchBots(orgId?: string | null): Promise<Bot[]> {
  const url = orgId
    ? `/api/agent-console/bots?orgId=${encodeURIComponent(orgId)}`
    : '/api/agent-console/bots';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch bots');
  return response.json();
}

async function fetchTools(): Promise<ToolDefinition[]> {
  const response = await fetch('/api/tools');
  if (!response.ok) throw new Error('Failed to fetch tools');
  return response.json();
}

// Streaming event handler
type StreamEventHandler = {
  onMetadata?: (data: any) => void;
  onThinkingStart?: (data: any) => void;
  onThinkingDelta?: (data: any) => void;
  onToolStart?: (data: any) => void;
  onToolExecuting?: (data: any) => void;
  onToolResult?: (data: any) => void;
  onTextDelta?: (data: any) => void;
  onFinalAnswer?: (data: any) => void;
  onComplete?: (data: any) => void;
  onError?: (error: string) => void;
};

async function sendDebugMessageStream(
  params: {
    bot_id: string;
    message: string;
    previous_messages?: Message[];
    override_system_prompt?: string;
    override_model?: string;
  },
  handlers: StreamEventHandler
) {
  const response = await fetch('/api/agent-console/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, stream: true }),
  });

  if (!response.ok) throw new Error('Failed to send message');
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    let buffer = '';
    let currentEventType: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Add new data to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines from buffer
      const lines = buffer.split('\n');
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        // Skip empty lines and comments
        if (!line.trim() || line.startsWith(':')) {
          // Empty line marks end of event - reset state
          if (!line.trim() && currentEventType) {
            currentEventType = null;
          }
          continue;
        }

        // Parse event type
        if (line.startsWith('event:')) {
          currentEventType = line.substring(6).trim();
          continue;
        }

        // Parse data with the current event type
        if (line.startsWith('data:')) {
          const dataStr = line.substring(5).trim();
          try {
            const data = JSON.parse(dataStr);

            // Use the current event type (not a regex search!)
            const eventType = currentEventType || 'unknown';

            switch (eventType) {
              case 'metadata':
                handlers.onMetadata?.(data);
                break;
              case 'thinking_start':
                handlers.onThinkingStart?.(data);
                break;
              case 'thinking_delta':
                handlers.onThinkingDelta?.(data);
                break;
              case 'tool_start':
                handlers.onToolStart?.(data);
                break;
              case 'tool_executing':
                handlers.onToolExecuting?.(data);
                break;
              case 'tool_result':
                handlers.onToolResult?.(data);
                break;
              case 'text_delta':
                handlers.onTextDelta?.(data);
                break;
              case 'final_answer':
                handlers.onFinalAnswer?.(data);
                break;
              case 'complete':
                handlers.onComplete?.(data);
                break;
              case 'error':
                handlers.onError?.(data.error);
                break;
              default:
                console.warn(`Unknown SSE event type: ${eventType}`);
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e, 'Line:', line);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export default function AgentConsolePage() {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [userMessage, setUserMessage] = useState<string>('');
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [debugResponse, setDebugResponse] = useState<DebugResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptModified, setPromptModified] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedTimeline, setExpandedTimeline] = useState<Set<number>>(
    new Set()
  );
  const [streamingStatus, setStreamingStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [availableTools, setAvailableTools] = useState<ToolDefinition[]>([]);
  const [toolParamOverrides, setToolParamOverrides] = useState<
    Record<string, any>
  >({});
  const [conversationResponses, setConversationResponses] = useState<
    ConversationResponse[]
  >([]);
  const [configureModalOpen, setConfigureModalOpen] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [modelSaveSuccess, setModelSaveSuccess] = useState(false);

  // Load bots when organization changes
  useEffect(() => {
    if (selectedOrgId) {
      // Reset UI state first
      setDebugResponse(null);
      setConversationHistory([]);
      setConversationResponses([]);
      setUserMessage('');
      setSystemPrompt('');
      setSelectedModel('');
      setToolParamOverrides({});
      setStreamingStatus('');
      setError(null);

      // Then load bots for new org
      loadBots(selectedOrgId);
    } else {
      setBots([]);
      setSelectedBot('');
      setDebugResponse(null);
      setConversationHistory([]);
      setConversationResponses([]);
    }
  }, [selectedOrgId]);

  // Load tools on mount
  useEffect(() => {
    loadTools();
  }, []);

  // Keyboard shortcut for Run (Cmd/Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBot, userMessage, systemPrompt, conversationHistory]);

  const loadBots = async (orgId: string) => {
    try {
      const botsData = await fetchBots(orgId);
      const sortedBots = botsData.sort((a, b) => {
        if (a.name?.toLowerCase().includes('elise pham')) return -1;
        if (b.name?.toLowerCase().includes('elise pham')) return 1;
        return 0;
      });
      setBots(sortedBots);
      if (sortedBots.length > 0) {
        setSelectedBot(sortedBots[0].id);
        // Load the system prompt and model for the first bot
        const firstBot = sortedBots[0];
        if (firstBot.system_prompt) {
          setSystemPrompt(firstBot.system_prompt);
        }
        // Set the default model from the bot
        if (firstBot.model_name) {
          setSelectedModel(firstBot.model_name);
        }
      }
    } catch (err) {
      setError('Failed to load bots');
      console.error(err);
    }
  };

  const loadTools = async () => {
    try {
      const toolsData = await fetchTools();
      setAvailableTools(toolsData);
    } catch (err) {
      console.error('Failed to load tools:', err);
      // Don't set error since tools are optional
    }
  };

  const handleRun = async () => {
    if (!selectedBot || !userMessage.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    // Clear previous response
    setDebugResponse(null);

    // Initialize streaming state
    const streamingTimeline: TimelineEvent[] = [];
    let streamingThinking: { [key: number]: string } = {};
    let streamingToolData: { [key: string]: any } = {};
    let streamingText = '';
    let streamingMetadata: any = null;
    let currentOrder = 0;
    let currentThinkingIteration: number | null = null; // Track current thinking iteration
    let currentToolId: string | null = null; // Track current tool being executed

    try {
      const params: any = {
        bot_id: selectedBot,
        message: userMessage,
        previous_messages: conversationHistory,
      };

      // Build system prompt with tool parameter instructions
      let effectiveSystemPrompt = systemPrompt;
      let hasToolOverrides = Object.keys(toolParamOverrides).length > 0;

      // If tool parameters are overridden, inject them into the system prompt
      if (hasToolOverrides) {
        const toolInstructions = Object.entries(toolParamOverrides)
          .map(([toolName, params]) => {
            const paramStr = Object.entries(params)
              .map(([key, value]) => `${key}=${value}`)
              .join(', ');
            return `- ${toolName}: ${paramStr}`;
          })
          .join('\n');

        effectiveSystemPrompt =
          effectiveSystemPrompt +
          '\n\n=== IMPORTANT TOOL PARAMETER OVERRIDES ===\nFor this request and all subsequent requests in this conversation, use these exact parameter values when calling tools:\n' +
          toolInstructions +
          '\n\nThese values override any default parameters. Apply them consistently.';
      }

      // Always send override_system_prompt if we have tool overrides or modified prompt
      if (promptModified || hasToolOverrides) {
        params.override_system_prompt = effectiveSystemPrompt;
      }

      // Always send the selected model
      if (selectedModel) {
        params.override_model = selectedModel;
      }

      // Use streaming API
      await sendDebugMessageStream(params, {
        onMetadata: (data) => {
          streamingMetadata = data;
          setStreamingStatus('Connecting to model...');
        },
        onThinkingStart: (data) => {
          setStreamingStatus(`Thinking (Round ${data.iteration})...`);
          // Set current thinking iteration and create empty timeline entry
          currentThinkingIteration = data.iteration;
          const timelineIndex = streamingTimeline.length;
          streamingTimeline.push({
            type: 'thinking',
            iteration: data.iteration,
            order: data.order,
            content: '',
            tokens_used: 0,
          });
          // Auto-expand this timeline entry
          setExpandedTimeline((prev) => {
            const newSet = new Set(prev);
            newSet.add(timelineIndex);
            return newSet;
          });
          // Update UI to show the thinking block appeared
          setDebugResponse({
            response: streamingText,
            debug_info: {
              model_used: streamingMetadata?.model || '',
              system_prompt: streamingMetadata?.system_prompt || '',
              temperature: streamingMetadata?.temperature || 0,
              max_tokens: streamingMetadata?.max_tokens || 0,
              tools_available: streamingMetadata?.tools || [],
              tool_calls: [],
              timeline: [...streamingTimeline],
              total_tokens: { input: 0, output: 0 },
              response_time_ms: 0,
            },
          });
        },
        onThinkingDelta: (data) => {
          // Find thinking block by current iteration (not by empty content!)
          let thinkingIndex = -1;
          if (currentThinkingIteration !== null) {
            for (let i = streamingTimeline.length - 1; i >= 0; i--) {
              if (
                streamingTimeline[i].type === 'thinking' &&
                streamingTimeline[i].iteration === currentThinkingIteration
              ) {
                thinkingIndex = i;
                break;
              }
            }
          }

          if (thinkingIndex !== -1) {
            // Append to existing entry
            streamingTimeline[thinkingIndex].content =
              (streamingTimeline[thinkingIndex].content || '') + data.delta;
            streamingTimeline[thinkingIndex].tokens_used = Math.ceil(
              (streamingTimeline[thinkingIndex].content?.length || 0) / 4
            );
          } else {
            // Fallback: create new entry if we can't find it (shouldn't happen)
            console.warn(
              'Could not find thinking block for iteration:',
              currentThinkingIteration
            );
            streamingTimeline.push({
              type: 'thinking',
              iteration: currentThinkingIteration || 0,
              order: streamingTimeline.length,
              content: data.delta,
              tokens_used: Math.ceil(data.delta.length / 4),
            });
          }

          // Update UI
          setDebugResponse({
            response: streamingText,
            debug_info: {
              model_used: streamingMetadata?.model || '',
              system_prompt: streamingMetadata?.system_prompt || '',
              temperature: streamingMetadata?.temperature || 0,
              max_tokens: streamingMetadata?.max_tokens || 0,
              tools_available: streamingMetadata?.tools || [],
              tool_calls: [],
              timeline: [...streamingTimeline],
              total_tokens: { input: 0, output: 0 },
              response_time_ms: 0,
            },
          });
        },
        onToolStart: (data) => {
          setStreamingStatus(`Starting tool: ${data.tool}...`);
          // Set current tool ID and create empty timeline entry
          currentToolId = data.tool_id;
          streamingToolData[data.tool_id] = {
            tool: data.tool,
            order: data.order,
            iteration: data.iteration,
          };
          const timelineIndex = streamingTimeline.length;
          streamingTimeline.push({
            type: 'tool_call',
            iteration: data.iteration,
            order: data.order,
            tool: data.tool,
            query: '',
            results: '',
            tokens_used: 0,
          });
          // Auto-expand this timeline entry
          setExpandedTimeline((prev) => {
            const newSet = new Set(prev);
            newSet.add(timelineIndex);
            return newSet;
          });
          // Update UI to show tool appeared
          setDebugResponse({
            response: streamingText,
            debug_info: {
              model_used: streamingMetadata?.model || '',
              system_prompt: streamingMetadata?.system_prompt || '',
              temperature: streamingMetadata?.temperature || 0,
              max_tokens: streamingMetadata?.max_tokens || 0,
              tools_available: streamingMetadata?.tools || [],
              tool_calls: [],
              timeline: [...streamingTimeline],
              total_tokens: { input: 0, output: 0 },
              response_time_ms: 0,
            },
          });
        },
        onToolExecuting: (data) => {
          setStreamingStatus(`Executing: ${data.tool}...`);
          // Find tool entry by tool name (for current tool)
          let toolIndex = -1;
          for (let i = streamingTimeline.length - 1; i >= 0; i--) {
            if (
              streamingTimeline[i].type === 'tool_call' &&
              streamingTimeline[i].tool === data.tool &&
              !streamingTimeline[i].results
            ) {
              toolIndex = i;
              break;
            }
          }

          if (toolIndex !== -1) {
            // Update with query
            streamingTimeline[toolIndex].query = data.query;
          } else {
            // Fallback: shouldn't happen if tool_start fired
            console.warn('Could not find tool entry for:', data.tool);
          }

          setDebugResponse({
            response: streamingText,
            debug_info: {
              model_used: streamingMetadata?.model || '',
              system_prompt: streamingMetadata?.system_prompt || '',
              temperature: streamingMetadata?.temperature || 0,
              max_tokens: streamingMetadata?.max_tokens || 0,
              tools_available: streamingMetadata?.tools || [],
              tool_calls: [],
              timeline: [...streamingTimeline],
              total_tokens: { input: 0, output: 0 },
              response_time_ms: 0,
            },
          });
        },
        onToolResult: (data) => {
          // Find the tool entry by tool name and update with results
          let toolIndex = -1;
          for (let i = streamingTimeline.length - 1; i >= 0; i--) {
            if (
              streamingTimeline[i].type === 'tool_call' &&
              streamingTimeline[i].tool === data.tool &&
              !streamingTimeline[i].results
            ) {
              toolIndex = i;
              break;
            }
          }

          if (toolIndex !== -1) {
            // Update existing entry with results
            streamingTimeline[toolIndex].results = data.result;
            streamingTimeline[toolIndex].tokens_used = data.tokens_used;
          } else {
            // Fallback: create complete tool entry if it doesn't exist (shouldn't happen)
            console.warn('Could not find tool entry for result:', data.tool);
            streamingTimeline.push({
              type: 'tool_call',
              iteration: 0,
              order: data.order || streamingTimeline.length,
              tool: data.tool,
              query: data.query || '',
              results: data.result,
              tokens_used: data.tokens_used,
            });
          }

          setDebugResponse({
            response: streamingText,
            debug_info: {
              model_used: streamingMetadata?.model || '',
              system_prompt: streamingMetadata?.system_prompt || '',
              temperature: streamingMetadata?.temperature || 0,
              max_tokens: streamingMetadata?.max_tokens || 0,
              tools_available: streamingMetadata?.tools || [],
              tool_calls: [],
              timeline: [...streamingTimeline],
              total_tokens: { input: 0, output: 0 },
              response_time_ms: 0,
            },
          });
        },
        onTextDelta: (data) => {
          setStreamingStatus('Generating response...');
          streamingText += data.delta;
          setDebugResponse({
            response: streamingText,
            debug_info: {
              model_used: streamingMetadata?.model || '',
              system_prompt: streamingMetadata?.system_prompt || '',
              temperature: streamingMetadata?.temperature || 0,
              max_tokens: streamingMetadata?.max_tokens || 0,
              tools_available: streamingMetadata?.tools || [],
              tool_calls: [],
              timeline: [...streamingTimeline],
              total_tokens: { input: 0, output: 0 },
              response_time_ms: 0,
            },
          });
        },
        onFinalAnswer: (data) => {
          streamingText = data.content;
          streamingTimeline.push({
            type: 'final_answer',
            order: data.order,
            content: data.content,
            tokens_used: Math.ceil(data.content.length / 4),
          });
          setDebugResponse({
            response: streamingText,
            debug_info: {
              model_used: streamingMetadata?.model || '',
              system_prompt: streamingMetadata?.system_prompt || '',
              temperature: streamingMetadata?.temperature || 0,
              max_tokens: streamingMetadata?.max_tokens || 0,
              tools_available: streamingMetadata?.tools || [],
              tool_calls: [],
              timeline: [...streamingTimeline],
              total_tokens: { input: 0, output: 0 },
              response_time_ms: 0,
            },
          });
        },
        onComplete: (data) => {
          setStreamingStatus('Complete');
          // Final update with complete data
          const finalDebugResponse = {
            response: streamingText,
            debug_info: {
              model_used: streamingMetadata?.model || '',
              system_prompt: streamingMetadata?.system_prompt || '',
              temperature: streamingMetadata?.temperature || 0,
              max_tokens: streamingMetadata?.max_tokens || 0,
              tools_available: streamingMetadata?.tools || [],
              tool_calls: [],
              timeline: streamingTimeline,
              total_tokens: data.total_tokens,
              response_time_ms: data.response_time_ms,
            },
          };

          setDebugResponse(finalDebugResponse);

          // Add to conversation history
          setConversationHistory([
            ...conversationHistory,
            { isUser: true, content: userMessage },
            { isUser: false, content: streamingText },
          ]);

          // Add to conversation responses (newest first, expanded)
          setConversationResponses((prev) => [
            {
              userMessage: userMessage,
              debugResponse: finalDebugResponse,
              timestamp: Date.now(),
              expanded: true,
            },
            ...prev.map((r) => ({ ...r, expanded: false })), // Collapse previous
          ]);

          setLoading(false);
        },
        onError: (error) => {
          setError(error);
          setLoading(false);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (debugResponse?.response) {
      navigator.clipboard.writeText(debugResponse.response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddToConversation = () => {
    // Clear the user input after adding to conversation
    setUserMessage('');
  };

  const handleClearConversation = () => {
    const confirmed = window.confirm(
      'Clear conversation history? This will reset the debug session.'
    );
    if (confirmed) {
      setConversationHistory([]);
      setConversationResponses([]);
      setDebugResponse(null);
      setUserMessage('');
    }
  };

  const toggleTimelineEvent = (index: number) => {
    const newExpanded = new Set(expandedTimeline);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTimeline(newExpanded);
  };

  const toggleResponseCard = (responseIndex: number) => {
    setConversationResponses((prev) =>
      prev.map((r, i) =>
        i === responseIndex ? { ...r, expanded: !r.expanded } : r
      )
    );
  };

  const handleBotChange = (botId: string) => {
    setSelectedBot(botId);
    // Load the system prompt and model for the selected bot
    const selectedBotData = bots.find((bot) => bot.id === botId);
    if (selectedBotData?.system_prompt && !promptModified) {
      setSystemPrompt(selectedBotData.system_prompt);
    }
    if (selectedBotData?.model_name) {
      setSelectedModel(selectedBotData.model_name);
    }
  };

  const handleSaveSystemPrompt = async () => {
    if (!selectedBot || !systemPrompt.trim()) {
      return;
    }

    const selectedBotData = bots.find((bot) => bot.id === selectedBot);
    const botName = selectedBotData?.name || 'this bot';

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Update system prompt for ${botName}? This will affect all future conversations.`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(
        `/api/agent-console/bots/${selectedBot}/system-prompt`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ system_prompt: systemPrompt }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update system prompt');
      }

      // Success - reload bots to get fresh data
      if (selectedOrgId) {
        await loadBots(selectedOrgId);
      }

      // Reset modified flag
      setPromptModified(false);
      setSaveError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save system prompt';
      setSaveError(errorMessage);
      console.error('Error saving system prompt:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetSystemPrompt = () => {
    if (!selectedBot) {
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      'Reset system prompt to the saved version? All unsaved changes will be lost.'
    );

    if (!confirmed) {
      return;
    }

    // Find the current bot and restore its system prompt
    const selectedBotData = bots.find((bot) => bot.id === selectedBot);
    if (selectedBotData?.system_prompt) {
      setSystemPrompt(selectedBotData.system_prompt);
    }

    // Clear modified flag and any errors
    setPromptModified(false);
    setSaveError(null);
  };

  const handleSaveModel = async () => {
    if (!selectedBot || !selectedModel) {
      return;
    }

    setSavingModel(true);
    setModelSaveSuccess(false);

    try {
      const response = await fetch(`/api/agents/${selectedBot}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model_name: selectedModel }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update model');
      }

      // Success - reload bots to get fresh data
      if (selectedOrgId) {
        await loadBots(selectedOrgId);
      }

      // Show success feedback
      setModelSaveSuccess(true);
      setTimeout(() => setModelSaveSuccess(false), 2000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save model';
      setError(errorMessage);
      console.error('Error saving model:', err);
    } finally {
      setSavingModel(false);
    }
  };

  const calculateTokens = (text: string): number => {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  };

  const renderTimeline = (
    timeline: TimelineEvent[] | undefined,
    responseIndex?: number
  ) => {
    if (!timeline || timeline.length === 0) return null;

    return timeline
      .sort((a, b) => a.order - b.order)
      .filter((event) => {
        // Only show events with meaningful content
        if (event.type === 'thinking') {
          return event.content && event.content.trim().length > 0;
        }
        if (event.type === 'tool_call') {
          return event.tool && event.results;
        }
        if (event.type === 'final_answer') {
          return event.content && event.content.trim().length > 0;
        }
        return true;
      })
      .map((event, index) => {
        // Use a unique key that includes responseIndex if available
        const eventKey =
          responseIndex !== undefined
            ? `${responseIndex}-${index}`
            : `current-${index}`;

        if (event.type === 'thinking') {
          return (
            <div
              key={eventKey}
              className="border rounded"
              style={{ borderColor: '#7c3aed', backgroundColor: '#1a1d23' }}
            >
              <button
                onClick={() => toggleTimelineEvent(index)}
                className="w-full p-3 flex items-center justify-between hover:bg-opacity-80 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  {expandedTimeline.has(index) ? (
                    <ChevronDown className="w-4 h-4 text-purple-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                  )}
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-mono text-purple-400">
                    Thinking
                    {event.iteration !== undefined
                      ? ` (Round ${event.iteration})`
                      : ''}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {event.tokens_used || 0} tokens
                </span>
              </button>
              {expandedTimeline.has(index) && (
                <div
                  className="p-3 border-t"
                  style={{ borderColor: '#7c3aed' }}
                >
                  <div className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
                    {event.content}
                  </div>
                </div>
              )}
            </div>
          );
        } else if (event.type === 'tool_call') {
          return (
            <div
              key={eventKey}
              className="border rounded"
              style={{ borderColor: '#10b981', backgroundColor: '#1a1d23' }}
            >
              <button
                onClick={() => toggleTimelineEvent(index)}
                className="w-full p-3 flex items-center justify-between hover:bg-opacity-80 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  {expandedTimeline.has(index) ? (
                    <ChevronDown className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-emerald-400" />
                  )}
                  <Wrench className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-mono text-emerald-400">
                    {event.tool || '(unnamed tool)'}
                  </span>
                  {event.iteration !== undefined && (
                    <span className="text-xs text-gray-500">
                      Round {event.iteration}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {event.tokens_used || 0} tokens
                </span>
              </button>
              {expandedTimeline.has(index) && (
                <div
                  className="p-3 border-t space-y-2"
                  style={{ borderColor: '#10b981' }}
                >
                  {event.query && (
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">
                        Query:
                      </div>
                      <div className="text-sm font-mono text-gray-300">
                        {event.query}
                      </div>
                    </div>
                  )}
                  {event.results && (
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">
                        Results:
                      </div>
                      <div className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
                        {event.results}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        } else if (event.type === 'final_answer') {
          return (
            <div
              key={eventKey}
              className="border rounded"
              style={{ borderColor: '#3b82f6', backgroundColor: '#1a1d23' }}
            >
              <div
                className="p-3 flex items-center space-x-2 border-b"
                style={{ borderColor: '#3b82f6' }}
              >
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-mono text-blue-400">
                  Final Answer
                </span>
                <span className="text-xs text-gray-500 ml-auto">
                  {event.tokens_used || 0} tokens
                </span>
              </div>
              <div className="p-3">
                <div className="text-sm text-gray-300 whitespace-pre-wrap">
                  {event.content}
                </div>
              </div>
            </div>
          );
        }
        return null;
      });
  };

  const userTokens = calculateTokens(userMessage);
  const responseTokens = debugResponse?.debug_info?.total_tokens.output || 0;

  return (
    <div
      className="h-screen flex flex-col"
      style={{ backgroundColor: '#111318', color: '#e0e0e0' }}
    >
      {/* Top Bar - User Controls */}
      <div
        className="border-b px-4 py-2 flex items-center justify-between"
        style={{ borderColor: '#2a2d35', backgroundColor: '#0a0b0e' }}
      >
        <span className="text-xs font-semibold text-emerald-400">
          AGENT CONSOLE
        </span>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>

      {/* Header */}
      <header
        className="border-b px-6 py-3 flex items-center justify-between"
        style={{ borderColor: '#2a2d35' }}
      >
        <div className="flex items-center space-x-4">
          <SuperAdminOrganizationPicker
            onOrganizationChange={setSelectedOrgId}
            className="px-3 py-1.5 rounded border text-sm"
            style={{
              backgroundColor: '#1a1d23',
              borderColor: '#2a2d35',
              color: '#e0e0e0',
            }}
          />

          <select
            value={selectedBot}
            onChange={(e) => handleBotChange(e.target.value)}
            disabled={!selectedOrgId || bots.length === 0}
            className="px-3 py-1.5 rounded border text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#1a1d23',
              borderColor: '#2a2d35',
              color: '#e0e0e0',
            }}
          >
            {bots.length === 0 ? (
              <option value="">
                {selectedOrgId
                  ? 'No bots in this organization'
                  : 'Select an organization first'}
              </option>
            ) : (
              bots.map((bot) => (
                <option
                  key={bot.id}
                  value={bot.id}
                >
                  {bot.display_name || bot.name || 'Unnamed Bot'}
                </option>
              ))
            )}
          </select>

          <div className="flex items-center space-x-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-3 py-1.5 rounded border text-sm"
              style={{
                backgroundColor: '#1a1d23',
                borderColor: '#2a2d35',
                color: '#e0e0e0',
              }}
            >
              {AVAILABLE_MODELS.map((model) => (
                <option
                  key={model.value}
                  value={model.value}
                >
                  {model.label}
                </option>
              ))}
            </select>

            {/* Show Save Model button when model differs from saved */}
            {selectedBot &&
              selectedModel &&
              bots.find((bot) => bot.id === selectedBot)?.model_name !==
                selectedModel && (
                <button
                  onClick={handleSaveModel}
                  disabled={savingModel}
                  className="flex items-center space-x-1 px-2 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: modelSaveSuccess ? '#10b981' : '#4ade80',
                    color: '#111318',
                  }}
                  title="Save model as default for this agent"
                >
                  {savingModel ? (
                    <>
                      <span>Saving...</span>
                    </>
                  ) : modelSaveSuccess ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      <span>Save Model</span>
                    </>
                  )}
                </button>
              )}
          </div>

          <button
            onClick={() => setConfigureModalOpen(true)}
            disabled={!selectedOrgId}
            className="flex items-center space-x-2 px-3 py-1.5 rounded border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#1a1d23',
              borderColor: '#2a2d35',
              color: '#e0e0e0',
            }}
            title="Configure Agents"
          >
            <Settings className="w-4 h-4" />
            <span>Configure Agents</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleClearConversation}
            disabled={conversationHistory.length === 0}
            className="flex items-center space-x-2 px-3 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#f97316', color: '#fff' }}
            title="Clear conversation history"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear</span>
          </button>
          <button
            onClick={handleRun}
            disabled={loading || !userMessage.trim()}
            className="flex items-center space-x-2 px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#4ade80', color: '#111318' }}
          >
            <Play className="w-4 h-4" />
            <span>Run</span>
            <span className="text-xs opacity-70">⌘ + ↵</span>
          </button>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div
          className="mx-6 mt-4 p-3 rounded border"
          style={{
            backgroundColor: '#991b1b',
            borderColor: '#dc2626',
            color: '#fca5a5',
          }}
        >
          {error}
        </div>
      )}

      {/* Three Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - System Prompt */}
        <div
          className="w-1/3 border-r flex flex-col"
          style={{ borderColor: '#2a2d35' }}
        >
          <div
            className="p-4 border-b"
            style={{ borderColor: '#2a2d35' }}
          >
            <span className="font-medium text-sm">System Prompt</span>
          </div>
          <div className="flex-1 p-4 flex flex-col overflow-hidden">
            <textarea
              value={systemPrompt}
              onChange={(e) => {
                setSystemPrompt(e.target.value);
                setPromptModified(true);
              }}
              placeholder="System prompt will appear here, or you can enter your own..."
              className="flex-1 w-full p-3 rounded border font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600 mb-2"
              style={{
                backgroundColor: '#1a1d23',
                borderColor: '#2a2d35',
                color: '#e0e0e0',
              }}
            />

            {/* Save Changes Bar */}
            {promptModified && (
              <div
                className="p-3 rounded flex items-center justify-between"
                style={{ backgroundColor: '#4ade80', color: '#111318' }}
              >
                <span className="text-sm font-medium">
                  You have unsaved changes
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleResetSystemPrompt}
                    disabled={saving}
                    className="px-4 py-1.5 rounded font-medium transition-colors disabled:opacity-50 hover:opacity-80"
                    style={{ backgroundColor: '#111318', color: '#4ade80' }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSaveSystemPrompt}
                    disabled={saving}
                    className="px-4 py-1.5 rounded font-medium transition-colors disabled:opacity-50 hover:opacity-80"
                    style={{ backgroundColor: '#111318', color: '#4ade80' }}
                  >
                    {saving ? 'Saving...' : 'Save System Prompt'}
                  </button>
                </div>
              </div>
            )}

            {/* Save Error Display */}
            {saveError && (
              <div
                className="mt-2 p-2 rounded border text-sm"
                style={{
                  backgroundColor: '#991b1b',
                  borderColor: '#dc2626',
                  color: '#fca5a5',
                }}
              >
                {saveError}
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel - Tools & User Input */}
        <div
          className="w-1/3 border-r flex flex-col"
          style={{ borderColor: '#2a2d35' }}
        >
          {/* Tools Section */}
          {availableTools.length > 0 && (
            <div
              className="border-b"
              style={{ borderColor: '#2a2d35' }}
            >
              <div
                className="p-4 border-b"
                style={{ borderColor: '#2a2d35' }}
              >
                <span className="font-medium text-sm">Tools</span>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto">
                {availableTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="mb-4 last:mb-0"
                  >
                    <div className="flex items-start space-x-2 mb-2">
                      <Wrench className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-emerald-400 font-mono mb-1">
                          {tool.name}
                        </div>
                        <div className="text-xs text-gray-400 mb-3">
                          {tool.description}
                        </div>

                        {/* Parameters */}
                        <div className="space-y-2">
                          {Object.entries(tool.input_schema.properties).map(
                            ([paramName, paramDef]) => {
                              const isRequired =
                                tool.input_schema.required?.includes(paramName);
                              const defaultValue = paramDef.default;

                              // Skip required query parameter (not configurable)
                              if (paramName === 'query' && isRequired) {
                                return null;
                              }

                              // Handle num_results parameter specifically
                              if (
                                paramName === 'num_results' &&
                                paramDef.type === 'integer'
                              ) {
                                const currentValue =
                                  toolParamOverrides[tool.name]?.num_results ??
                                  defaultValue ??
                                  7;

                                return (
                                  <div
                                    key={paramName}
                                    className="space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-gray-400">
                                        {paramName}
                                        {!isRequired && (
                                          <span className="text-gray-600 ml-1">
                                            (optional)
                                          </span>
                                        )}
                                      </label>
                                      <span className="text-xs text-emerald-400 font-mono">
                                        {currentValue}
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min="1"
                                      max="20"
                                      value={currentValue}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        setToolParamOverrides((prev) => ({
                                          ...prev,
                                          [tool.name]: {
                                            ...prev[tool.name],
                                            num_results: value,
                                          },
                                        }));
                                      }}
                                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                                      style={{
                                        accentColor: '#10b981',
                                      }}
                                    />
                                    {paramDef.description && (
                                      <div className="text-xs text-gray-500">
                                        {paramDef.description}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              return null;
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Input Section */}
          <div
            className="p-4 border-b"
            style={{ borderColor: '#2a2d35' }}
          >
            <span className="font-medium text-sm">User</span>
          </div>
          <div className="flex-1 p-4 flex flex-col">
            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Enter your message here..."
              className="flex-1 w-full p-3 rounded border font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600 mb-2"
              style={{
                backgroundColor: '#1a1d23',
                borderColor: '#2a2d35',
                color: '#e0e0e0',
              }}
            />
            <div className="text-xs text-gray-500 mt-2">
              {userTokens} tokens
            </div>
          </div>
        </div>

        {/* Right Panel - Response & Tool Calls */}
        <div className="w-1/3 flex flex-col">
          <div
            className="p-4 border-b"
            style={{ borderColor: '#2a2d35' }}
          >
            <span className="font-medium text-sm">
              Responses
              {conversationResponses.length > 0
                ? ` (${conversationResponses.length})`
                : ''}
            </span>
          </div>
          <div className="flex-1 p-4 flex flex-col overflow-hidden">
            {loading && streamingStatus && (
              <div
                className="mb-3 p-2 rounded"
                style={{
                  backgroundColor: '#1a1d23',
                  borderLeft: '3px solid #4ade80',
                }}
              >
                <div className="text-xs font-medium text-emerald-400">
                  {streamingStatus}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto mb-4 space-y-3">
              {loading && !debugResponse ? (
                <div className="text-sm text-gray-400">Initializing...</div>
              ) : (
                <>
                  {/* Active Streaming Response - Always on top when streaming */}
                  {loading &&
                    debugResponse?.debug_info?.timeline &&
                    debugResponse.debug_info.timeline.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 px-2">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                          <span className="text-xs font-medium text-emerald-400">
                            Streaming...
                          </span>
                        </div>
                        {renderTimeline(debugResponse.debug_info.timeline)}
                        {conversationResponses.length > 0 && (
                          <div
                            className="border-t pt-3"
                            style={{ borderColor: '#2a2d35' }}
                          >
                            <div className="text-xs text-gray-500 px-2 mb-3">
                              Previous Responses
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Conversation History View */}
                  {conversationResponses.length > 0
                    ? conversationResponses.map((response, responseIndex) => {
                        const truncatedMessage =
                          response.userMessage.length > 80
                            ? response.userMessage.substring(0, 80) + '...'
                            : response.userMessage;
                        const tokens =
                          response.debugResponse.debug_info?.total_tokens
                            .output || 0;
                        const responseTime =
                          response.debugResponse.debug_info?.response_time_ms ||
                          0;

                        return (
                          <div
                            key={response.timestamp}
                            className="border rounded"
                            style={{
                              borderColor: '#2a2d35',
                              backgroundColor: '#1a1d23',
                            }}
                          >
                            <button
                              onClick={() => toggleResponseCard(responseIndex)}
                              className="w-full p-3 flex items-center justify-between hover:bg-gray-800 transition-colors text-left"
                            >
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                {response.expanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                )}
                                <span className="text-sm text-gray-300 truncate">
                                  User: {truncatedMessage}
                                </span>
                              </div>
                              <div className="flex items-center space-x-3 text-xs text-gray-500 flex-shrink-0 ml-2">
                                <span>{(responseTime / 1000).toFixed(1)}s</span>
                                <span>{tokens}t</span>
                              </div>
                            </button>
                            {response.expanded &&
                              response.debugResponse.debug_info?.timeline && (
                                <div
                                  className="p-3 border-t space-y-3"
                                  style={{ borderColor: '#2a2d35' }}
                                >
                                  {renderTimeline(
                                    response.debugResponse.debug_info.timeline,
                                    responseIndex
                                  )}
                                </div>
                              )}
                          </div>
                        );
                      })
                    : !loading && (
                        <div className="text-sm text-gray-400">
                          Response will appear here...
                        </div>
                      )}
                </>
              )}
            </div>

            <div
              className="flex items-center justify-end pt-4 border-t"
              style={{ borderColor: '#2a2d35' }}
            >
              <div className="flex items-center space-x-4">
                <span className="text-xs text-gray-500">
                  {responseTokens} tokens
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                  title="Copy response"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configure Agents Modal */}
      <ConfigureAgentsModal
        isOpen={configureModalOpen}
        onClose={() => setConfigureModalOpen(false)}
        orgId={selectedOrgId}
        onAgentsChanged={() => {
          if (selectedOrgId) {
            loadBots(selectedOrgId);
          }
        }}
      />
    </div>
  );
}
