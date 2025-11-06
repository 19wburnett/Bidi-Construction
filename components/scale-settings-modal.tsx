'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'

type Unit = 'ft' | 'in' | 'm' | 'cm' | 'mm'

export interface ScaleSetting {
  ratio: string
  pixelsPerUnit: number
  unit: Unit
}

interface ScaleSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: ScaleSetting
  onApply: (setting: ScaleSetting, applyToAllPages?: boolean) => void
  onStartCalibration?: () => void
  calibrationPoints?: { x: number; y: number }[]
  onCalibrationComplete?: () => void
  numPages?: number
  onApplyCurrentToAll?: () => void
}

const PRESET_SCALES: { label: string; value: string; pixelsPerUnit: number; unit: Unit }[] = [
  // Architectural (feet)
  { label: '1/8" = 1\'', value: '1/8" = 1\'', pixelsPerUnit: 96, unit: 'ft' },
  { label: '1/4" = 1\'', value: '1/4" = 1\'', pixelsPerUnit: 48, unit: 'ft' },
  { label: '1/2" = 1\'', value: '1/2" = 1\'', pixelsPerUnit: 24, unit: 'ft' },
  { label: '1" = 1\'', value: '1" = 1\'', pixelsPerUnit: 12, unit: 'ft' },
  // Metric (meters)
  { label: '1:100', value: '1:100', pixelsPerUnit: 100, unit: 'm' },
  { label: '1:50', value: '1:50', pixelsPerUnit: 50, unit: 'm' },
  { label: '1:20', value: '1:20', pixelsPerUnit: 20, unit: 'm' }
]

