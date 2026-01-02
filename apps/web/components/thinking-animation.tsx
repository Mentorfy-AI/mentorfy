"use client"

import { useEffect, useState } from "react"

export function ThinkingAnimation() {
  const [dots, setDots] = useState("")

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return ""
        return prev + "."
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center space-x-2 text-muted-foreground">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" />
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
      </div>
      <span className="text-sm">Thinking{dots}</span>
    </div>
  )
}
