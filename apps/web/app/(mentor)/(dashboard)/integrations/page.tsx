"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare } from "lucide-react"
import { SlackIntegrationModal } from "@/components/SlackIntegrationModal"

export default function IntegrationsPage() {
  const [slackModalOpen, setSlackModalOpen] = useState(false)

  const integrations = [
    {
      id: "slack",
      name: "Slack",
      description: "Connect your Slack workspace",
      icon: MessageSquare,
    },
  ]

  return (
    <div className="px-6 pt-2 pb-6 h-full">
      <div className="flex h-full overflow-hidden bg-card border rounded-lg">
        <div className="w-full flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-4">
              {integrations.map((integration) => {
                const Icon = integration.icon
                return (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">{integration.name}</h3>
                        <p className="text-xs text-muted-foreground">{integration.description}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSlackModalOpen(true)}
                    >
                      Connect
                    </Button>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      <SlackIntegrationModal open={slackModalOpen} onOpenChange={setSlackModalOpen} />
    </div>
  )
}
