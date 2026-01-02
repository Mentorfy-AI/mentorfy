'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Trash2,
  Brain,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SupermemoryProfile } from '@/lib/data/users';

interface UserMetrics {
  profile_id: string;
  user_id: string;
  clerk_user_id: string;
  organization_id: string;
  clerk_org_id: string;
  first_name: string;
  last_name: string;
  email: string;
  summary: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  conversation_count: number;
  message_count: number;
  last_active: string | null;
  avg_response_time: string;
}

interface Conversation {
  id: string;
  clerk_user_id: string;
  updated_at: string;
  message_count?: number;
  [key: string]: any;
}

interface UserProfileProps {
  user: UserMetrics;
  conversations: Conversation[];
  supermemoryProfile?: SupermemoryProfile | null;
}

export function UserProfile({
  user,
  conversations,
  supermemoryProfile,
}: UserProfileProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}min ago`;
    if (diffHours < 24) return `${diffHours}hr ago`;
    return `${diffDays}d ago`;
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const getFullName = (firstName: string, lastName: string) => {
    return `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown User';
  };

  const handleDeleteUser = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${user.clerk_user_id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      toast.success('User deleted successfully');
      router.push('/users');
      router.refresh();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const hasMemories =
    supermemoryProfile &&
    (supermemoryProfile.static.length > 0 || supermemoryProfile.dynamic.length > 0);

  return (
    <>
      <div className="flex h-full overflow-hidden bg-card border rounded-lg">
        <div className="w-full flex flex-col overflow-hidden">
          {/* Header with back button, user info, and actions */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/users')}
                  className="-ml-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <div className="h-6 w-px bg-border" />
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(user.first_name, user.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-sm font-semibold">
                    {getFullName(user.first_name, user.last_name)}
                  </h1>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Stats row - compact */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span>{user.message_count || 0} messages</span>
              <span>{user.conversation_count || 0} conversations</span>
              <span>Active {formatTimestamp(user.last_active)}</span>
              <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="memory" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-3">
              <TabsList className="h-8">
                <TabsTrigger value="memory" className="gap-1.5 text-xs h-7 px-3">
                  <Brain className="h-3 w-3" />
                  Memory
                </TabsTrigger>
                <TabsTrigger value="conversations" className="gap-1.5 text-xs h-7 px-3">
                  <MessageSquare className="h-3 w-3" />
                  Conversations
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="memory" className="flex-1 overflow-auto p-4 pt-3 mt-0">
              {hasMemories ? (
                <div className="space-y-4">
                  {supermemoryProfile!.static.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wide">
                        Long-term
                      </h3>
                      <ul className="space-y-1.5">
                        {supermemoryProfile!.static.map((item, index) => (
                          <li
                            key={index}
                            className="text-sm leading-relaxed pl-3 border-l-2 border-blue-500"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {supermemoryProfile!.dynamic.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wide">
                        Recent Context
                      </h3>
                      <ul className="space-y-1.5">
                        {supermemoryProfile!.dynamic.map((item, index) => (
                          <li
                            key={index}
                            className="text-sm leading-relaxed pl-3 border-l-2 border-green-500"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No memories yet</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="conversations" className="flex-1 overflow-auto p-4 pt-3 mt-0">
              {conversations.length > 0 ? (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <Link
                      key={conv.id}
                      href={`/conversations/${conv.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {conv.message_count || 0} messages
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(conv.updated_at)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">View →</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{getFullName(user.first_name, user.last_name)}</strong>?
              <br />
              <br />
              This will permanently delete:
              <ul className="list-disc list-inside mt-2">
                <li>User profile and information</li>
                <li>All conversations ({user.conversation_count})</li>
                <li>All messages ({user.message_count})</li>
              </ul>
              <br />
              <strong className="text-destructive">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
