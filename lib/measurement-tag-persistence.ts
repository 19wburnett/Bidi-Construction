import { createClient } from '@/lib/supabase'

export interface MeasurementTag {
  id: string
  planId: string
  userId?: string
  guestUserId?: string
  name: string
  color: string
  createdAt?: string
  updatedAt?: string
}

type PlanMeasurementTagRow = {
  id: string
  plan_id: string
  user_id?: string | null
  guest_user_id?: string | null
  name: string
  color: string
  created_at?: string
  updated_at?: string
}

export class MeasurementTagPersistence {
  private supabase = createClient()
  private planId: string
  private userId?: string
  private guestUser?: { id: string; name: string }

  constructor(planId: string, userId?: string, guestUser?: { id: string; name: string }) {
    this.planId = planId
    this.userId = userId
    this.guestUser = guestUser
  }

  private rowToTag(row: PlanMeasurementTagRow): MeasurementTag {
    return {
      id: row.id,
      planId: row.plan_id,
      userId: row.user_id || undefined,
      guestUserId: row.guest_user_id || undefined,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  async loadTags(): Promise<MeasurementTag[]> {
    try {
      const query = this.supabase
        .from('plan_measurement_tags')
        .select('*')
        .eq('plan_id', this.planId)
        .order('name', { ascending: true })

      const { data, error } = await query
      if (error) {
        console.error('Error loading measurement tags from database:', error)
        return []
      }

      return (data as PlanMeasurementTagRow[]).map(row => this.rowToTag(row))
    } catch (error) {
      console.error('Exception loading measurement tags:', error)
      return []
    }
  }

  async createTag(name: string, color: string): Promise<MeasurementTag | null> {
    try {
      if (!this.userId && !this.guestUser?.id) {
        console.warn('Measurement tag creation skipped: no user or guest context available')
        return null
      }

      const payload: any = {
        plan_id: this.planId,
        name,
        color
      }

      if (this.userId) {
        payload.user_id = this.userId
        payload.guest_user_id = null
      } else if (this.guestUser?.id) {
        payload.user_id = null
        payload.guest_user_id = this.guestUser.id
      }

      const { data, error } = await this.supabase
        .from('plan_measurement_tags')
        .insert(payload)
        .select()
        .single()

      if (error) {
        console.error('Error creating measurement tag:', error)
        return null
      }

      return this.rowToTag(data as PlanMeasurementTagRow)
    } catch (error) {
      console.error('Exception creating measurement tag:', error)
      return null
    }
  }

  async updateTag(tagId: string, name: string, color: string): Promise<MeasurementTag | null> {
    try {
      const { data, error } = await this.supabase
        .from('plan_measurement_tags')
        .update({ name, color })
        .eq('id', tagId)
        .select()
        .single()

      if (error) {
        console.error('Error updating measurement tag:', error)
        return null
      }

      return this.rowToTag(data as PlanMeasurementTagRow)
    } catch (error) {
      console.error('Exception updating measurement tag:', error)
      return null
    }
  }

  async deleteTag(tagId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('plan_measurement_tags')
        .delete()
        .eq('id', tagId)

      if (error) {
        console.error('Error deleting measurement tag:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Exception deleting measurement tag:', error)
      return false
    }
  }
}