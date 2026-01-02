"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, Send, X, Mic } from "lucide-react"

interface ProgressPromptBoxProps extends React.ComponentProps<"textarea"> {
  onSubmit?: (message: string) => void
  onClose?: () => void
}

export function ProgressPromptBox({ className, onSubmit, onClose, ...props }: ProgressPromptBoxProps) {
  const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [value, setValue] = React.useState("")
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [isImageDialogOpen, setIsImageDialogOpen] = React.useState(false)

  React.useLayoutEffect(() => {
    const textarea = internalTextareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      const newHeight = Math.min(textarea.scrollHeight, 200)
      textarea.style.height = `${newHeight}px`
    }
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    if (props.onChange) props.onChange(e)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim() && onSubmit) {
      console.log("[v0] Submitting progress update:", value.trim())
      onSubmit(value.trim())
      setValue("")
      setImagePreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && onSubmit) {
        handleSubmit(e as any)
      }
    }
  }

  const handlePlusClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
    event.target.value = ""
  }

  const handleRemoveImage = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const hasValue = value.trim().length > 0 || imagePreview

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col" data-slot="progress-prompt-box">
      <div
        className={cn(
          "flex flex-col rounded-[28px] p-6 shadow-lg transition-all duration-200 flex-1 min-h-[400px] relative",
          "bg-card border border-border cursor-text",
          "hover:shadow-xl focus-within:ring-2 focus-within:ring-ring/20",
          className,
        )}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close progress input"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
          aria-label="Upload image file"
        />

        {imagePreview && (
          <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
            <div className="relative mb-1 w-fit rounded-[1rem] px-1 pt-1">
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[1rem]"
                  aria-label="View full size image"
                >
                  <img
                    src={imagePreview || "/placeholder.svg"}
                    alt="Image preview"
                    className="h-14.5 w-14.5 rounded-[1rem] object-cover"
                  />
                </button>
              </DialogTrigger>
              <button
                onClick={handleRemoveImage}
                className="absolute right-2 top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none">
              <img
                src={imagePreview || "/placeholder.svg"}
                alt="Full size preview"
                className="w-full max-h-[95vh] object-contain rounded-[24px]"
              />
            </DialogContent>
          </Dialog>
        )}

        <textarea
          ref={internalTextareaRef}
          rows={1}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Share your progress..."
          className={cn(
            "custom-scrollbar w-full resize-none border-0 bg-transparent p-3 flex-1",
            "text-foreground placeholder:text-muted-foreground",
            "focus:ring-0 focus-visible:outline-none",
            "min-h-32 text-base leading-relaxed pt-6",
          )}
          aria-label="Progress update input"
          {...props}
        />

        <div className="mt-0.5 p-1 pt-0">
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-2">
              {/* Attach Image Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handlePlusClick}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Attach image"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Attach image</p>
                </TooltipContent>
              </Tooltip>

              {/* Right side controls */}
              <div className="ml-auto flex items-center gap-2">
                {/* Voice Recording Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Record voice message"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Record voice</p>
                  </TooltipContent>
                </Tooltip>

                {/* Send Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="submit"
                      disabled={!hasValue}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "disabled:pointer-events-none",
                        "bg-primary text-primary-foreground hover:bg-primary/90",
                        "disabled:bg-muted disabled:text-muted-foreground",
                      )}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Send</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </form>
  )
}
