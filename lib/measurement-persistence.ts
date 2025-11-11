import { createClient } from '@/lib/supabase'
import { Drawing } from '@/lib/canvas-utils'

const MEASUREMENT_TYPES = new Set<Drawing['type']>(['measurement_line', 'measurement_area'])

const isUuid = (value?: string | null): boolean => {
  if (!value) return false
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value)
}

type PlanDrawingRow = {
  id: string
  plan_id: string
  user_id?: string | null
  guest_user_id?: string | null
  page_number: number
  drawing_type: string
  geometry: any
  style: any
  measurement_data?: any
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
      console.warn('Failed to parse JSON value for measurement persistence:', error, value)
      return undefined
    }
  }
  return value as T
}

const cloneMeasurementDrawing = (drawing: Drawing): Drawing => {
  const points = (drawing.geometry.points || []).map(point => Number(point))
  return {
    ...drawing,
    geometry: {
      ...drawing.geometry,
      points
    },
    measurements: drawing.measurements
      ? {
          ...drawing.measurements,
          segmentLengths: drawing.measurements.segmentLengths
            ? drawing.measurements.segmentLengths.map(length => Number(length))
            : undefined,
          totalLength:
            drawing.measurements.totalLength !== undefined
              ? Number(drawing.measurements.totalLength)
              : undefined,
          area:
            drawing.measurements.area !== undefined
              ? Number(drawing.measurements.area)
              : undefined
        }
      : undefined
  }
}

export class MeasurementPersistence {
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

  private measurementTypeFromRow(row: PlanDrawingRow): Drawing['type'] {
    if (row.drawing_type === 'area') {
      return 'measurement_area'
    }

    const measurementData = normalizeJson<any>(row.measurement_data)
    if (measurementData?.measurementType === 'area') {
      return 'measurement_area'
    }

    return 'measurement_line'
  }

  private rowToDrawing(row: PlanDrawingRow): Drawing {
    const geometry = normalizeJson<{ points?: number[] }>(row.geometry) || {}
    const style =
      normalizeJson<{ color?: string; strokeWidth?: number; opacity?: number }>(row.style) || {}
    const measurementData = normalizeJson<{
      segmentLengths?: number[]
      totalLength?: number
      area?: number
      unit?: Drawing['measurements'] extends infer M ? M extends { unit?: infer U } ? U : never : never
    }>(row.measurement_data)

    const type = this.measurementTypeFromRow(row)
    const points = (geometry.points || []).map(point => Number(point))

    const measurements =
      measurementData && Object.keys(measurementData).length > 0
        ? {
            segmentLengths: measurementData.segmentLengths?.map(length => Number(length)),
            totalLength:
              measurementData.totalLength !== undefined
                ? Number(measurementData.totalLength)
                : undefined,
            area:
              measurementData.area !== undefined ? Number(measurementData.area) : undefined,
            unit: measurementData.unit
          }
        : undefined

    return {
      id: row.id,
      type,
      geometry: {
        ...geometry,
        points
      },
      style: {
        color: style.color || '#3b82f6',
        strokeWidth: style.strokeWidth ?? 2,
        opacity: style.opacity ?? 1
      },
      pageNumber: row.page_number,
      measurements,
      label: row.label || undefined,
      notes: row.notes || undefined,
      layerName: row.layer_name || undefined,
      isVisible: row.is_visible ?? true,
      isLocked: row.is_locked ?? false,
      zIndex: row.z_index ?? 0,
      userId: row.user_id || undefined,
      createdAt: row.created_at
    }
  }

  private measurementToInsertPayload(drawing: Drawing) {
    const measurement = cloneMeasurementDrawing(drawing)

    const measurementData =
      measurement.measurements && Object.keys(measurement.measurements).length > 0
        ? {
            ...measurement.measurements,
            measurementType: measurement.type === 'measurement_area' ? 'area' : 'line'
          }
        : null

    return {
      plan_id: this.planId,
      user_id: this.userId || null,
      guest_user_id: this.userId ? null : this.guestUser?.id || null,
      page_number: measurement.pageNumber,
      drawing_type: measurement.type === 'measurement_area' ? 'area' : 'measurement',
      geometry: {
        points: measurement.geometry.points || []
      },
      style: {
        color: measurement.style?.color || '#3b82f6',
        strokeWidth: measurement.style?.strokeWidth ?? 2,
        opacity: measurement.style?.opacity ?? 1
      },
      measurement_data: measurementData,
      label: measurement.label || null,
      notes: measurement.notes || null,
      layer_name: measurement.layerName || 'measurements',
      is_visible: measurement.isVisible ?? true,
      is_locked: measurement.isLocked ?? false,
      z_index: measurement.zIndex ?? 0
    }
  }

