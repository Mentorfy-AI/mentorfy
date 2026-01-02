"use client"

import { useEffect, useState } from "react"
import { Loader2, Bot } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
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
    <div className="px-6 pt-2 pb-6 h-full">
      <div className="flex h-full overflow-hidden bg-card border rounded-lg">
        <div className="w-full flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-2">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {error && (
                <div className="m-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {!loading && !error && agents.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No agents configured</p>
                </div>
              )}

              {!loading && !error && agents.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-2">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => handleAgentClick(agent.id, agent.display_name)}
                      className="p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-all text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">
                            {agent.display_name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {agent.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
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
