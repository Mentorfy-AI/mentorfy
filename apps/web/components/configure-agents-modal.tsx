"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Loader2, Plus, Pencil, Trash2, Check, X, Upload, Image as ImageIcon } from "lucide-react"

interface Agent {
  id: string
  name: string
  display_name: string
  description: string
  avatar_url: string
  model_name: string
  max_tokens: number
  enable_memory: boolean
  created_at: string
}

interface ConfigureAgentsModalProps {
  isOpen: boolean
  onClose: () => void
  orgId: string | null
  onAgentsChanged?: () => void
}

// Anthropic models only
const ANTHROPIC_MODELS = [
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1' },
]

const DEFAULT_MODEL = 'claude-3-5-sonnet-20240620'

type ViewMode = 'list' | 'create' | 'edit'

export function ConfigureAgentsModal({
  isOpen,
  onClose,
  orgId,
  onAgentsChanged,
}: ConfigureAgentsModalProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    display_name: '',
    description: '',
    avatar_url: '',
    model_name: DEFAULT_MODEL,
    max_tokens: 1000,
    enable_memory: true,
  })

  // Fetch agents when modal opens
  useEffect(() => {
    if (!isOpen || !orgId) {
      setAgents([])
      setError(null)
      setViewMode('list')
      setEditingAgent(null)
      return
    }

    fetchAgents()
  }, [isOpen, orgId])

  const fetchAgents = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/agent-console/bots?orgId=${encodeURIComponent(orgId!)}`)
      if (!response.ok) {
        throw new Error('Failed to fetch agents')
      }
      const data = await response.json()
      setAgents(data)
    } catch (err) {
      console.error('Error fetching agents:', err)
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setFormData({
      display_name: '',
      description: '',
      avatar_url: '',
      model_name: DEFAULT_MODEL,
      max_tokens: 1000,
      enable_memory: true,
    })
    setAvatarFile(null)
    setAvatarPreview(null)
    setViewMode('create')
    setError(null)
  }

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setFormData({
      display_name: agent.display_name,
      description: agent.description,
      avatar_url: agent.avatar_url || '',
      model_name: agent.model_name || DEFAULT_MODEL,
      max_tokens: agent.max_tokens,
      enable_memory: agent.enable_memory ?? true,
    })
    setAvatarFile(null)
    setAvatarPreview(agent.avatar_url || null)
    setViewMode('edit')
    setError(null)
  }

  const handleCancelForm = () => {
    setViewMode('list')
    setEditingAgent(null)
    setFormData({
      display_name: '',
      description: '',
      avatar_url: '',
      model_name: DEFAULT_MODEL,
      max_tokens: 1000,
      enable_memory: true,
    })
    setAvatarFile(null)
    setAvatarPreview(null)
    setError(null)
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.')
      return
    }

    setAvatarFile(file)
    setError(null)

    // Generate preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const uploadAvatar = async (botId: string): Promise<string | null> => {
    if (!avatarFile) return null

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', avatarFile)
      formData.append('botId', botId)

      const response = await fetch('/api/avatars/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload avatar')
      }

      return data.publicUrl
    } catch (err) {
      console.error('Error uploading avatar:', err)
      throw err
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSubmitCreate = async () => {
    if (!formData.display_name.trim() || !formData.description.trim()) {
      setError('Display name and description are required')
      return
    }

    if (!avatarFile) {
      setError('Avatar image is required')
      return
    }

    if (!orgId) {
      setError('Organization ID is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // First create the bot
      const response = await fetch('/api/agent-console/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          display_name: formData.display_name,
          description: formData.description,
          model_name: formData.model_name,
          max_tokens: formData.max_tokens,
          enable_memory: formData.enable_memory,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create agent')
      }

      const botId = data.agent.id

      // Upload avatar
      const publicUrl = await uploadAvatar(botId)
      if (!publicUrl) {
        throw new Error('Failed to upload avatar')
      }

      // Update bot with avatar URL
      await fetch(`/api/agent-console/bots/${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: publicUrl }),
      })

      // Refresh list and reset form
      await fetchAgents()
      handleCancelForm()
      onAgentsChanged?.()
    } catch (err) {
      console.error('Error creating agent:', err)
      setError(err instanceof Error ? err.message : 'Failed to create agent')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitEdit = async () => {
    if (!editingAgent) return
    if (!formData.display_name.trim() || !formData.description.trim()) {
      setError('Display name and description are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let avatarUrl = formData.avatar_url

      // If new avatar file selected, upload it
      if (avatarFile) {
        const publicUrl = await uploadAvatar(editingAgent.id)
        if (!publicUrl) {
          throw new Error('Failed to upload avatar')
        }
        avatarUrl = publicUrl
      }

      const response = await fetch(`/api/agent-console/bots/${editingAgent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: formData.display_name,
          description: formData.description,
          avatar_url: avatarUrl,
          model_name: formData.model_name,
          max_tokens: formData.max_tokens,
          enable_memory: formData.enable_memory,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update agent')
      }

      // Refresh list and reset form
      await fetchAgents()
      handleCancelForm()
      onAgentsChanged?.()
    } catch (err) {
      console.error('Error updating agent:', err)
      setError(err instanceof Error ? err.message : 'Failed to update agent')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (agent: Agent) => {
    const confirmed = window.confirm(
      `Delete "${agent.display_name}"? This action cannot be undone.`
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/agent-console/bots/${agent.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete agent')
      }

      // Refresh list
      await fetchAgents()
      onAgentsChanged?.()
    } catch (err) {
      console.error('Error deleting agent:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete agent')
    }
  }

  const getModelLabel = (modelName: string) => {
    return ANTHROPIC_MODELS.find(m => m.value === modelName)?.label || modelName
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {viewMode === 'list' && 'Configure Agents'}
            {viewMode === 'create' && 'Create New Agent'}
            {viewMode === 'edit' && 'Edit Agent'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleCreate} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No agents found. Create one to get started.
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">
                          {agent.display_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {getModelLabel(agent.model_name)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(agent.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(agent)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(agent)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {(viewMode === 'create' || viewMode === 'edit') && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                placeholder="e.g., Sales Coach"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe what this agent does..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model_name">Foundation Model *</Label>
              <Select
                value={formData.model_name}
                onValueChange={(value) =>
                  setFormData({ ...formData, model_name: value })
                }
              >
                <SelectTrigger id="model_name" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANTHROPIC_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_tokens">Max Tokens *</Label>
              <Input
                id="max_tokens"
                type="number"
                min={100}
                max={64000}
                value={formData.max_tokens}
                onChange={(e) =>
                  setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 1000 })
                }
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground">
                Maximum tokens for model responses (100-64000)
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable_memory">Enable Memory</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow this agent to retrieve and store user context in Supermemory.
                    Disable for internal/operational agents.
                  </p>
                </div>
                <Switch
                  id="enable_memory"
                  checked={formData.enable_memory}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, enable_memory: checked })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar_file">Avatar Image *</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    id="avatar_file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarFileChange}
                    disabled={uploadingAvatar}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WebP, or GIF (max 5MB)
                  </p>
                </div>
                {avatarPreview && (
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={viewMode === 'create' ? handleSubmitCreate : handleSubmitEdit}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {viewMode === 'create' ? 'Create Agent' : 'Save Changes'}
              </Button>
              <Button
                onClick={handleCancelForm}
                disabled={saving}
                variant="outline"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
