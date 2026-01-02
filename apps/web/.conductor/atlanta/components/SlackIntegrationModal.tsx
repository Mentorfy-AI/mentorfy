"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SlackIntegrationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SlackIntegrationModal({ open, onOpenChange }: SlackIntegrationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Slack Integration</DialogTitle>
          <DialogDescription>
            To set up Slack integration for your organization, please reach out to your Mentorfy contact.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
