"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MessageSquare, Star, TrendingUp, Clock, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineEntry {
  id: string
  date: string
  title: string
  content: string
  wordsContributed: number
  type: "progress" | "milestone" | "blank"
  hoursLeft?: number
}

interface TimelineCardProps {
  entry: TimelineEntry
  isLast: boolean
  isMobile?: boolean
  onClick?: () => void
  onUpdateProgress?: () => void
}

/**
 * Timeline card component for displaying transformation journey entries
 * Features: Clickable cards, visual timeline connector, entry type indicators, blank progress cards
 */
export function TimelineCard({ entry, isLast, isMobile = false, onClick, onUpdateProgress }: TimelineCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()

    if (isToday) {
      return "Today"
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const isMilestone = entry.type === "milestone"
  const isBlank = entry.type === "blank"

  const handleCardClick = () => {
    if (isBlank && onUpdateProgress) {
      onUpdateProgress()
    } else if (onClick) {
      onClick()
    }
  }

  return (
    <div className="relative flex items-start gap-4">
      {/* Timeline Line and Dot */}
      <div className="flex flex-col items-center">
        {/* Timeline Dot */}
        <div
          className={cn(
            "w-4 h-4 rounded-full border-2 border-background shadow-sm z-10",
            isMilestone
              ? "bg-yellow-500 border-yellow-500"
              : isBlank
                ? "bg-gray-400 border-gray-400"
                : "bg-blue-500 border-blue-500",
          )}
        />

        {/* Timeline Line */}
        {!isLast && <div className="w-0.5 h-16 bg-border/50 mt-2" />}
      </div>

      {/* Card Content */}
      <Card
        className={cn(
          "flex-1 transition-all duration-200 cursor-pointer hover:shadow-md",
          "border border-border/50 hover:border-border",
          (onClick || onUpdateProgress) && "hover:scale-[1.02]",
          isBlank &&
            "border-dashed border-gray-300 bg-gray-50/50 dark:bg-gray-900/50 hover:bg-gray-100/50 dark:hover:bg-gray-800/50",
        )}
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          {isBlank ? (
            <div className="text-center py-6">
              <div className="flex items-center justify-center mb-3">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-semibold text-blue-600 dark:text-blue-400 text-sm mb-2 border border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30 px-3 py-1 rounded-md inline-block">
                {entry.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Click to update your mentors memory to enhance your AI experience
              </p>
              {entry.hoursLeft && (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{entry.hoursLeft} hours left to update today's memory</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground text-sm">{entry.title}</h3>
                    {isMilestone && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(entry.date)}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>{entry.wordsContributed} words</span>
                    </div>
                  </div>
                </div>

                <Badge
                  variant={isMilestone ? "default" : "secondary"}
                  className={cn(
                    "text-xs",
                    isMilestone
                      ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
                      : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
                  )}
                >
                  {isMilestone ? "Milestone" : "Progress"}
                </Badge>
              </div>

              {/* Content */}
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{entry.content}</p>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3" />
                  <span>Contributing to Mentor Memory</span>
                </div>

                {onClick && <span className="text-xs text-blue-500 font-medium">Click to expand</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
