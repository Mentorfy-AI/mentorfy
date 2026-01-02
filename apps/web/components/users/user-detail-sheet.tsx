"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Users, Calendar, Clock, MessageCircle, MessageSquare, Loader2 } from "lucide-react"

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

interface UserDetailSheetProps {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserDetailSheet({ userId, open, onOpenChange }: UserDetailSheetProps) {
  const router = useRouter()
  const [user, setUser] = useState<UserMetrics | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function loadUserData() {
      if (!userId || !open) {
        setUser(null)
        setConversations([])
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/users/${userId}`)
        const data = await response.json()

        if (data.success) {
          setUser(data.user)
          setConversations(data.conversations || [])
        } else {
          console.error('Failed to load user:', data.error)
        }
      } catch (error) {
        console.error('Failed to load user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [userId, open])

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              <SheetHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg">
                      {getInitials(user.first_name, user.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-2xl">
                      {getFullName(user.first_name, user.last_name)}
                    </SheetTitle>
                    <SheetDescription>{user.email}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Joined</p>
                        <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Last Message</p>
                        <p className="font-medium">{formatTimestamp(user.last_active)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Messages Sent</p>
                        <p className="font-medium">{user.message_count || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Conversations</p>
                        <p className="font-medium">{user.conversation_count || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

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
                          onClick={() => {
                            onOpenChange(false)
                            router.push(`/conversations/${conv.id}`)
                          }}
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
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No user data available</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
