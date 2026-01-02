"use client"
import { Users, MessageSquare, Clock } from "lucide-react"
import type { DashboardMetrics } from "@/lib/data/dashboard"

interface MetricsGridProps {
  initialData: DashboardMetrics
}

export function MetricsGrid({ initialData }: MetricsGridProps) {
  const metrics = initialData

  const formatTimeSaved = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    return hours > 0 ? `${hours.toLocaleString()} hrs` : `${minutes} min`
  }

  const formatChange = (percentChange: number) => {
    const sign = percentChange >= 0 ? '+' : ''
    return `${sign}${percentChange}%`
  }

  const getChangeColor = (percentChange: number) => {
    return percentChange >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const metricsData = [
    {
      title: "Students",
      value: metrics?.studentsHelped.current.toLocaleString() || "0",
      change: formatChange(metrics?.studentsHelped.percentChange || 0),
      changeColor: getChangeColor(metrics?.studentsHelped.percentChange || 0),
      icon: Users,
    },
    {
      title: "Conversations",
      value: metrics?.totalConversations.current.toLocaleString() || "0",
      change: formatChange(metrics?.totalConversations.percentChange || 0),
      changeColor: getChangeColor(metrics?.totalConversations.percentChange || 0),
      icon: MessageSquare,
    },
    {
      title: "Time Saved",
      value: formatTimeSaved(metrics?.timeSaved.currentMinutes || 0),
      change: formatChange(metrics?.timeSaved.percentChange || 0),
      changeColor: getChangeColor(metrics?.timeSaved.percentChange || 0),
      icon: Clock,
    },
  ]

  return (
    <div className="flex flex-wrap gap-6">
      {metricsData.map((metric) => {
        const Icon = metric.icon
        return (
          <div key={metric.title} className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold">{metric.value}</span>
                <span className={`text-xs font-medium ${metric.changeColor}`}>
                  {metric.change}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{metric.title}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
