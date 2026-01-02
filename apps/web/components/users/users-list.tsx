"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Users,
  Search,
  MessageCircle,
} from "lucide-react"
import { InviteStudentButton } from "@/components/invite-student-button"
import { toast } from "sonner"

interface UserMetrics {
  id: string
  clerk_user_id: string
  clerk_org_id: string
  summary: string | null
  metadata: any
  created_at: string
  updated_at: string
  conversation_count: number
  message_count: number
  last_active: string | null
  // Note: first_name, last_name, email should be fetched from Clerk API
  // These are temporarily included for display until Phase 3 webhook/middleware sync
  first_name?: string
  last_name?: string
  email?: string
}

interface UsersListProps {
  initialUsers: UserMetrics[]
}

export function UsersList({ initialUsers }: UsersListProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [userToDelete, setUserToDelete] = useState<UserMetrics | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName || !lastName) return "?"
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }

  const getFullName = (firstName?: string, lastName?: string, clerkUserId?: string) => {
    if (firstName && lastName) return `${firstName} ${lastName}`
    // Fallback to clerk_user_id if names not available
    return clerkUserId || "Unknown User"
  }

  const filteredUsers = initialUsers
    .filter((user) => {
      if (!searchTerm) return true
      const searchLower = searchTerm.toLowerCase()
      const fullName = getFullName(user.first_name, user.last_name, user.clerk_user_id).toLowerCase()
      const email = (user.email || "").toLowerCase()
      return fullName.includes(searchLower) || email.includes(searchLower)
    })
    .sort((a, b) => {
      // Sort by name alphabetically
      const nameA = getFullName(a.first_name, a.last_name, a.clerk_user_id)
      const nameB = getFullName(b.first_name, b.last_name, b.clerk_user_id)
      return nameA.localeCompare(nameB)
    })

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/users/${userToDelete.clerk_user_id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete user')
      }

      toast.success('User deleted successfully')
      router.refresh()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast.error(error.message || 'Failed to delete user')
    } finally {
      setIsDeleting(false)
      setUserToDelete(null)
    }
  }

  return (
    <>
      <div className="flex h-full overflow-hidden bg-card border rounded-lg">
        {/* Users list */}
        <div className="w-full flex flex-col overflow-hidden">
          {/* Header with search and invite */}
          <div className="p-3 flex items-center gap-3 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <InviteStudentButton />
          </div>

          {/* Users scroll area */}
          <ScrollArea className="flex-1 h-0">
            <div className="p-2">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">No users found</h3>
                  <p className="text-muted-foreground text-sm">
                    {searchTerm ? "Try adjusting your search" : "Invite your first user to get started"}
                  </p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.clerk_user_id}
                    onClick={() => router.push(`/users/${user.clerk_user_id}`)}
                    className="flex items-center gap-3 p-3 mx-2 mb-1 rounded-lg cursor-pointer transition-all hover:bg-muted/50"
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm truncate">
                          {getFullName(user.first_name, user.last_name, user.clerk_user_id)}
                        </h4>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTimestamp(user.last_active)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{user.email}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {user.message_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete && (
                <>
                  Are you sure you want to delete <strong>{getFullName(userToDelete.first_name, userToDelete.last_name, userToDelete.clerk_user_id)}</strong>?
                  <br />
                  <br />
                  This will permanently delete:
                  <ul className="list-disc list-inside mt-2">
                    <li>User profile and information</li>
                    <li>All conversations ({userToDelete.conversation_count})</li>
                    <li>All messages ({userToDelete.message_count})</li>
                  </ul>
                  <br />
                  <strong className="text-destructive">This action cannot be undone.</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
