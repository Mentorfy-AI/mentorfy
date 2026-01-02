"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, MessageSquare, Clock } from "lucide-react"
import type { DashboardMetrics } from "@/lib/data/dashboard"

interface MetricsGridProps {
  initialData: DashboardMetrics
}

export function MetricsGrid({ initialData }: MetricsGridProps) {
  const metrics = initialData
  const loading = false

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

  const metricsData = loading ? [
    {
      title: "Students Helped",
      value: "--",
      change: "--",
      changeColor: "text-muted-foreground",
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Total Conversations",
      value: "--",
      change: "--",
      changeColor: "text-muted-foreground",
      icon: MessageSquare,
      color: "text-green-600",
    },
    {
      title: "Time Saved",
      value: "--",
      change: "--",
      changeColor: "text-muted-foreground",
      icon: Clock,
      color: "text-orange-600",
    },
  ] : [
    {
      title: "Students Helped",
      value: metrics?.studentsHelped.current.toLocaleString() || "0",
      change: formatChange(metrics?.studentsHelped.percentChange || 0),
      changeColor: getChangeColor(metrics?.studentsHelped.percentChange || 0),
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Total Conversations",
      value: metrics?.totalConversations.current.toLocaleString() || "0",
      change: formatChange(metrics?.totalConversations.percentChange || 0),
      changeColor: getChangeColor(metrics?.totalConversations.percentChange || 0),
      icon: MessageSquare,
      color: "text-green-600",
    },
    {
      title: "Time Saved",
      value: formatTimeSaved(metrics?.timeSaved.currentMinutes || 0),
      change: formatChange(metrics?.timeSaved.percentChange || 0),
      changeColor: getChangeColor(metrics?.timeSaved.percentChange || 0),
      icon: Clock,
      color: "text-orange-600",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {metricsData.map((metric) => {
        const Icon = metric.icon
        return (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.title}</CardTitle>
              <Icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${loading ? 'animate-pulse' : ''}`}>{metric.value}</div>
              <p className={`text-xs ${metric.changeColor} font-medium ${loading ? 'animate-pulse' : ''}`}>
                {loading ? 'Loading...' : `${metric.change} from last month`}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
