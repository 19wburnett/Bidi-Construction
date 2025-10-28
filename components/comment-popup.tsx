'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Drawing } from '@/lib/canvas-utils'

interface CommentPopupProps {
  comment: Drawing
  position: { x: number; y: number }
  onClose: () => void
}

export default function CommentPopup({ comment, position, onClose }: CommentPopupProps) {
  const noteTypeColors = {
    requirement: 'bg-green-100 text-green-800 border-green-200',
    concern: 'bg-red-100 text-red-800 border-red-200',
    suggestion: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    other: 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div
      className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[280px] max-w-[400px] z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(10px, 10px)' // Offset from click position
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <Badge 
          variant="outline" 
          className={`text-xs capitalize ${noteTypeColors[comment.noteType || 'other']}`}
        >
          {comment.noteType || 'Comment'}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 mb-3">
        <p className="text-sm text-gray-800">{comment.notes}</p>
        
        {(comment.category || comment.location) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {comment.category && (
              <Badge variant="secondary" className="text-xs">
                {comment.category}
              </Badge>
            )}
            {comment.location && (
              <Badge variant="secondary" className="text-xs">
                📍 {comment.location}
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 pt-2 border-t border-gray-100 flex items-center justify-between">
        <span>Page {comment.pageNumber}</span>
        {comment.userName && (
          <span className="text-gray-400">by {comment.userName.split('@')[0]}</span>
        )}
      </div>
    </div>
  )
}

