"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Paperclip, ChevronDown, Send, X, Brain, BarChart3, Heart, Target, Mic, File, Loader2, StopCircle } from "lucide-react"

interface MentorBot {
  id: string
  name: string
  description: string | null
  icon?: any
}

interface UploadedFile {
  id: string
  file: File
  status: 'uploading' | 'success' | 'error'
  fileId?: string
  base64?: string
  errorMessage?: string
  preview?: string
}

interface MentorPromptBoxProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onSubmit'> {
  onSubmit?: (message: string, botId?: string, files?: UploadedFile[]) => void
  selectedBotId?: string
  onBotSelect?: (botId: string | null) => void
  isReadOnly?: boolean
  isSubmitting?: boolean
  isStreaming?: boolean
  onCancelStreaming?: () => void
  allBots: Array<{ id: string; display_name: string; description: string | null; avatar_url: string }>
}

export function MentorPromptBox({ className, onSubmit, selectedBotId, onBotSelect, isReadOnly = false, isSubmitting = false, isStreaming = false, onCancelStreaming, allBots, ...props }: MentorPromptBoxProps) {
  const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])
  const [value, setValue] = React.useState("")
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([])
  const [selectedModel, setSelectedModel] = React.useState<string | null>(selectedBotId || null)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const [isImageDialogOpen, setIsImageDialogOpen] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [isTranscribing, setIsTranscribing] = React.useState(false)
  const [recordingDuration, setRecordingDuration] = React.useState(0)
  const [isUploadTooltipOpen, setIsUploadTooltipOpen] = React.useState(false)
  const recordingIntervalRef = React.useRef<NodeJS.Timeout | null>(null)

  // Add icons to bots and normalize display_name to name for compatibility
  const mentorBots = React.useMemo(() => {
    return allBots.map((bot: any, index: number) => ({
      id: bot.id,
      name: bot.display_name || bot.name,
      description: bot.description,
      icon: [Brain, BarChart3, Heart, Target][index % 4],
    }))
  }, [allBots])

  // Auto-select first bot when bots are loaded (only if no bot is selected)
  // Track if we've already auto-selected to prevent loops
  const hasAutoSelectedRef = React.useRef(false)

  React.useEffect(() => {
    if (mentorBots.length > 0 && !selectedModel && !selectedBotId && !hasAutoSelectedRef.current) {
      const firstBotId = mentorBots[0].id
      setSelectedModel(firstBotId)
      hasAutoSelectedRef.current = true
      if (onBotSelect) {
        onBotSelect(firstBotId)
      }
    }
  }, [mentorBots.length, selectedModel, selectedBotId, onBotSelect])

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
    console.log('[MESSAGE-SUBMIT] Submit triggered, current files:', uploadedFiles.map(f => ({ id: f.id, name: f.file.name, status: f.status })))

    // Only allow submission if all files are successfully uploaded
    const hasFailedFiles = uploadedFiles.some(f => f.status === 'error' || f.status === 'uploading')
    if (hasFailedFiles) {
      console.log('[MESSAGE-SUBMIT] Submission blocked: files still uploading or failed')
      return
    }

    // Allow submission if there's text OR at least one successful file
    const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
    console.log('[MESSAGE-SUBMIT] Successful files:', successfulFiles.length, 'Message:', value.trim() ? 'present' : 'empty')

    if ((value.trim() || successfulFiles.length > 0) && onSubmit) {
      console.log('[MESSAGE-SUBMIT] Calling onSubmit with:', {
        message: value.trim(),
        botId: selectedModel,
        filesCount: successfulFiles.length,
        files: successfulFiles.map(f => ({ id: f.id, name: f.file.name, hasBase64: !!f.base64, hasFileId: !!f.fileId }))
      })
      onSubmit(value.trim(), selectedModel || undefined, successfulFiles.length > 0 ? successfulFiles : undefined)
      setValue("")
      setUploadedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } else {
      console.log('[MESSAGE-SUBMIT] Submission blocked: no content or onSubmit missing')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const handlePlusClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault() // Prevent form submission
    e.stopPropagation() // Stop event bubbling
    setIsUploadTooltipOpen(false) // Close tooltip when clicking
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    console.log('[FILE-UPLOAD] File selected:', file ? { name: file.name, size: file.size, type: file.type } : 'none')

    if (!file) return

    // File size limits
    const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32MB for documents
    const MAX_IMAGE_SIZE = 100 * 1024 * 1024 // 100MB for images
    const MAX_FILES = 5

    // Check file count
    if (uploadedFiles.length >= MAX_FILES) {
      console.log('[FILE-UPLOAD] Max file count reached:', uploadedFiles.length)
      alert(`Maximum ${MAX_FILES} files per message`)
      event.target.value = ""
      return
    }

    // Check individual file size
    const isImage = file.type.startsWith('image/')
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE
    console.log('[FILE-UPLOAD] File type check:', { isImage, maxSize: `${Math.round(maxSize / 1024 / 1024)}MB`, fileSize: `${Math.round(file.size / 1024 / 1024)}MB` })

    if (file.size > maxSize) {
      console.log('[FILE-UPLOAD] File too large, rejecting')
      const fileId = `file-${Date.now()}`
      setUploadedFiles(prev => [...prev, {
        id: fileId,
        file,
        status: 'error',
        errorMessage: `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`,
      }])
      event.target.value = ""
      return
    }

    // Check total size
    const totalSize = uploadedFiles.reduce((sum, f) => sum + f.file.size, 0)
    console.log('[FILE-UPLOAD] Total size check:', { totalSize: `${Math.round(totalSize / 1024 / 1024)}MB`, newTotal: `${Math.round((totalSize + file.size) / 1024 / 1024)}MB` })

    if (totalSize + file.size > MAX_IMAGE_SIZE) {
      console.log('[FILE-UPLOAD] Total size exceeded, rejecting')
      alert('Total attachments exceed 100MB')
      event.target.value = ""
      return
    }

    setIsUploadTooltipOpen(false)

    // Create file entry with uploading status
    const fileId = `file-${Date.now()}`
    console.log('[FILE-UPLOAD] Creating file entry with ID:', fileId)

    const newFile: UploadedFile = {
      id: fileId,
      file,
      status: 'uploading',
    }

    setUploadedFiles(prev => {
      console.log('[FILE-UPLOAD] Adding file to state, current count:', prev.length)
      return [...prev, newFile]
    })

    // Upload file in background
    try {
      if (isImage) {
        console.log('[FILE-UPLOAD] Processing image, converting to base64...')
        // For images: convert to base64
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string
            const base64Data = result.split(',')[1]
            console.log('[FILE-UPLOAD] Base64 conversion complete, length:', base64Data.length)
            resolve(base64Data)
          }
          reader.onerror = (err) => {
            console.error('[FILE-UPLOAD] Base64 conversion failed:', err)
            reject(err)
          }
          reader.readAsDataURL(file)
        })

        // Create preview
        console.log('[FILE-UPLOAD] Creating image preview...')
        const previewReader = new FileReader()
        const preview = await new Promise<string>((resolve, reject) => {
          previewReader.onload = () => {
            console.log('[FILE-UPLOAD] Preview created')
            resolve(previewReader.result as string)
          }
          previewReader.onerror = (err) => {
            console.error('[FILE-UPLOAD] Preview creation failed:', err)
            reject(err)
          }
          previewReader.readAsDataURL(file)
        })

        // Update with success
        console.log('[FILE-UPLOAD] Updating image file status to success')
        setUploadedFiles(prev => prev.map(f =>
          f.id === fileId
            ? { ...f, status: 'success' as const, base64, preview }
            : f
        ))
        console.log('[FILE-UPLOAD] Image upload complete')
      } else {
        console.log('[FILE-UPLOAD] Processing document, uploading to Anthropic...')
        // For documents: upload to Anthropic Files API
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        })

        console.log('[FILE-UPLOAD] Upload response status:', response.status)
        const result = await response.json()
        console.log('[FILE-UPLOAD] Upload result:', result)

        if (!result.success) {
          throw new Error(result.error || 'Failed to upload file')
        }

        // Update with success
        console.log('[FILE-UPLOAD] Updating document file status to success, fileId:', result.file_id)
        setUploadedFiles(prev => prev.map(f =>
          f.id === fileId
            ? { ...f, status: 'success' as const, fileId: result.file_id }
            : f
        ))
        console.log('[FILE-UPLOAD] Document upload complete')
      }
    } catch (error) {
      console.error('[FILE-UPLOAD] Upload failed:', error)
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileId
          ? {
              ...f,
              status: 'error' as const,
              errorMessage: error instanceof Error ? error.message : 'Upload failed'
            }
          : f
      ))
    }

    event.target.value = ""
  }

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
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
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true)

    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Transcription failed')
      }

      const transcription = result.transcription.trim()

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

  const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
  const hasFailedOrUploadingFiles = uploadedFiles.some(f => f.status === 'error' || f.status === 'uploading')
  const hasValue = value.trim().length > 0 || successfulFiles.length > 0
  const canSend = hasValue && selectedModel !== null && !isSubmitting && !hasFailedOrUploadingFiles
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

        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1 px-1 pt-1">
            {uploadedFiles.map((uploadedFile) => (
              <div
                key={uploadedFile.id}
                className={cn(
                  "relative rounded-[1rem] overflow-hidden",
                  uploadedFile.status === 'error' && "ring-2 ring-destructive"
                )}
              >
                {uploadedFile.preview ? (
                  <Dialog>
                    <div className="relative">
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[1rem]"
                          aria-label="View full size image"
                        >
                          <img
                            src={uploadedFile.preview}
                            alt="Image preview"
                            className="h-16 w-16 rounded-[1rem] object-cover"
                          />
                        </button>
                      </DialogTrigger>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(uploadedFile.id)}
                        className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Remove file"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {uploadedFile.status === 'uploading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-[1rem]">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none">
                      <img
                        src={uploadedFile.preview}
                        alt="Full size preview"
                        className="w-full max-h-[95vh] object-contain rounded-[24px]"
                      />
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <div className={cn(
                          "flex items-center gap-2 rounded-[1rem] px-3 py-2 min-w-[120px]",
                          uploadedFile.status === 'success' && "bg-accent/50",
                          uploadedFile.status === 'error' && "bg-destructive/10",
                          uploadedFile.status === 'uploading' && "bg-muted/50"
                        )}>
                          {uploadedFile.status === 'uploading' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : uploadedFile.status === 'error' ? (
                            <X className="h-4 w-4 text-destructive" />
                          ) : (
                            <File className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={cn(
                            "text-sm max-w-[120px] truncate",
                            uploadedFile.status === 'error' && "text-destructive"
                          )}>
                            {uploadedFile.file.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(uploadedFile.id)}
                          className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label="Remove file"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </TooltipTrigger>
                    {uploadedFile.errorMessage && (
                      <TooltipContent side="top" className="bg-destructive text-destructive-foreground">
                        <p>{uploadedFile.errorMessage}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                )}
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={internalTextareaRef}
          rows={1}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          className={cn(
            "w-full resize-none border-0 bg-transparent p-3",
            "text-foreground placeholder:text-muted-foreground",
            "focus:ring-0 focus-visible:outline-none",
            "min-h-12 text-base leading-relaxed",
            "custom-chat-scrollbar",
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
                    <Paperclip className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Upload file</p>
                </TooltipContent>
              </Tooltip>

              {/* Agent Selection Dropdown - Only show if not read-only */}
              {!isReadOnly && (
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Choose agent"
                    >
                      <span className="text-muted-foreground">
                        {activeModel?.name || "Select agent"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-64 p-2">
                    <div className="flex flex-col gap-1">
                      {mentorBots.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Loading agents...
                        </div>
                      ) : (
                        mentorBots.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => handleModelSelect(model.id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              model.id === selectedModel
                                ? "bg-accent text-foreground"
                                : "text-foreground hover:bg-accent"
                            )}
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

                {/* Send/Stop Button */}
                {isStreaming ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onCancelStreaming}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                        )}
                        aria-label="Stop generating"
                      >
                        <StopCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Stop generating</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="submit"
                        disabled={!canSend}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          "disabled:pointer-events-none",
                          canSend
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                            : "bg-foreground/20 text-foreground/40",
                        )}
                        aria-label="Send message"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{isSubmitting ? "Sending..." : !selectedModel ? "Select an agent first" : "Send"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </form>
  )
}
