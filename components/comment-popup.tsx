'use client'

import { useState } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Drawing } from '@/lib/canvas-utils'

interface CommentPopupProps {
  comment: Drawing
  position: { x: number; y: number }
  onClose: () => void
  onResolve?: (commentId: string) => void
  onReply?: (parentId: string, content: string) => void
  currentUserId?: string
  currentUserName?: string
  replyCount?: number
}

export default function CommentPopup({ 
  comment, 
  position, 
  onClose,
  onResolve,
  onReply,
  currentUserId,
  currentUserName,
  replyCount
}: CommentPopupProps) {
  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  
  const noteTypeColors = {
    requirement: 'bg-green-100 text-green-800 border-green-200',
    concern: 'bg-red-100 text-red-800 border-red-200',
    suggestion: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    other: 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const handleReply = () => {
    if (!replyText.trim() || !onReply) {
      return
    }
    
    onReply(comment.id, replyText)
    setReplyText('')
    setIsReplying(false)
  }

  const handleResolve = () => {
    if (comment.isResolved || !onResolve) {
      return
    }
    
    if (confirm('Mark this comment as resolved?')) {
      onResolve(comment.id)
    }
  }

  return (
    <div
      className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[280px] max-w-[400px] z-[100] max-h-[600px] overflow-y-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(10px, 10px)', // Offset from click position
        pointerEvents: 'auto'
      }}
      onClick={(e) => {
        // Stop event propagation so clicks inside popup don't trigger canvas actions
        e.stopPropagation()
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={`text-xs capitalize ${noteTypeColors[comment.noteType || 'other']}`}
          >
            {comment.noteType || 'Comment'}
          </Badge>
          {comment.isResolved && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Resolved
            </Badge>
          )}
        </div>
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

      {/* Comment metadata */}
      {comment.isResolved && comment.resolvedByUsername && (
        <div className="text-xs text-green-600 mb-3 p-2 bg-green-50 rounded">
          ✓ Resolved by {comment.resolvedByUsername}
        </div>
      )}

      {/* Action buttons */}
      {(onResolve || onReply) && (
        <div className="flex gap-2 mb-3">
          {onReply && !comment.isResolved && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsReplying(!isReplying)}
              className="text-xs"
            >
              Reply {replyCount !== undefined && replyCount > 0 && `(${replyCount})`}
            </Button>
          )}
          
          {onResolve && !comment.isResolved && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResolve}
              className="text-xs"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Mark Resolved
            </Button>
          )}
        </div>
      )}

      {/* Reply form */}
      {isReplying && onReply && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <Textarea
            placeholder="Write a reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="mb-2"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsReplying(false)
                setReplyText('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleReply}
              disabled={!replyText.trim()}
            >
              Post Reply
            </Button>
          </div>
        </div>
      )}

      {/* Replies preview */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 border-t border-gray-200 pt-3">
          <p className="text-xs text-gray-600 mb-2">Replies ({comment.replies.length}):</p>
          <div className="space-y-2">
            {comment.replies.slice(0, 3).map((reply, idx) => (
              <div key={reply.id || idx} className="text-xs bg-gray-50 p-2 rounded">
                <div className="font-semibold">{reply.userName || 'Anonymous'}</div>
                <div className="text-gray-700">{reply.notes}</div>
              </div>
            ))}
            {comment.replies.length > 3 && (
              <p className="text-xs text-gray-500 italic">
                +{comment.replies.length - 3} more replies...
              </p>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 pt-2 border-t border-gray-100 flex items-center justify-between">
        <span>Page {comment.pageNumber}</span>
        {comment.userName && (
          <span className="text-gray-400">by {comment.userName.split('@')[0]}</span>
        )}
      </div>
    </div>
  )
}

