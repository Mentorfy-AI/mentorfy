"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Target, Loader2, Bot } from "lucide-react"
import { AgentDetailModal } from "@/components/agent-detail-modal"
import type { Agent } from "@/app/api/agents/route"

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedAgentName, setSelectedAgentName] = useState<string>("")
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch('/api/agents')
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch agents')
        }

        setAgents(data.agents || [])
      } catch (err) {
        console.error('Error fetching agents:', err)
        setError(err instanceof Error ? err.message : 'Failed to load agents')
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
  }, [])

  const handleAgentClick = (agentId: string, displayName: string) => {
    setSelectedAgentId(agentId)
    setSelectedAgentName(displayName)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedAgentId(null)
    setSelectedAgentName("")
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b bg-background p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-balance">Your Agents</h1>
          <p className="text-muted-foreground text-pretty">View your AI mentor agents</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Card className="border shadow-sm bg-background">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  Mentor Agents
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Your configured AI mentor agents
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {!loading && !error && agents.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">No agents found</p>
                <p className="text-xs mt-1">Contact your Mentorfy representative to add agents</p>
              </div>
            )}

            {!loading && !error && agents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAgentClick(agent.id, agent.display_name)}
                    className="p-4 rounded-lg border-2 border-muted hover:border-primary/50 hover:bg-muted/50 transition-all text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Bot className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-foreground">
                          {agent.display_name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {agent.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center">
                To add more agents, please reach out to your Mentorfy contact
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <AgentDetailModal
        agentId={selectedAgentId}
        agentName={selectedAgentName}
        isOpen={modalOpen}
        onClose={handleCloseModal}
      />
    </div>
  )
}
