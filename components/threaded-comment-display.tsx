'use client'

import { useState } from 'react'
import { Drawing } from '@/lib/canvas-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, MessageSquare, Reply, X } from 'lucide-react'

// Simple date formatting helper
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  } catch (error) {
    return ''
  }
}

interface ThreadedCommentDisplayProps {
  comment: Drawing
  onReply: (parentId: string, content: string) => void
  onResolve: (commentId: string) => void
  currentUserId?: string
  currentUserName?: string
  getReplyCount?: (commentId: string) => number
  level?: number // For nesting depth
}

export default function ThreadedCommentDisplay({
  comment,
  onReply,
  onResolve,
  currentUserId,
  currentUserName,
  getReplyCount,
  level = 0
}: ThreadedCommentDisplayProps) {
  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [showReplies, setShowReplies] = useState(true)

  const noteTypeColors = {
    requirement: 'bg-green-100 text-green-800 border-green-200',
    concern: 'bg-red-100 text-red-800 border-red-200',
    suggestion: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    other: 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const replyCount = getReplyCount?.(comment.id) || 0

  const handleReply = () => {
    if (!replyText.trim()) {
      return
    }
    
    onReply(comment.id, replyText)
    setReplyText('')
    setIsReplying(false)
  }

  const handleResolve = () => {
    if (confirm('Mark this comment as resolved?')) {
      onResolve(comment.id)
    }
  }

  const canResolve = !comment.isResolved

  return (
    <div className={`${level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-3' : ''}`}>
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-all">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Badge 
              variant="outline" 
              className={`text-xs capitalize ${noteTypeColors[comment.noteType || 'other']}`}
            >
              {comment.noteType || 'comment'}
            </Badge>
            {comment.isResolved && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Resolved
              </Badge>
            )}
          </div>
          <div className="flex items-center text-xs text-gray-500">
            {comment.userName && (
              <span>by {comment.userName.split('@')[0]}</span>
            )}
            {comment.createdAt && (
              <span className="ml-2">{formatDate(comment.createdAt)}</span>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-800 mb-3">{comment.notes}</p>

        {(comment.category || comment.location) && (
          <div className="flex flex-wrap gap-2 mb-3">
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

        {/* Comment metadata */}
        {comment.isResolved && comment.resolvedByUsername && (
          <div className="text-xs text-green-600 mb-3">
            Resolved by {comment.resolvedByUsername} 
            {comment.resolvedAt && ` ${formatDate(comment.resolvedAt)}`}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsReplying(!isReplying)}
            className="text-xs"
          >
            <Reply className="h-3 w-3 mr-1" />
            Reply {replyCount > 0 && `(${replyCount})`}
          </Button>
          
          {canResolve && (
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

          {comment.replies && comment.replies.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplies(!showReplies)}
              className="text-xs ml-auto"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              {showReplies ? 'Hide' : 'Show'} {comment.replies.length} {comment.replies.length === 1 ? 'Reply' : 'Replies'}
            </Button>
          )}
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
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

        {/* Replies */}
        {showReplies && comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-3">
            {comment.replies.map((reply) => (
              <ThreadedCommentDisplay
                key={reply.id}
                comment={reply}
                onReply={onReply}
                onResolve={onResolve}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                getReplyCount={getReplyCount}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
