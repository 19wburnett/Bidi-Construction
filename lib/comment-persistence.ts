import { createClient } from '@/lib/supabase'
import { Drawing } from '@/lib/canvas-utils'

export interface PlanComment {
  id: string
  plan_id: string
  user_id?: string
  guest_user_id?: string
  page_number: number
  position_x: number
  position_y: number
  content: string
  comment_type: 'requirement' | 'concern' | 'suggestion' | 'other'
  category?: string
  location?: string
  parent_comment_id?: string
  is_resolved: boolean
  resolved_at?: string
  resolved_by?: string
  resolved_by_username?: string
  author_name: string
  author_email?: string
  created_at: string
  updated_at: string
}

export class CommentPersistence {
  private supabase = createClient()
  private planId: string
  private userId?: string
  private guestUser?: { id: string; name: string }

  constructor(planId: string, userId?: string, guestUser?: { id: string; name: string }) {
    this.planId = planId
    this.userId = userId
    this.guestUser = guestUser
    console.log('CommentPersistence initialized:', { planId, userId, guestUser })
  }

  async loadComments(): Promise<Drawing[]> {
    try {
      console.log('Loading comments for plan:', this.planId)
      const { data, error } = await this.supabase
        .from('plan_comments')
        .select('*')
        .eq('plan_id', this.planId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading comments from database:', error)
        return []
      }

      if (!data || data.length === 0) {
        console.log('No comments found for plan:', this.planId)
        return []
      }

      console.log(`Found ${data.length} comments for plan ${this.planId}`)
      // Convert database comments to Drawing format
      return data.map(comment => this.commentToDrawing(comment))
    } catch (error) {
      console.error('Exception loading comments:', error)
      return []
    }
  }

  async saveComment(comment: Drawing): Promise<void> {
    try {
      const record = this.drawingToComment(comment)
      
      const { error } = await this.supabase
        .from('plan_comments')
        .insert(record)

      if (error) {
        console.error('Error saving comment:', error)
        throw error
      }
    } catch (error) {
      console.error('Error saving comment:', error)
      throw error
    }
  }

  async updateComment(commentId: string, updates: Partial<Drawing>): Promise<void> {
    try {
      const updateData: any = {}
      
      if (updates.isResolved !== undefined) {
        updateData.is_resolved = updates.isResolved
      }
      if (updates.resolvedAt) {
        updateData.resolved_at = updates.resolvedAt
      }
      if (updates.resolvedBy) {
        updateData.resolved_by = updates.resolvedBy
      }
      if (updates.resolvedByUsername) {
        updateData.resolved_by_username = updates.resolvedByUsername
      }

      const { error } = await this.supabase
        .from('plan_comments')
        .update(updateData)
        .eq('id', commentId)

      if (error) {
        console.error('Error updating comment:', error)
        throw error
      }
    } catch (error) {
      console.error('Error updating comment:', error)
      throw error
    }
  }

  private drawingToComment(drawing: Drawing): any {
    const isGuest = !this.userId && this.guestUser
    
    return {
      plan_id: this.planId,
      user_id: this.userId || null,
      guest_user_id: this.guestUser?.id || null,
      page_number: drawing.pageNumber,
      position_x: drawing.geometry.x,
      position_y: drawing.geometry.y,
      content: drawing.notes || '',
      comment_type: drawing.noteType || 'other',
      category: drawing.category || null,
      location: drawing.location || null,
      parent_comment_id: drawing.parentCommentId || null,
      is_resolved: drawing.isResolved || false,
      resolved_at: drawing.resolvedAt || null,
      resolved_by: drawing.resolvedBy || null,
      resolved_by_username: drawing.resolvedByUsername || null,
      author_name: drawing.userName || (isGuest ? this.guestUser!.name : 'Unknown'),
      author_email: drawing.userName || null
    }
  }

  private commentToDrawing(comment: PlanComment): Drawing {
    return {
      id: comment.id,
      type: 'comment',
      geometry: {
        x: comment.position_x,
        y: comment.position_y
      },
      style: {
        color: '#3b82f6',
        strokeWidth: 2,
        opacity: 1
      },
      pageNumber: comment.page_number,
      notes: comment.content,
      noteType: comment.comment_type as any,
      category: comment.category,
      location: comment.location,
      isVisible: true,
      isLocked: false,
      userId: comment.user_id,
      userName: comment.author_name,
      createdAt: comment.created_at,
      parentCommentId: comment.parent_comment_id,
      isResolved: comment.is_resolved,
      resolvedAt: comment.resolved_at || undefined,
      resolvedBy: comment.resolved_by || undefined,
      resolvedByUsername: comment.resolved_by_username || undefined
    }
  }
}

