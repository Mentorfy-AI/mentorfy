'use client'

import { useState } from 'react'

function getVideoId(url: string | undefined) {
  if (!url) return null

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/)
  if (ytMatch) return { provider: 'youtube', id: ytMatch[1] }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return { provider: 'vimeo', id: vimeoMatch[1] }

  // Wistia
  const wistiaMatch = url.match(/wistia\.com\/medias\/([^?/]+)/)
  if (wistiaMatch) return { provider: 'wistia', id: wistiaMatch[1] }

  return null
}

function getThumbnail(provider: string, id: string) {
  switch (provider) {
    case 'youtube':
      return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
    case 'wistia':
      return `https://fast.wistia.com/embed/medias/${id}/swatch`
    case 'vimeo':
      return null // Vimeo requires API call for thumbnail
    default:
      return null
  }
}

function getEmbedUrl(provider: string, id: string) {
  switch (provider) {
    case 'youtube':
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
    case 'vimeo':
      return `https://player.vimeo.com/video/${id}?autoplay=1`
    case 'wistia':
      return `https://fast.wistia.net/embed/iframe/${id}?autoplay=1`
    default:
      return null
  }
}

interface Props {
  url?: string
  aspectRatio?: string
  maxWidth?: string
}

export function VideoEmbed({ url, aspectRatio = "16:9", maxWidth = "560px" }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [thumbnailError, setThumbnailError] = useState(false)

  const video = getVideoId(url)
  if (!video) {
    return (
      <div
        className="relative rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center"
        style={{ aspectRatio: aspectRatio.replace(':', '/'), maxWidth }}
      >
        <span className="text-gray-400 text-sm">Video unavailable</span>
      </div>
    )
  }

  const thumbnail = getThumbnail(video.provider, video.id)
  const embedUrl = getEmbedUrl(video.provider, video.id)

  const aspectStyle = {
    aspectRatio: aspectRatio.replace(':', '/')
  }

  if (isPlaying) {
    return (
      <div
        className="relative rounded-xl overflow-hidden shadow-md w-full"
        style={{ ...aspectStyle, maxWidth }}
      >
        <iframe
          src={embedUrl || undefined}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Video"
        />
      </div>
    )
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden shadow-md cursor-pointer group w-full"
      style={{ ...aspectStyle, maxWidth }}
      onClick={() => setIsPlaying(true)}
    >
      {/* Thumbnail */}
      {thumbnail && !thumbnailError ? (
        <img
          src={thumbnail}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
          onError={() => setThumbnailError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
      )}

      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <svg
            className="w-6 h-6 md:w-8 md:h-8 text-black ml-1"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {/* Subtle gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  )
}
