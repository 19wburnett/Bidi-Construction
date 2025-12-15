import { createClient } from '@/lib/supabase'
import { Drawing } from '@/lib/canvas-utils'

const ITEM_TYPE = 'item' as const

type PlanDrawingRow = {
  id: string
  plan_id: string
  user_id?: string | null
  guest_user_id?: string | null
  page_number: number
  drawing_type: string
  geometry: any
  style: any
  label?: string | null
  notes?: string | null
  layer_name?: string | null
  is_visible?: boolean | null
  is_locked?: boolean | null
  z_index?: number | null
  created_at?: string
  updated_at?: string
}

const normalizeJson = <T>(value: T | string | null | undefined): T | undefined => {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch (error) {
      console.warn('Failed to parse JSON value for item persistence:', error, value)
      return undefined
    }
  }
  return value as T
}

export class ItemPersistence {
  private supabase = createClient()
  private planId: string
  private userId?: string
  private guestUser?: { id: string; name: string }
  private persisted = new Map<string, Drawing>()

  constructor(planId: string, userId?: string, guestUser?: { id: string; name: string }) {
    this.planId = planId
    this.userId = userId
    this.guestUser = guestUser
  }

  private rowToDrawing(row: PlanDrawingRow): Drawing {
    const geometry = normalizeJson<{ x?: number; y?: number; itemType?: string; itemCategory?: string }>(row.geometry) || {}
    const style = normalizeJson<{ color?: string; strokeWidth?: number; opacity?: number }>(row.style) || {}

    // Extract item-specific data from geometry or use label/notes
    const itemType = geometry.itemType || undefined
    const itemCategory = geometry.itemCategory || undefined
    const itemLabel = row.label || undefined
    const itemNotes = row.notes || undefined

    return {
      id: row.id,
      type: 'item',
      geometry: {
        x: geometry.x !== undefined ? Number(geometry.x) : undefined,
        y: geometry.y !== undefined ? Number(geometry.y) : undefined
      },
      style: {
        color: style.color || '#3b82f6',
        strokeWidth: style.strokeWidth ?? 2,
        opacity: style.opacity ?? 1
      },
      pageNumber: row.page_number,
      itemType,
      itemLabel,
      itemNotes,
      itemCategory,
      layerName: row.layer_name || undefined,
      isVisible: row.is_visible ?? true,
      isLocked: row.is_locked ?? false,
      zIndex: row.z_index ?? 0,
      userId: row.user_id || undefined,
      createdAt: row.created_at
    }
  }

  private itemToInsertPayload(drawing: Drawing) {
    return {
      plan_id: this.planId,
      user_id: this.userId || null,
      guest_user_id: this.userId ? null : this.guestUser?.id || null,
      page_number: drawing.pageNumber,
      drawing_type: ITEM_TYPE,
      geometry: {
        x: drawing.geometry.x,
        y: drawing.geometry.y,
        itemType: drawing.itemType || null,
        itemCategory: drawing.itemCategory || null
      },
      style: {
        color: drawing.style?.color || '#3b82f6',
        strokeWidth: drawing.style?.strokeWidth ?? 2,
        opacity: drawing.style?.opacity ?? 1
      },
      label: drawing.itemLabel || null,
      notes: drawing.itemNotes || null,
      layer_name: drawing.layerName || 'items',
      is_visible: drawing.isVisible ?? true,
      is_locked: drawing.isLocked ?? false,
      z_index: drawing.zIndex ?? 0
    }
  }

  private itemToUpdatePayload(drawing: Drawing) {
    return {
      page_number: drawing.pageNumber,
      drawing_type: ITEM_TYPE,
      geometry: {
        x: drawing.geometry.x,
        y: drawing.geometry.y,
        itemType: drawing.itemType || null,
        itemCategory: drawing.itemCategory || null
      },
      style: {
        color: drawing.style?.color || '#3b82f6',
        strokeWidth: drawing.style?.strokeWidth ?? 2,
        opacity: drawing.style?.opacity ?? 1
      },
      label: drawing.itemLabel || null,
      notes: drawing.itemNotes || null,
      layer_name: drawing.layerName || 'items',
      is_visible: drawing.isVisible ?? true,
      is_locked: drawing.isLocked ?? false,
      z_index: drawing.zIndex ?? 0
    }
  }

  async loadItems(): Promise<Drawing[]> {
    try {
      const query = this.supabase
        .from('plan_drawings')
        .select('*')
        .eq('plan_id', this.planId)
        .eq('drawing_type', ITEM_TYPE)
        .order('created_at', { ascending: true })

      if (this.userId) {
        query.eq('user_id', this.userId)
      } else if (this.guestUser?.id) {
        query.eq('guest_user_id', this.guestUser.id)
      }

      const { data, error } = await query
      if (error) {
        console.error('Error loading items from database:', error)
        return []
      }

      const items = (data as PlanDrawingRow[]).map(row => this.rowToDrawing(row))
      this.persisted = new Map(items.map(item => [item.id, item]))
      return items
    } catch (error) {
      console.error('Exception loading items:', error)
      return []
    }
  }

  async syncItems(items: Drawing[]): Promise<Drawing[]> {
    if (!this.userId && !this.guestUser?.id) {
      console.warn('Item persistence skipped: no user or guest context available')
      return items
    }

    try {
      const normalizedResults: Drawing[] = []
      const incomingIds = new Set<string>()

      for (const item of items) {
        if (item.type !== 'item') continue

        const hasPersistedId = item.id && this.persisted.has(item.id)

        if (hasPersistedId && item.id) {
          const updatePayload = this.itemToUpdatePayload(item)
          const { error } = await this.supabase
            .from('plan_drawings')
            .update(updatePayload)
            .eq('id', item.id)

          if (error) {
            console.error('Error updating item:', error, item)
            continue
          }

          normalizedResults.push(item)
          incomingIds.add(item.id)
        } else {
          const insertPayload = this.itemToInsertPayload(item)
          const { data, error } = await this.supabase
            .from('plan_drawings')
            .insert(insertPayload)
            .select()
            .single()

          if (error) {
            console.error('Error saving item:', error, item)
            continue
          }

          const saved = this.rowToDrawing(data as PlanDrawingRow)
          normalizedResults.push(saved)
          incomingIds.add(saved.id)
        }
      }

      // Delete items that are no longer in the list
      const idsToDelete = Array.from(this.persisted.keys()).filter(id => !incomingIds.has(id))
      if (idsToDelete.length > 0) {
        const { error } = await this.supabase.from('plan_drawings').delete().in('id', idsToDelete)
        if (error) {
          console.error('Error deleting removed items:', error, idsToDelete)
        } else {
          idsToDelete.forEach(id => this.persisted.delete(id))
        }
      }

      this.persisted = new Map(
        normalizedResults.filter(d => d.id).map(item => [item.id, item])
      )

      return normalizedResults
    } catch (error) {
      console.error('Exception syncing items:', error)
      return items
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('plan_drawings')
        .delete()
        .eq('id', itemId)
        .eq('drawing_type', ITEM_TYPE)

      if (error) {
        console.error('Error deleting item:', error)
        throw error
      }

      this.persisted.delete(itemId)
    } catch (error) {
      console.error('Exception deleting item:', error)
      throw error
    }
  }
}

export const isItemDrawing = (drawing: Drawing): boolean => drawing.type === 'item'














