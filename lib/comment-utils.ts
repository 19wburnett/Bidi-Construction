import { Drawing } from './canvas-utils'

/**
 * Organize comments into a threaded structure
 */
export function organizeCommentsIntoThreads(comments: Drawing[]): Drawing[] {
  // Create a map of all comments by ID
  const commentMap = new Map<string, Drawing>()
  
  // Initialize comments
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] })
  })
  
  // Build thread structure
  const topLevelComments: Drawing[] = []
  
  commentMap.forEach((comment, id) => {
    if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
      // This is a reply, add it to the parent's replies array
      const parent = commentMap.get(comment.parentCommentId)
      if (parent) {
        if (!parent.replies) {
          parent.replies = []
        }
        parent.replies.push(comment)
      }
    } else {
      // This is a top-level comment
      topLevelComments.push(comment)
    }
  })
  
  // Sort top-level comments by creation date (newest first)
  return topLevelComments.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0
    if (!a.createdAt) return 1
    if (!b.createdAt) return -1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

/**
 * Get comment count including replies
 */
export function getCommentCount(comment: Drawing): number {
  let count = 1
  if (comment.replies && comment.replies.length > 0) {
    count += comment.replies.reduce((sum, reply) => sum + getCommentCount(reply), 0)
  }
  return count
}

/**
 * Get reply count for a comment
 */
export function getReplyCount(comment: Drawing): number {
  if (!comment.replies) return 0
  return comment.replies.reduce((count, reply) => count + 1 + getReplyCount(reply), 0)
}

/**
 * Filter comments by page
 */
export function filterCommentsByPage(comments: Drawing[], pageNumber: number): Drawing[] {
  return comments.filter(comment => comment.pageNumber === pageNumber)
}

/**
 * Filter resolved/unresolved comments
 */
export function filterResolvedComments(comments: Drawing[], showResolved: boolean): Drawing[] {
  if (showResolved) {
    return comments
  }
  
  // Helper to recursively filter out resolved comments
  function filterRecursive(comment: Drawing): Drawing | null {
    const filteredReplies = comment.replies
      ? comment.replies.map(filterRecursive).filter((c): c is Drawing => c !== null)
      : []
    
    if (comment.isResolved) {
      // If resolved, return null unless it has non-resolved replies
      if (filteredReplies.length > 0) {
        return { ...comment, replies: filteredReplies }
      }
      return null
    }
    
    return { ...comment, replies: filteredReplies }
  }
  
  return comments.map(filterRecursive).filter((c): c is Drawing => c !== null)
}
