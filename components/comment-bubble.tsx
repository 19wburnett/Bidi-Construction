'use client'

import { CheckCircle, AlertCircle, Lightbulb, MessageSquare } from 'lucide-react'
import { Drawing } from '@/lib/canvas-utils'

interface CommentBubbleProps {
  comment: Drawing
  isSelected?: boolean
  isHovered?: boolean
  scale?: number
  onClick: (e: React.MouseEvent) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export default function CommentBubble({
  comment,
  isSelected = false,
  isHovered = false,
  scale = 1.5,
  onClick,
  onMouseEnter,
  onMouseLeave
}: CommentBubbleProps) {
  // Get icon for comment type
  const getIcon = (noteType?: string) => {
    const iconMap: Record<string, typeof MessageSquare> = {
      requirement: CheckCircle,
      concern: AlertCircle,
      suggestion: Lightbulb,
      other: MessageSquare
    }
    return iconMap[noteType || 'other'] || MessageSquare
  }

  const Icon = getIcon(comment.noteType)
  const bubbleColor = comment.style?.color || '#3b82f6'
  const bubbleSize = 24 // Base size in world coordinates (will scale with transform)

  // Get world coordinates - scale them from PDF base space to canvas space
  // Coordinates are stored in PDF base space (normalized by scale)
  const worldX = (comment.geometry?.x ?? 0) * scale
  const worldY = (comment.geometry?.y ?? 0) * scale

  return (
    <div
      className="absolute cursor-pointer transition-all"
      style={{
        left: `${worldX}px`,
        top: `${worldY}px`,
        transform: 'translate(-50%, -50%)', // Center the bubble on the coordinates
        zIndex: isSelected ? 15 : 12,
        pointerEvents: 'auto'
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Selection highlight ring */}
      {isSelected && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            transform: 'translate(-50%, -50%)',
            width: `${bubbleSize + 6}px`,
            height: `${bubbleSize + 6}px`,
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            left: '50%',
            top: '50%'
          }}
        />
      )}

      {/* Comment bubble */}
      <div
        className="relative rounded-full flex items-center justify-center shadow-md"
        style={{
          width: `${bubbleSize}px`,
          height: `${bubbleSize}px`,
          backgroundColor: bubbleColor,
          border: '2px solid white',
          boxShadow: isHovered ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.2)',
          transition: 'box-shadow 0.2s ease'
        }}
      >
        {/* Icon */}
        <Icon
          className="text-white"
          style={{
            width: `${bubbleSize * 0.5}px`,
            height: `${bubbleSize * 0.5}px`,
            strokeWidth: 2.5
          }}
        />
      </div>
    </div>
  )
}

