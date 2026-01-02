'use client'

import {
  Clock,
  FileJson,
  CheckSquare,
  BookOpen,
  CheckCircle2,
  Zap,
  RotateCcw,
  AlertCircle,
  Check,
  RefreshCw,
  X,
} from 'lucide-react'

const iconMap = {
  Clock,
  FileJson,
  CheckSquare,
  BookOpen,
  CheckCircle2,
  Zap,
  RotateCcw,
  AlertCircle,
  Check,
  RefreshCw,
  X,
}

interface StatusIconProps {
  name?: string
  className?: string
}

export function StatusIcon({ name, className = 'h-3 w-3' }: StatusIconProps) {
  if (!name) return null

  const IconComponent = iconMap[name as keyof typeof iconMap]
  if (!IconComponent) return null

  return <IconComponent className={className} />
}
