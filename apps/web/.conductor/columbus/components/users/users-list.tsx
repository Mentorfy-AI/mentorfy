"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users,
  ChevronRight,
  Search,
  Grid3X3,
  List,
  MessageCircle,
  ChevronLeft,
} from "lucide-react"
import { InviteStudentButton } from "@/components/invite-student-button"

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
  const [sortBy, setSortBy] = useState("name")
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

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
      const searchLower = searchTerm.toLowerCase()
      const fullName = getFullName(user.first_name, user.last_name, user.clerk_user_id).toLowerCase()
      const email = (user.email || "").toLowerCase()
      const clerkId = (user.clerk_user_id || "").toLowerCase()
      return (
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        clerkId.includes(searchLower) ||
        (user.summary?.toLowerCase().includes(searchLower) ?? false)
      )
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          const nameA = getFullName(a.first_name, a.last_name, a.clerk_user_id)
          const nameB = getFullName(b.first_name, b.last_name, b.clerk_user_id)
          return nameA.localeCompare(nameB)
        case "recent":
          if (!a.last_active) return 1
          if (!b.last_active) return -1
          return new Date(b.last_active).getTime() - new Date(a.last_active).getTime()
        default:
          return 0
      }
    })

  const totalItems = filteredUsers.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = viewMode === "list" ? filteredUsers.slice(startIndex, endIndex) : filteredUsers

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value))
    setCurrentPage(1)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sort" className="text-sm font-medium">
              Sort:
            </Label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm bg-background"
            >
              <option value="name">Name</option>
              <option value="recent">Recently Active</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{filteredUsers.length} users</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "cards" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("cards")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <InviteStudentButton />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No users found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? "Try adjusting your search terms" : "Get started by inviting your first user"}
          </p>
          {!searchTerm && <InviteStudentButton />}
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <Card
              key={user.clerk_user_id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/users/${user.clerk_user_id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{getFullName(user.first_name, user.last_name, user.clerk_user_id)}</CardTitle>
                      <CardDescription className="text-sm">
                        {user.email || user.clerk_user_id}
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="text-sm text-muted-foreground line-clamp-2">
                  {user.summary || "No profile information"}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{user.message_count || 0}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Last message: {formatTimestamp(user.last_active)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Conversations</TableHead>
                <TableHead>Last Message Sent</TableHead>
                <TableHead>Date Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((user) => (
                <TableRow
                  key={user.clerk_user_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/users/${user.clerk_user_id}`)}
                >
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-sm">{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{getFullName(user.first_name, user.last_name, user.clerk_user_id)}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.email || user.clerk_user_id}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{user.message_count || 0}</TableCell>
                  <TableCell className="text-sm">{user.conversation_count || 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatTimestamp(user.last_active)}</TableCell>
                  <TableCell className="text-sm">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-4 pb-4 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items per page:</span>
              <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                <SelectTrigger className="w-20 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 px-3"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="h-8 w-8 p-0 text-sm"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 px-3"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