  private measurementToUpdatePayload(drawing: Drawing) {
    const measurement = cloneMeasurementDrawing(drawing)

    const measurementData =
      measurement.measurements && Object.keys(measurement.measurements).length > 0
        ? {
            ...measurement.measurements,
            measurementType: measurement.type === 'measurement_area' ? 'area' : 'line'
          }
        : null

    return {
      page_number: measurement.pageNumber,
      drawing_type: measurement.type === 'measurement_area' ? 'area' : 'measurement',
      geometry: {
        points: measurement.geometry.points || []
      },
      style: {
        color: measurement.style?.color || '#3b82f6',
        strokeWidth: measurement.style?.strokeWidth ?? 2,
        opacity: measurement.style?.opacity ?? 1
      },
      measurement_data: measurementData,
      label: measurement.label || null,
      notes: measurement.notes || null,
      layer_name: measurement.layerName || 'measurements',
      is_visible: measurement.isVisible ?? true,
      is_locked: measurement.isLocked ?? false,
      z_index: measurement.zIndex ?? 0
    }
  }

  async loadMeasurements(): Promise<Drawing[]> {
    try {
      const query = this.supabase
        .from('plan_drawings')
        .select('*')
        .eq('plan_id', this.planId)
        .in('drawing_type', ['measurement', 'area'])
        .order('created_at', { ascending: true })

      if (this.userId) {
        query.eq('user_id', this.userId)
      } else if (this.guestUser?.id) {
        query.eq('guest_user_id', this.guestUser.id)
      }

      const { data, error } = await query
      if (error) {
        console.error('Error loading measurements from database:', error)
        return []
      }

      const measurements = (data as PlanDrawingRow[]).map(row => this.rowToDrawing(row))
      this.persisted = new Map(measurements.map(measurement => [measurement.id, measurement]))
      return measurements
    } catch (error) {
      console.error('Exception loading measurements:', error)
      return []
    }
  }

  async syncMeasurements(measurements: Drawing[]): Promise<Drawing[]> {
    if (!this.userId && !this.guestUser?.id) {
      console.warn('Measurement persistence skipped: no user or guest context available')
      return measurements
    }

    try {
      const normalizedResults: Drawing[] = []
      const incomingIds = new Set<string>()

      for (const measurement of measurements) {
        const normalized = cloneMeasurementDrawing(measurement)
        const hasPersistedId = isUuid(normalized.id) && this.persisted.has(normalized.id)

        if (hasPersistedId && normalized.id) {
          const updatePayload = this.measurementToUpdatePayload(normalized)
          const { error } = await this.supabase
            .from('plan_drawings')
            .update(updatePayload)
            .eq('id', normalized.id)

          if (error) {
            console.error('Error updating measurement:', error, normalized)
            continue
          }

          normalizedResults.push(normalized)
          incomingIds.add(normalized.id)
        } else {
          const insertPayload = this.measurementToInsertPayload(normalized)
          const { data, error } = await this.supabase
            .from('plan_drawings')
            .insert(insertPayload)
            .select()
            .single()

          if (error) {
            console.error('Error saving measurement:', error, normalized)
            continue
          }

          const saved = this.rowToDrawing(data as PlanDrawingRow)
          normalizedResults.push(saved)
          incomingIds.add(saved.id)
        }
      }

      const idsToDelete = Array.from(this.persisted.keys()).filter(id => !incomingIds.has(id))
      if (idsToDelete.length > 0) {
        const { error } = await this.supabase.from('plan_drawings').delete().in('id', idsToDelete)
        if (error) {
          console.error('Error deleting removed measurements:', error, idsToDelete)
        } else {
          idsToDelete.forEach(id => this.persisted.delete(id))
        }
      }

      this.persisted = new Map(
        normalizedResults.filter(d => isUuid(d.id)).map(measurement => [measurement.id, measurement])
      )

      return normalizedResults
    } catch (error) {
      console.error('Exception syncing measurements:', error)
      return measurements
    }
  }
}

export const isMeasurementDrawing = (drawing: Drawing): boolean =>
  MEASUREMENT_TYPES.has(drawing.type)



