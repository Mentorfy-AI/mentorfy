"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Users, Calendar, Clock, MessageCircle, MessageSquare } from "lucide-react"

interface UserMetrics {
  profile_id: string
  user_id: string
  clerk_user_id: string
  organization_id: string
  clerk_org_id: string
  first_name: string
  last_name: string
  email: string
  summary: string | null
  metadata: any
  created_at: string
  updated_at: string
  conversation_count: number
  message_count: number
  last_active: string | null
  avg_response_time: string
}

interface Conversation {
  id: string
  clerk_user_id: string
  updated_at: string
  [key: string]: any
}

interface UserProfileProps {
  user: UserMetrics
  conversations: Conversation[]
}

export function UserProfile({ user, conversations }: UserProfileProps) {
  const router = useRouter()

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "Never"
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}min ago`
    if (diffHours < 24) return `${diffHours}hr ago`
    return `${diffDays}d ago`
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }

  const getFullName = (firstName: string, lastName: string) => {
    return `${firstName} ${lastName}`
  }

  return (
    <>
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => router.push('/users')}>
          ← Back to Users
        </Button>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{getFullName(user.first_name, user.last_name)}</h1>
            <p className="text-muted-foreground text-sm">Comprehensive user profile</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="text-center">
            <Avatar className="w-20 h-20 mx-auto">
              <AvatarFallback className="text-lg">{getInitials(user.first_name, user.last_name)}</AvatarFallback>
            </Avatar>
            <CardTitle>{getFullName(user.first_name, user.last_name)}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Joined</span>
                  <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Last Message</span>
                  <p className="font-medium">{formatTimestamp(user.last_active)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Messages Sent</span>
                  <p className="font-medium">{user.message_count || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Conversations</span>
                  <p className="font-medium">{user.conversation_count || 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-line text-sm leading-relaxed">
                  {user.summary || "No profile information available"}
                </div>
              </div>
            </CardContent>
          </Card>

          {conversations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Conversations</CardTitle>
                <CardDescription>{conversations.length} conversation(s)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/conversations/${conv.id}`)}
                    >
                      <div>
                        <p className="font-medium">Conversation</p>
                        <p className="text-sm text-muted-foreground">
                          Last updated: {new Date(conv.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        View →
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
