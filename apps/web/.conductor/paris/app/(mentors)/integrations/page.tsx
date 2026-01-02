"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SlackIntegrationModal } from "@/components/SlackIntegrationModal"

export default function IntegrationsPage() {
  const [slackModalOpen, setSlackModalOpen] = useState(false)

  const integrations = [
    {
      id: "slack",
      name: "Slack",
      icon: "💬",
      description: "Integrate with Slack workspaces",
      category: "Communication",
    },
  ]

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-balance">Integrations</h1>
        <p className="text-muted-foreground text-pretty">Connect AI To Anything</p>
      </div>

      {/* Available Integrations */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card key={integration.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{integration.icon}</span>
                <div>
                  <CardTitle className="text-lg">{integration.name}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {integration.category}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="mb-4">{integration.description}</CardDescription>
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => setSlackModalOpen(true)}
              >
                Connect
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Looking for something that&apos;s not here? Message your Mentorfy contact!
      </p>

      <SlackIntegrationModal open={slackModalOpen} onOpenChange={setSlackModalOpen} />
    </div>
  )
}