export default function ScaleSettingsModal({ 
  open, 
  onOpenChange, 
  current, 
  onApply,
  onStartCalibration,
  calibrationPoints,
  onCalibrationComplete,
  numPages,
  onApplyCurrentToAll
}: ScaleSettingsModalProps) {
  const [mode, setMode] = useState<'ratio' | 'calibration'>('ratio')
  const [applyToAllPages, setApplyToAllPages] = useState(false)
  const [preset, setPreset] = useState<string>(current?.ratio || '1/4" = 1\'')
  const [unit, setUnit] = useState<Unit>(current?.unit || 'ft')
  const [customPixels, setCustomPixels] = useState<string>('')
  const [calibrationDistance, setCalibrationDistance] = useState<string>('')
  const [calibrationUnit, setCalibrationUnit] = useState<Unit>('ft')

  // Reset state when modal opens with current settings
  useEffect(() => {
    if (open) {
      // Check if we have two calibration points - if so, switch to calibration mode
      const hasCalibrationPoints = calibrationPoints && Array.isArray(calibrationPoints) && calibrationPoints.length === 2
      
      if (hasCalibrationPoints) {
        setMode('calibration')
        // Don't reset calibration distance if user already entered it
        if (!calibrationDistance.trim()) {
          setCalibrationDistance('')
        }
      } else {
        // Only reset if we're not in the middle of calibration (have 1 point)
        // If we have 1 point, we're waiting for the second, so keep calibration mode
        const hasOnePoint = calibrationPoints && Array.isArray(calibrationPoints) && calibrationPoints.length === 1
        
        if (!hasOnePoint) {
          setPreset(current?.ratio || '1/4" = 1\'')
          setUnit(current?.unit || 'ft')
          setCustomPixels('')
          setCalibrationDistance('')
          setCalibrationUnit('ft')
          setMode('ratio')
        } else {
          // We have 1 point, so we're in calibration mode waiting for the second point
          setMode('calibration')
        }
      }
    }
  }, [open, current?.ratio, current?.unit, calibrationPoints])

  // Calculate pixelsPerUnit from calibration points
  const calibrationPixelsPerUnit = useMemo(() => {
    if (!calibrationPoints || calibrationPoints.length !== 2 || !calibrationDistance.trim()) {
      return null
    }
    
    const distance = Number(calibrationDistance)
    if (!Number.isFinite(distance) || distance <= 0) return null
    
    const pixelDistance = Math.sqrt(
      Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
      Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
    )
    
    if (pixelDistance === 0) return null
    
    return pixelDistance / distance
  }, [calibrationPoints, calibrationDistance])

  const computedPixelsPerUnit = useMemo(() => {
    if (customPixels.trim()) {
      const n = Number(customPixels)
      return Number.isFinite(n) && n > 0 ? n : undefined
    }
    const found = PRESET_SCALES.find(p => p.value === preset)
    return found?.pixelsPerUnit
  }, [preset, customPixels])

  const handleApply = () => {
    if (mode === 'ratio') {
      if (!computedPixelsPerUnit) return
      onApply({ ratio: preset, pixelsPerUnit: computedPixelsPerUnit, unit }, applyToAllPages)
      onOpenChange(false)
    } else {
      // Calibration mode
      if (!calibrationPixelsPerUnit || !calibrationPoints || calibrationPoints.length !== 2) return
      
      // Create a ratio string for display
      const pixelDistance = Math.sqrt(
        Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
        Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
      )
      const ratio = `${pixelDistance.toFixed(0)}px = ${calibrationDistance} ${calibrationUnit}`
      
      onApply({ 
        ratio, 
        pixelsPerUnit: calibrationPixelsPerUnit, 
        unit: calibrationUnit 
      }, applyToAllPages)
      if (onCalibrationComplete) {
        onCalibrationComplete()
      }
      onOpenChange(false)
    }
  }

  const handleStartCalibration = () => {
    setMode('calibration')
    if (onStartCalibration) {
      onStartCalibration()
    }
  }

  // Debug: log props when modal opens
  React.useEffect(() => {
    if (open) {
      console.log('ScaleSettingsModal props:', {
        numPages,
        hasOnApplyCurrentToAll: !!onApplyCurrentToAll,
        current,
        shouldShowButton: numPages && numPages > 1 && onApplyCurrentToAll
      })
    }
  }, [open, numPages, onApplyCurrentToAll, current])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Set Drawing Scale</DialogTitle>
        </DialogHeader>

        {numPages && numPages > 1 && (
          <div className="mb-4 mt-2">
            {current && onApplyCurrentToAll ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onApplyCurrentToAll}
                  className="w-full"
                >
                  Apply Current Scale to All {numPages} Pages
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Current scale: {current.ratio} ({current.unit})
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 text-center">
                Set a scale for this page first, then you can apply it to all pages.
              </p>
            )}
          </div>
        )}

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'ratio' | 'calibration')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ratio">Ratio</TabsTrigger>
            <TabsTrigger value="calibration">Two Points</TabsTrigger>
          </TabsList>

          <TabsContent value="ratio" className="space-y-4 mt-4">
            <div>
              <Label className="mb-1 block">Scale ratio</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scale" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_SCALES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Unit</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ft">Feet</SelectItem>
                    <SelectItem value="in">Inches</SelectItem>
                    <SelectItem value="m">Meters</SelectItem>
                    <SelectItem value="cm">Centimeters</SelectItem>
                    <SelectItem value="mm">Millimeters</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Pixels per unit (optional)</Label>
                <Input
                  placeholder="e.g., 48"
                  value={customPixels}
                  onChange={(e) => setCustomPixels(e.target.value)}
                />
              </div>
            </div>

            <div className="text-xs text-gray-600">
              {computedPixelsPerUnit ? (
                <span>Computed: {computedPixelsPerUnit.toFixed(2)} px per {unit}</span>
              ) : (
                <span>Enter a valid number for pixels per unit or choose a preset.</span>
              )}
            </div>
          </TabsContent>

          <TabsContent value="calibration" className="space-y-4 mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                Click two points on the plan that represent a known distance, then enter that distance below.
              </p>
            </div>

            {(!calibrationPoints || !Array.isArray(calibrationPoints) || calibrationPoints.length === 0) ? (
              <div>
                <Button 
                  onClick={handleStartCalibration}
                  className="w-full"
                  variant="outline"
                >
                  Click to Place Points on Plan
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  This will close the modal and let you click two points on the plan.
                </p>
              </div>
            ) : calibrationPoints.length === 1 ? (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⏳ First point placed - click the second point on the plan
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    The modal will reopen automatically when both points are placed.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    if (onStartCalibration) {
                      onStartCalibration()
                    }
                  }}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  Cancel and Start Over
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-sm text-green-800 font-medium">
                    ✓ Two points selected
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Pixel distance: {Math.sqrt(
                      Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
                      Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
                    ).toFixed(1)} px
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1 block">Known Distance</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 10"
                      value={calibrationDistance}
                      onChange={(e) => setCalibrationDistance(e.target.value)}
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Unit</Label>
                    <Select value={calibrationUnit} onValueChange={(v) => setCalibrationUnit(v as Unit)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ft">Feet</SelectItem>
                        <SelectItem value="in">Inches</SelectItem>
                        <SelectItem value="m">Meters</SelectItem>
                        <SelectItem value="cm">Centimeters</SelectItem>
                        <SelectItem value="mm">Millimeters</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="text-xs text-gray-600">
                  {calibrationPixelsPerUnit ? (
                    <span>Computed: {calibrationPixelsPerUnit.toFixed(2)} px per {calibrationUnit}</span>
                  ) : (
                    <span>Enter the known distance between the two points.</span>
                  )}
                </div>

                <Button
                  onClick={() => {
                    if (onStartCalibration) {
                      onStartCalibration()
                    }
                  }}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  Re-select Points
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {numPages && numPages > 1 && (
          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="apply-to-all"
              checked={applyToAllPages}
              onCheckedChange={(checked) => setApplyToAllPages(checked === true)}
            />
            <Label
              htmlFor="apply-to-all"
              className="text-sm font-normal cursor-pointer"
            >
              Apply to all {numPages} pages
            </Label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleApply} 
            disabled={mode === 'ratio' ? !computedPixelsPerUnit : !calibrationPixelsPerUnit}
          >
            Apply Scale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}





