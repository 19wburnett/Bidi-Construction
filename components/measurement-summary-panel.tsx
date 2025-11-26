'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { X, Ruler, Square, Trash2 } from 'lucide-react'
import { Drawing } from '@/lib/canvas-utils'

interface MeasurementSummaryPanelProps {
  selectedMeasurements: Drawing[]
  onClearSelection: () => void
  onDeleteSelected: () => void
  unit?: 'ft' | 'in' | 'm' | 'cm' | 'mm'
}

export default function MeasurementSummaryPanel({
  selectedMeasurements,
  onClearSelection,
  onDeleteSelected,
  unit = 'ft'
}: MeasurementSummaryPanelProps) {
  const summary = useMemo(() => {
    let totalLinearFeet = 0
    let totalSquareFeet = 0
    let lineCount = 0
    let areaCount = 0

    selectedMeasurements.forEach(drawing => {
      if (drawing.type === 'measurement_line' && drawing.measurements?.totalLength) {
        totalLinearFeet += drawing.measurements.totalLength
        lineCount++
      } else if (drawing.type === 'measurement_area' && drawing.measurements?.area) {
        totalSquareFeet += drawing.measurements.area
        areaCount++
      }
    })

    return {
      totalLinearFeet,
      totalSquareFeet,
      lineCount,
      areaCount,
      hasLines: lineCount > 0,
      hasAreas: areaCount > 0
    }
  }, [selectedMeasurements])

  const formatMeasurement = (value: number, measurementUnit: string, isArea: boolean = false) => {
    const displayUnit = isArea ? `sq ${measurementUnit}` : measurementUnit
    return `${value.toFixed(2)} ${displayUnit}`
  }

  if (selectedMeasurements.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-white/95 backdrop-blur-md border border-gray-200 shadow-2xl rounded-2xl px-5 py-4 min-w-[280px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Ruler className="h-4 w-4 text-blue-600" />
            </div>
            <span className="font-semibold text-gray-800">
              {selectedMeasurements.length} Selected
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-gray-600"
            onClick={onClearSelection}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Totals */}
        <div className="space-y-3">
          {summary.hasLines && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600">
                  Linear ({summary.lineCount} {summary.lineCount === 1 ? 'line' : 'lines'})
                </span>
              </div>
              <span className="font-mono font-semibold text-blue-600 text-lg">
                {formatMeasurement(summary.totalLinearFeet, unit)}
              </span>
            </div>
          )}

          {summary.hasAreas && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Square className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">
                  Area ({summary.areaCount} {summary.areaCount === 1 ? 'shape' : 'shapes'})
                </span>
              </div>
              <span className="font-mono font-semibold text-green-600 text-lg">
                {formatMeasurement(summary.totalSquareFeet, unit, true)}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-gray-600"
            onClick={onClearSelection}
          >
            Clear Selection
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex items-center gap-1"
            onClick={onDeleteSelected}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}


