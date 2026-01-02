"use client"
import { useState, useEffect } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    <Card className="py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:!py-6">
          <CardTitle className="text-xl">Conversations Over Time</CardTitle>
          <CardDescription>{getPeriodLabel(selectedPeriod)}</CardDescription>
        </div>
        <div className="flex items-center justify-center px-6 pt-2 pb-3 sm:!py-6 border-l border-border">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{totalConversations.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Conversations</div>
          </div>
        </div>
        <div className="flex items-center px-6 pt-4 pb-3 sm:!py-6">
          <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as typeof selectedPeriod)}>
            <SelectTrigger className="w-[180px]">
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
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="space-y-4 w-full max-w-3xl">
              <div className="flex items-end gap-2 justify-around h-64">
                {[60, 80, 45, 90, 70, 55, 85].map((height, i) => (
                  <div
                    key={i}
                    className="bg-muted animate-pulse rounded-t"
                    style={{ width: '40px', height: `${height}%` }}
                  />
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground">Loading conversation data...</p>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">No conversation data available yet</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[400px] w-full">
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
              fill="hsl(217, 91%, 60%)" // Blue color that works in both light and dark modes
              radius={[4, 4, 0, 0]}
              className="hover:opacity-90 transition-all duration-300 hover:brightness-110 cursor-pointer"
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              onMouseEnter={(data, index) => {
                const target = data.target as SVGElement
                if (target) {
                  target.style.filter = "brightness(1.2)"
                  target.style.transform = "scaleY(1.02)"
                  target.style.transformOrigin = "bottom"
                }
              }}
              onMouseLeave={(data, index) => {
                const target = data.target as SVGElement
                if (target) {
                  target.style.filter = "none"
                  target.style.transform = "none"
                }
              }}
            />
          </BarChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
