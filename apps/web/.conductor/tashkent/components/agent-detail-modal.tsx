"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, MessageSquare, Pencil, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"
import type { AgentDetail } from "@/app/api/agents/[agentId]/route"

interface AgentDetailModalProps {
  agentId: string | null
  agentName?: string
  isOpen: boolean
  onClose: () => void
}

export function AgentDetailModal({ agentId, agentName, isOpen, onClose }: AgentDetailModalProps) {
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    display_name: '',
    description: '',
    avatar_url: ''
  })
  const router = useRouter()

  useEffect(() => {
    if (!isOpen || !agentId) {
      setAgent(null)
      setError(null)
      setIsEditing(false)
      return
    }

    const fetchAgentDetails = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/agents/${agentId}`)
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch agent details')
        }

        setAgent(data.agent)
        setEditForm({
          display_name: data.agent.display_name,
          description: data.agent.description,
          avatar_url: data.agent.avatar_url
        })
      } catch (err) {
        console.error('Error fetching agent details:', err)
        setError(err instanceof Error ? err.message : 'Failed to load agent details')
      } finally {
        setLoading(false)
      }
    }

    fetchAgentDetails()
  }, [agentId, isOpen])

  const handleSave = async () => {
    if (!agentId || !agent) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update agent')
      }

      setAgent(data.agent)
      setIsEditing(false)
    } catch (err) {
      console.error('Error updating agent:', err)
      setError(err instanceof Error ? err.message : 'Failed to update agent')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (agent) {
      setEditForm({
        display_name: agent.display_name,
        description: agent.description,
        avatar_url: agent.avatar_url
      })
    }
    setIsEditing(false)
    setError(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-xl">
              {agentName || agent?.display_name || agent?.name || 'Agent Details'}
            </DialogTitle>
            {!loading && agent && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && agent && (
          <ScrollArea className="max-h-[calc(85vh-120px)]">
            <div className="space-y-6 pr-4">
              {isEditing ? (
                /* Edit Mode */
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="display_name">Display Name</Label>
                      <Input
                        id="display_name"
                        value={editForm.display_name}
                        onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                        placeholder="Enter display name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Enter description"
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="avatar_url">Avatar URL</Label>
                      <Input
                        id="avatar_url"
                        value={editForm.avatar_url}
                        onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                        placeholder="Enter avatar image URL (optional)"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                    <Button
                      onClick={handleCancel}
                      disabled={saving}
                      variant="outline"
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                /* View Mode */
                <>
                  {/* Description */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Description</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {agent.description}
                    </p>
                  </div>

                  {/* Action Button */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => {
                        router.push(`/chat?botId=${agentId}`)
                        onClose()
                      }}
                      className="w-full"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Talk to your AI
                    </Button>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Badge variant="outline" className="text-xs">
                      Created {new Date(agent.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
