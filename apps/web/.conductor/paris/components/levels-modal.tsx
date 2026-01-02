"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Lock } from "lucide-react"
import { useRouter } from "next/navigation"

interface LevelsModalProps {
  isOpen: boolean
  onClose: () => void
  currentLevel: number
  currentProgress: number
}

const levelData = [
  { level: 1, title: "Memory Spark", wordsRequired: 1000 },
  { level: 2, title: "Neural Awakening", wordsRequired: 5000 },
  { level: 3, title: "Cognitive Bloom", wordsRequired: 15000 },
  { level: 4, title: "Wisdom Weaver", wordsRequired: 35000 },
  { level: 5, title: "Mind Architect", wordsRequired: 75000 },
  { level: 6, title: "Memory Master", wordsRequired: 150000 },
  { level: 7, title: "Neural Nexus", wordsRequired: 300000 },
  { level: 8, title: "Consciousness Core", wordsRequired: 500000 },
]

export function LevelsModal({ isOpen, onClose, currentLevel }: LevelsModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  const handleNavigateToMemory = () => {
    onClose()
    router.push("/user-memory")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Mentor Memory Levels</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-6 text-center leading-relaxed">
            Every time you log your progress it gets saved to your mentor's memory.{" "}
            <span
              onClick={handleNavigateToMemory}
              className="text-blue-600 hover:text-blue-700 cursor-pointer underline font-medium"
            >
              Click to view your memory
            </span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            {levelData.map((level) => {
              const isUnlocked = level.level <= currentLevel
              const isCurrent = level.level === currentLevel

              return (
                <div
                  key={level.level}
                  onClick={handleNavigateToMemory}
                  className={`p-4 rounded-lg border text-center transition-all cursor-pointer hover:scale-105 ${
                    isCurrent
                      ? "border-green-500 bg-green-500/10"
                      : isUnlocked
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    {isUnlocked ? (
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isCurrent ? "bg-green-500" : "bg-green-500/70"
                        }`}
                      >
                        <span className="text-white font-bold">{level.level}</span>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <h4 className="font-medium text-sm mb-1">Level {level.level}</h4>
                  <p className="text-xs text-muted-foreground mb-2">{level.title}</p>

                  <p className="text-xs font-medium">{level.wordsRequired.toLocaleString()} words</p>
                </div>
              )
            })}
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              You are currently Level {currentLevel}. Keep chatting with your mentor to level up!{" "}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
