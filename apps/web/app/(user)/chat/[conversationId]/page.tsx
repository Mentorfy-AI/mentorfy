'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useSupabaseClient } from '@/lib/supabase-browser';
import { UnifiedChatInterface } from '@/components/unified-chat-interface';

interface Bot {
  id: string;
  display_name: string;
  description: string;
  avatar_url: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  metadata?: {
    files?: Array<{
      name: string;
      type: string;
      file_id?: string;
      size?: number;
    }>;
  } | null;
}

/**
 * Client Component: Unified chat page
 * Handles both new chats (conversationId === 'new') and existing conversations
 * Stays mounted during URL transitions for seamless streaming
 */
export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const { userId, orgId, isLoaded } = useAuth();
  const supabase = useSupabaseClient();
  const conversationId = params.conversationId as string;

  // Check for botId query parameter for direct bot links
  const searchParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const selectedBotId = searchParams.get('botId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botData, setBotData] = useState<{
    botId: string;
    botInfo: { id: string; display_name: string; avatar_url: string };
    allBots?: Bot[];
    initialMessages?: any[];
    needsFormGreeting?: boolean;
  } | null>(null);
  const lastConversationIdRef = useRef<string>(conversationId);

  useEffect(() => {
    // Wait for Clerk to load before checking auth
    if (!isLoaded) {
      return; // Still loading, don't redirect yet
    }

    if (!userId || !orgId) {
      router.push('/sign-in');
      return;
    }

    // Skip refetch when transitioning from 'new' to actual UUID (conversation just created)
    const previousId = lastConversationIdRef.current;
    const isNewChatTransition =
      previousId === 'new' && conversationId !== 'new';
    if (isNewChatTransition) {
      lastConversationIdRef.current = conversationId;
      return;
    }
    lastConversationIdRef.current = conversationId;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // NEW CHAT: conversationId === 'new'
        if (conversationId === 'new') {
          // Fetch ALL bots for the organization
          const { data: allBots, error: botsError } = await supabase
            .from('mentor_bot')
            .select('id, display_name, description, avatar_url')
            .eq('clerk_org_id', orgId)
            .order('created_at');

          if (botsError) throw botsError;

          // Determine initial bot: use botId from query param if provided, otherwise first available bot
          let initialBot = null;
          if (selectedBotId && allBots) {
            initialBot =
              allBots.find((bot) => bot.id === selectedBotId) || null;
          }
          if (!initialBot && allBots && allBots.length > 0) {
            initialBot = allBots[0];
          }

          if (!initialBot) {
            setError('No bots available. Please contact your administrator.');
            setLoading(false);
            return;
          }

          setBotData({
            botId: initialBot.id,
            botInfo: {
              id: initialBot.id,
              display_name: initialBot.display_name,
              avatar_url: initialBot.avatar_url || '',
            },
            allBots: allBots || [],
          });
        } else {
          // EXISTING CONVERSATION: Fetch conversation and messages
          const { data: conversation, error: convError } = await supabase
            .from('conversation')
            .select(
              `
              *,
              mentor_bot_id (
                id,
                display_name,
                avatar_url
              )
            `
            )
            .eq('id', conversationId)
            .eq('clerk_user_id', userId)
            .eq('clerk_org_id', orgId)
            .single();

          if (convError || !conversation) {
            setError('Conversation not found');
            setLoading(false);
            return;
          }

          // Fetch messages
          const { data: messages } = await supabase
            .from('message')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

          // Transform messages for client
          const initialMessages = (messages || []).map((msg: Message) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            timestamp: new Date(msg.created_at),
            files: msg.metadata?.files || undefined, // Extract files from JSONB metadata
          }));

          // Check if this conversation needs a form greeting
          const metadata = conversation.metadata || {};
          const needsFormGreeting =
            metadata.needs_form_greeting && initialMessages.length === 0;

          setBotData({
            botId: conversation.mentor_bot_id.id,
            botInfo: {
              id: conversation.mentor_bot_id.id,
              display_name: conversation.mentor_bot_id.display_name,
              avatar_url: conversation.mentor_bot_id.avatar_url || '',
            },
            initialMessages,
            needsFormGreeting,
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('[CLIENT] Failed to load data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chat');
        setLoading(false);
      }
    }

    fetchData();
  }, [conversationId, userId, orgId, isLoaded, router, supabase]);

  if (!isLoaded || !userId || !orgId) {
    return null; // Will redirect via useEffect if not authenticated
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !botData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">{error || 'Failed to load chat'}</p>
          <button
            onClick={() => router.push('/chat/new')}
            className="text-sm text-blue-500 hover:underline"
          >
            Start a new chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <UnifiedChatInterface
      botId={botData.botId}
      botInfo={botData.botInfo}
      conversationId={conversationId === 'new' ? undefined : conversationId}
      initialMessages={botData.initialMessages}
      allBots={botData.allBots}
      needsFormGreeting={botData.needsFormGreeting}
    />
  );
}
