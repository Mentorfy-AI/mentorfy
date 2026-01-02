"use client"
import { useState, useEffect } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ConversationDataPoint {
  date: string
  conversations: number
  formattedDate: string
}

const chartConfig = {
  conversations: {
    label: "Conversations",
    color: "hsl(217, 91%, 60%)", // Blue color that works in both light and dark modes
  },
} satisfies ChartConfig

interface ConversationsOverTimeClientProps {
  initialPeriod: '1month' | '3months' | '6months' | '1year'
  initialChartData: Array<{ date: string; count: number }>
}

export function ConversationsOverTimeClient({ initialPeriod, initialChartData }: ConversationsOverTimeClientProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'1month' | '3months' | '6months' | '1year'>(initialPeriod)

  // Transform initial data
  const transformData = (data: Array<{ date: string; count: number }>) => {
    return data.map((item) => ({
      date: item.date,
      conversations: item.count,
      formattedDate: new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }))
  }

  const [chartData, setChartData] = useState<ConversationDataPoint[]>(transformData(initialChartData))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Only fetch if period changed from initial
    if (selectedPeriod === initialPeriod) {
      // Reset to initial data if user goes back to initial period
      setChartData(transformData(initialChartData))
      return
    }

    async function fetchMetrics() {
      setLoading(true)
      try {
        const response = await fetch(`/api/dashboard/metrics?interval=${selectedPeriod}`)
        if (!response.ok) throw new Error('Failed to fetch metrics')

        const data = await response.json()
        setChartData(transformData(data.conversationsOverTime))
      } catch (error) {
        console.error('Error fetching dashboard metrics:', error)
        setChartData([])
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [selectedPeriod, initialPeriod, initialChartData])

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "1month":
        return "Last Month"
      case "3months":
        return "Last 3 Months"
      case "6months":
        return "Last 6 Months"
      case "1year":
        return "Last Year"
      default:
        return "Last Month"
    }
  }

  const totalConversations = chartData.reduce((sum, item) => sum + item.conversations, 0)

  return (
    <div>
      <div className="flex flex-col items-stretch sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-4 py-3">
          <h3 className="text-sm font-semibold">Conversations Over Time</h3>
          <p className="text-xs text-muted-foreground">{totalConversations.toLocaleString()} total</p>
        </div>
        <div className="flex items-center px-4 py-3">
          <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as typeof selectedPeriod)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="space-y-4 w-full max-w-3xl">
              <div className="flex items-end gap-2 justify-around h-32">
                {[60, 80, 45, 90, 70, 55, 85].map((height, i) => (
                  <div
                    key={i}
                    className="bg-muted animate-pulse rounded-t"
                    style={{ width: '40px', height: `${height}%` }}
                  />
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-muted-foreground text-sm">No conversation data available yet</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 20,
              right: 12,
              top: 20,
              bottom: 20,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
              tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
              className="text-foreground"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value}`}
              tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
              className="text-foreground"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[220px] bg-background border border-border shadow-lg rounded-lg p-3"
                  nameKey="conversations"
                  labelFormatter={(value) => {
                    const dataPoint = chartData.find((d) => d.date === value)
                    return (
                      dataPoint?.formattedDate ||
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    )
                  }}
                  formatter={(value, name) => [
                    <span key="value" className="font-semibold text-foreground">
                      {value} conversations
                    </span>,
                    <span key="label" className="text-muted-foreground">
                      Total Conversations
                    </span>,
                  ]}
                />
              }
            />
            <Bar
              dataKey="conversations"
              fill="hsl(217, 91%, 70%)"
              radius={[4, 4, 0, 0]}
              className="hover:opacity-90 transition-opacity"
            />
          </BarChart>
        </ChartContainer>
        )}
      </div>
    </div>
  )
}
