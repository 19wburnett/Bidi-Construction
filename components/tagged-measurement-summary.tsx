'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Ruler, Square, X, Filter } from 'lucide-react'
import { Drawing } from '@/lib/canvas-utils'

interface TaggedMeasurementSummaryProps {
  measurements: Drawing[]
  tags: Array<{ id: string; name: string; color: string }>
  selectedTagIds: Set<string>
  onTagFilter: (tagIds: Set<string>) => void
  onMeasurementHighlight?: (measurementIds: string[]) => void
  unit?: 'ft' | 'in' | 'm' | 'cm' | 'mm'
}

export default function TaggedMeasurementSummary({
  measurements,
  tags,
  selectedTagIds,
  onTagFilter,
  onMeasurementHighlight,
  unit = 'ft'
}: TaggedMeasurementSummaryProps) {
  const summary = useMemo(() => {
    const tagMap = new Map<string, {
      tag: { id: string; name: string; color: string }
      lineMeasurements: Drawing[]
      areaMeasurements: Drawing[]
      totalLinearFeet: number
      totalSquareFeet: number
    }>()

    // Group measurements by tag
    measurements.forEach(measurement => {
      if (measurement.type !== 'measurement_line' && measurement.type !== 'measurement_area') {
        return
      }

      const tagId = measurement.measurementTag?.id || 'untagged'
      const tag = measurement.measurementTag || { id: 'untagged', name: 'Untagged', color: '#9ca3af' }

      if (!tagMap.has(tagId)) {
        tagMap.set(tagId, {
          tag,
          lineMeasurements: [],
          areaMeasurements: [],
          totalLinearFeet: 0,
          totalSquareFeet: 0
        })
      }

      const group = tagMap.get(tagId)!
      
      if (measurement.type === 'measurement_line' && measurement.measurements?.totalLength) {
        group.lineMeasurements.push(measurement)
        group.totalLinearFeet += measurement.measurements.totalLength
      } else if (measurement.type === 'measurement_area' && measurement.measurements?.area) {
        group.areaMeasurements.push(measurement)
        group.totalSquareFeet += measurement.measurements.area
      }
    })

    return Array.from(tagMap.values()).sort((a, b) => {
      if (a.tag.id === 'untagged') return 1
      if (b.tag.id === 'untagged') return -1
      return a.tag.name.localeCompare(b.tag.name)
    })
  }, [measurements])

  const formatMeasurement = (value: number, measurementUnit: string, isArea: boolean = false) => {
    const displayUnit = isArea ? `sq ${measurementUnit}` : measurementUnit
    return `${value.toFixed(2)} ${displayUnit}`
  }

  const handleTagClick = (tagId: string) => {
    const newSelection = new Set(selectedTagIds)
    if (newSelection.has(tagId)) {
      newSelection.delete(tagId)
    } else {
      newSelection.add(tagId)
    }
    onTagFilter(newSelection)
  }

  const handleTagHover = (tagId: string) => {
    if (onMeasurementHighlight) {
      const measurementIds = measurements
        .filter(m => m.measurementTag?.id === tagId || (!m.measurementTag && tagId === 'untagged'))
        .map(m => m.id)
      onMeasurementHighlight(measurementIds)
    }
  }

  const clearFilters = () => {
    onTagFilter(new Set())
  }

  if (summary.length === 0) {
    return null
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-800">Measurement Tags</h3>
        </div>
        {selectedTagIds.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={clearFilters}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {summary.map(({ tag, lineMeasurements, areaMeasurements, totalLinearFeet, totalSquareFeet }) => {
          const isSelected = selectedTagIds.has(tag.id)
          const hasAnyMeasurements = lineMeasurements.length > 0 || areaMeasurements.length > 0

          if (!hasAnyMeasurements) return null

          return (
            <div
              key={tag.id}
              className={`p-3 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => handleTagClick(tag.id)}
              onMouseEnter={() => handleTagHover(tag.id)}
              onMouseLeave={() => onMeasurementHighlight?.([])}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>
                  {tag.name}
                </span>
              </div>

              <div className="space-y-1.5 ml-6">
                {totalSquareFeet > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Square className="h-3 w-3 text-green-500" />
                      <span>
                        Area ({areaMeasurements.length} {areaMeasurements.length === 1 ? 'shape' : 'shapes'})
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-green-700">
                      {formatMeasurement(totalSquareFeet, unit, true)}
                    </span>
                  </div>
                )}

                {totalLinearFeet > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Ruler className="h-3 w-3 text-blue-500" />
                      <span>
                        Linear ({lineMeasurements.length} {lineMeasurements.length === 1 ? 'line' : 'lines'})
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-blue-700">
                      {formatMeasurement(totalLinearFeet, unit)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}