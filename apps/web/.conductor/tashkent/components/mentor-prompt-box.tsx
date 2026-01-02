"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, Settings2, Send, X, Brain, BarChart3, Heart, Target, Mic, File, Loader2 } from "lucide-react"
import { useMentorBots } from "@/hooks/use-mentor-bots"

interface MentorBot {
  id: string
  name: string
  description: string | null
  icon?: any
}

interface MentorPromptBoxProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSubmit?: (message: string, botId?: string, file?: File) => void
  selectedBotId?: string
  onBotSelect?: (botId: string | null) => void
  isReadOnly?: boolean
  isSubmitting?: boolean
}

export function MentorPromptBox({ className, onSubmit, selectedBotId, onBotSelect, isReadOnly = false, isSubmitting = false, ...props }: MentorPromptBoxProps) {
  const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])
  const [value, setValue] = React.useState("")
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null)
  const [selectedModel, setSelectedModel] = React.useState<string | null>(selectedBotId || null)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const [isImageDialogOpen, setIsImageDialogOpen] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [isTranscribing, setIsTranscribing] = React.useState(false)
  const [recordingDuration, setRecordingDuration] = React.useState(0)
  const [isUploadTooltipOpen, setIsUploadTooltipOpen] = React.useState(false)
  const recordingIntervalRef = React.useRef<NodeJS.Timeout | null>(null)

  // Use global cached mentor bots hook
  const { bots: fetchedBots, isLoading: isLoadingBots } = useMentorBots()

  // Add icons to bots
  const mentorBots = React.useMemo(() => {
    return fetchedBots.map((bot: any, index: number) => ({
      ...bot,
      icon: [Brain, BarChart3, Heart, Target][index % 4],
    }))
  }, [fetchedBots])

  // Auto-select first bot when bots are loaded (only if no bot is selected)
  // Track if we've already auto-selected to prevent loops
  const hasAutoSelectedRef = React.useRef(false)

  React.useEffect(() => {
    if (!isLoadingBots && mentorBots.length > 0 && !selectedModel && !selectedBotId && !hasAutoSelectedRef.current) {
      const firstBotId = mentorBots[0].id
      setSelectedModel(firstBotId)
      hasAutoSelectedRef.current = true
      if (onBotSelect) {
        onBotSelect(firstBotId)
      }
    }
  }, [isLoadingBots, mentorBots.length, selectedModel, selectedBotId])

  // Reset auto-select flag when bots change (only when the length changes, not on every render)
  React.useEffect(() => {
    hasAutoSelectedRef.current = false
  }, [mentorBots.length])

  // Sync with external selectedBotId prop
  React.useEffect(() => {
    if (selectedBotId && selectedBotId !== selectedModel) {
      setSelectedModel(selectedBotId)
    }
  }, [selectedBotId, selectedModel])

  React.useEffect(() => {
    console.log('[VALUE-CHANGE] Value state changed to:', value)
    if (value === '') {
      console.trace('[VALUE-CHANGE] Stack trace for empty value:')
    }
  }, [value])

  React.useLayoutEffect(() => {
    const textarea = internalTextareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      const newHeight = Math.min(textarea.scrollHeight, 200)
      textarea.style.height = `${newHeight}px`
    }
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    console.log('[INPUT-CHANGE] New value:', e.target.value)
    setValue(e.target.value)
    if (props.onChange) props.onChange(e)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim() && onSubmit) {
      console.log("[v0] Submitting message:", value.trim(), "botId:", selectedModel, "file:", uploadedFile?.name)
      onSubmit(value.trim(), selectedModel || undefined, uploadedFile || undefined)
      setValue("")
      setImagePreview(null)
      setUploadedFile(null)
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

  const handlePlusClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault() // Prevent form submission
    e.stopPropagation() // Stop event bubbling
    console.log('[PLUS-CLICK] File picker button clicked, current value:', value)
    setIsUploadTooltipOpen(false) // Close tooltip when clicking
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[FILE-CHANGE] Event triggered, current value state:', value)
    const file = event.target.files?.[0]
    if (file) {
      console.log('[FILE-CHANGE] File selected:', file.name, 'type:', file.type)
      setUploadedFile(file)
      setIsUploadTooltipOpen(false) // Close tooltip after file is selected

      // Only show preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result as string)
          console.log('[FILE-CHANGE] Image preview set')
        }
        reader.readAsDataURL(file)
      } else {
        // For non-image files, clear the image preview
        setImagePreview(null)
        console.log('[FILE-CHANGE] Non-image file, cleared image preview')
      }
    }
    event.target.value = ""
    console.log('[FILE-CHANGE] Completed, value state should still be:', value)
  }

  const handleRemoveFile = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setImagePreview(null)
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleModelSelect = (botId: string) => {
    setSelectedModel(botId)
    setIsPopoverOpen(false)
    if (onBotSelect) {
      onBotSelect(botId)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      })

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        await transcribeAudio(audioBlob)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)

      // Start duration counter
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)

      console.log('[VOICE] Recording started')
    } catch (error) {
      console.error('[VOICE] Error starting recording:', error)
      alert('Unable to access microphone. Please check your permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }

      console.log('[VOICE] Recording stopped')
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true)

    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')

      console.log('[VOICE] Sending audio for transcription...')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Transcription failed')
      }

      const transcription = result.transcription.trim()
      console.log('[VOICE] Transcription received:', transcription)

      // Insert transcription into textarea
      setValue(transcription)

      // Focus textarea so user can edit
      if (internalTextareaRef.current) {
        internalTextareaRef.current.focus()
      }
    } catch (error) {
      console.error('[VOICE] Transcription error:', error)
      alert('Failed to transcribe audio. Please try again.')
    } finally {
      setIsTranscribing(false)
      setRecordingDuration(0)
    }
  }

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [isRecording])

  const hasValue = value.trim().length > 0 || uploadedFile !== null
  const canSend = hasValue && selectedModel !== null && !isSubmitting
  const activeModel = selectedModel ? mentorBots.find((m) => m.id === selectedModel) : null
  const ActiveModelIcon = activeModel?.icon

  return (
    <form onSubmit={handleSubmit}>
      <div
        data-slot="mentor-prompt-box"
        className={cn(
          "flex flex-col rounded-[28px] p-2 shadow-lg transition-all duration-200",
          "bg-card border border-border cursor-text",
          "hover:shadow-xl focus-within:ring-2 focus-within:ring-ring/20",
          className,
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.md"
          aria-label="Upload file"
        />

        {uploadedFile && (
          imagePreview ? (
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
                  onClick={handleRemoveFile}
                  className="absolute right-2 top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Remove file"
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
          ) : (
            <div className="relative mb-1 w-fit rounded-[1rem] px-1 pt-1">
              <div className="flex items-center gap-2 rounded-[1rem] bg-accent/50 px-3 py-2">
                <File className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-foreground max-w-[200px] truncate">
                  {uploadedFile.name}
                </span>
              </div>
              <button
                onClick={handleRemoveFile}
                className="absolute right-2 top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Remove file"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        )}

        <textarea
          ref={internalTextareaRef}
          rows={1}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask your agent anything..."
          className={cn(
            "custom-scrollbar w-full resize-none border-0 bg-transparent p-3",
            "text-foreground placeholder:text-muted-foreground",
            "focus:ring-0 focus-visible:outline-none",
            "min-h-12 text-base leading-relaxed",
          )}
          aria-label="Message input"
          {...props}
        />

        <div className="mt-0.5 p-1 pt-0">
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-2">
              {/* Upload File Button */}
              <Tooltip open={isUploadTooltipOpen} onOpenChange={setIsUploadTooltipOpen}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handlePlusClick}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Upload file"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Upload file</p>
                </TooltipContent>
              </Tooltip>

              {/* Models Selection - Only show if not read-only */}
              {!isReadOnly && (
                <>
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex h-8 items-center gap-2 rounded-full px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Choose agent"
                          >
                            <Settings2 className="h-4 w-4" />
                            {!selectedModel && "Models"}
                          </button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Choose Agent</p>
                      </TooltipContent>
                    </Tooltip>
                    <PopoverContent side="top" align="start" className="w-64 p-2">
                      <div className="flex flex-col gap-1">
                        {isLoadingBots ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            Loading agents...
                          </div>
                        ) : mentorBots.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No agents available
                          </div>
                        ) : (
                          mentorBots.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => handleModelSelect(model.id)}
                              className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Select ${model.name}`}
                            >
                              {model.icon && <model.icon className="h-4 w-4" />}
                              <span>{model.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Active Model Display - Always show, no removal option */}
                  {activeModel && (
                    <>
                      <div className="h-4 w-px bg-border" />
                      <div
                        className="flex h-8 items-center gap-2 rounded-full px-3 text-sm bg-primary/10 text-primary"
                        aria-label={`Selected agent: ${activeModel.name}`}
                      >
                        {ActiveModelIcon && <ActiveModelIcon className="h-4 w-4" />}
                        <span className="font-medium">{activeModel.name}</span>
                      </div>
                    </>
                  )}

                  {/* Show message when no bot selected */}
                  {!activeModel && !isLoadingBots && (
                    <>
                      <div className="h-4 w-px bg-border" />
                      <div className="flex h-8 items-center gap-2 rounded-full px-3 text-sm bg-destructive/10 text-destructive">
                        <span className="text-xs font-medium">Select an agent to continue</span>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Right side controls */}
              <div className="ml-auto flex items-center gap-2">
                {/* Voice Recording Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleMicClick}
                      disabled={isTranscribing}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isRecording
                          ? "bg-red-500 text-white animate-pulse"
                          : isTranscribing
                          ? "text-muted-foreground cursor-not-allowed"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      aria-label={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Record voice message"}
                    >
                      {isTranscribing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>
                      {isTranscribing
                        ? "Transcribing..."
                        : isRecording
                        ? `Recording... (${recordingDuration}s)`
                        : "Record voice"}
                    </p>
                  </TooltipContent>
                </Tooltip>

                {/* Send Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="submit"
                      disabled={!canSend}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "disabled:pointer-events-none",
                        "bg-primary text-primary-foreground hover:bg-primary/90",
                        "disabled:bg-muted disabled:text-muted-foreground",
                      )}
                      aria-label="Send message"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{isSubmitting ? "Sending..." : !selectedModel ? "Select an agent first" : "Send"}</p>
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
