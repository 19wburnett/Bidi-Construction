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
  /** Rendered page dimensions in pixels (for automatic scale calculation) */
  pageDimensions?: { width: number; height: number }
  /** PDF native dimensions in points (72 DPI) - used to calculate effective DPI */
  pdfNativeDimensions?: { width: number; height: number }
}

const PRESET_SCALES: { label: string; value: string; pixelsPerUnit?: number; unit: Unit; scaleRatio?: number }[] = [
  // Architectural (feet) - scaleRatio is inches on plan per foot in real life
  { label: '1/8" = 1\'', value: '1/8" = 1\'', unit: 'ft', scaleRatio: 1/8 },
  { label: '1/4" = 1\'', value: '1/4" = 1\'', unit: 'ft', scaleRatio: 1/4 },
  { label: '1/2" = 1\'', value: '1/2" = 1\'', unit: 'ft', scaleRatio: 1/2 },
  { label: '1" = 1\'', value: '1" = 1\'', unit: 'ft', scaleRatio: 1 },
  // Metric (meters) - scaleRatio is the denominator (1:100 means 1/100)
  { label: '1:100', value: '1:100', unit: 'm', scaleRatio: 1/100 },
  { label: '1:50', value: '1:50', unit: 'm', scaleRatio: 1/50 },
  { label: '1:20', value: '1:20', unit: 'm', scaleRatio: 1/20 }
]

/**
 * Calculate pixelsPerUnit from scale ratio using actual rendered page dimensions
 * @param scaleRatio - For architectural: inches on plan per foot (e.g., 1/4 for "1/4" = 1'")
 *                     For metric: unit on plan per unit in real life (e.g., 1/100 for "1:100")
 * @param unit - The unit type ('ft', 'in', 'm', 'cm', 'mm')
 * @param renderedWidth - Rendered page width in pixels
 * @param pdfNativeWidth - PDF native width in points (72 DPI)
 * @returns pixelsPerUnit or null if calculation not possible
 */
function calculatePixelsPerUnitFromRatio(
  scaleRatio: number,
  unit: Unit,
  renderedWidth?: number,
  pdfNativeWidth?: number
): number | null {
  // If we don't have dimensions, return null (will use manual input)
  if (!renderedWidth || !pdfNativeWidth) {
    return null
  }

  // Calculate effective DPI: (rendered width in pixels) / (physical width in inches)
  // PDF native width is in points, where 72 points = 1 inch
  const physicalWidthInches = pdfNativeWidth / 72
  const effectiveDPI = renderedWidth / physicalWidthInches

  if (unit === 'ft') {
    // For architectural scales like "1/4" = 1'":
    // scaleRatio is inches on plan per foot (e.g., 1/4)
    // 1/4 inch on plan = 1 foot in real life
    // So pixels per foot = (effectiveDPI * scaleRatio)
    return effectiveDPI * scaleRatio
  } else if (unit === 'in') {
    // For inch-based scales
    // scaleRatio is inches on plan per inch in real life
    return effectiveDPI * scaleRatio
  } else if (unit === 'm') {
    // For metric scales like "1:100":
    // scaleRatio is unit on plan per unit in real life (e.g., 1/100)
    // 1 mm on plan = 100 mm = 0.1 m in real life
    // So 1 mm on plan = 0.1 m
    // 1 mm = 1/25.4 inches
    // pixels per meter = (effectiveDPI / 25.4) / (scaleRatio * 1000) 
    // But actually, if scaleRatio is 1/100, then 1 unit on plan = 100 units in real life
    // If we measure in mm on plan, then: 1 mm on plan = 100 mm = 0.1 m
    // So pixelsPerMeter = (effectiveDPI / 25.4) / 0.1 = effectiveDPI * 10 / 25.4
    // But we need to account for the scale ratio
    // If scaleRatio = 1/100, then 1 mm on plan = 100 mm = 0.1 m
    // So pixelsPerMeter = (effectiveDPI / 25.4) / (scaleRatio * 1000)
    // = (effectiveDPI / 25.4) / (0.01 * 1000) = (effectiveDPI / 25.4) / 10
    // Actually, let's think: 1:100 means 1 unit on plan = 100 units in real life
    // If we use mm: 1 mm on plan = 100 mm = 0.1 m
    // pixelsPerMeter = (effectiveDPI * 1mm in inches) / 0.1m
    // = (effectiveDPI / 25.4) / 0.1 = effectiveDPI * 10 / 25.4
    // But we need to multiply by scaleRatio to get the right conversion
    // Actually, scaleRatio = 1/100, so we need to divide by it
    // pixelsPerMeter = (effectiveDPI / 25.4) / (scaleRatio * 1000)
    // Let's simplify: for 1:100, scaleRatio = 1/100
    // 1 mm on plan = 100 mm = 0.1 m
    // pixelsPerMeter = (effectiveDPI / 25.4) / 0.1 = effectiveDPI * 10 / 25.4
    // But we need to account for scaleRatio
    // If scaleRatio = 1/100, then pixelsPerMeter = effectiveDPI * 10 / 25.4 / (1/100)
    // = effectiveDPI * 10 / 25.4 * 100 = effectiveDPI * 1000 / 25.4
    // That doesn't seem right...
    
    // Let me reconsider: For 1:100 scale
    // 1 unit on plan = 100 units in real life
    // If we measure 1 mm on the plan, that represents 100 mm = 0.1 m in real life
    // So to get pixels per meter:
    // - 1 mm on plan = 0.1 m in real life
    // - 1 mm = 1/25.4 inches
    // - 1 mm on plan in pixels = effectiveDPI / 25.4
    // - So pixelsPerMeter = (effectiveDPI / 25.4) / 0.1 = effectiveDPI * 10 / 25.4
    // But this doesn't use scaleRatio...
    
    // Actually, I think the issue is that for metric scales, the ratio is already
    // in the format we need. Let me use a simpler approach:
    // For 1:100, if we measure 1 mm on plan, it's 100 mm = 0.1 m in real life
    // So pixelsPerMeter = (effectiveDPI / 25.4) / 0.1 = effectiveDPI * 10 / 25.4
    // But we need to account for the scale ratio
    // If scaleRatio = 1/100, then we need to divide by it
    // pixelsPerMeter = (effectiveDPI / 25.4) / (scaleRatio * 1000)
    // = (effectiveDPI / 25.4) / ((1/100) * 1000) = (effectiveDPI / 25.4) / 10
    // = effectiveDPI / 254
    
    // Actually, let me use a more direct approach:
    // For metric scales, scaleRatio represents the fraction (e.g., 1/100 for 1:100)
    // 1 mm on plan = (1 / scaleRatio) mm in real life = (1 / scaleRatio) / 1000 m
    // 1 mm = 1/25.4 inches
    // pixelsPerMeter = (effectiveDPI / 25.4) / ((1 / scaleRatio) / 1000)
    // = (effectiveDPI / 25.4) * (scaleRatio * 1000)
    // = effectiveDPI * scaleRatio * 1000 / 25.4
    return (effectiveDPI * scaleRatio * 1000) / 25.4
  } else if (unit === 'cm') {
    // For metric scales in cm:
    // 1 mm on plan = (1 / scaleRatio) mm in real life = (1 / scaleRatio) / 10 cm
    // pixelsPerCm = (effectiveDPI / 25.4) / ((1 / scaleRatio) / 10)
    // = (effectiveDPI / 25.4) * (scaleRatio * 10)
    // = effectiveDPI * scaleRatio * 10 / 25.4
    return (effectiveDPI * scaleRatio * 10) / 25.4
  } else if (unit === 'mm') {
    // For metric scales in mm:
    // 1 mm on plan = (1 / scaleRatio) mm in real life
    // pixelsPerMm = (effectiveDPI / 25.4) / (1 / scaleRatio)
    // = (effectiveDPI / 25.4) * scaleRatio
    return (effectiveDPI * scaleRatio) / 25.4
  }
  
  return null
}

export default function ScaleSettingsModal({ 
  open, 
  onOpenChange, 
  current, 
  onApply,
  onStartCalibration,
  calibrationPoints,
  onCalibrationComplete,
  numPages,
  onApplyCurrentToAll,
  pageDimensions,
  pdfNativeDimensions
}: ScaleSettingsModalProps) {
  const [mode, setMode] = useState<'ratio' | 'calibration'>('ratio')
  const [applyToAllPages, setApplyToAllPages] = useState(false)
  const [preset, setPreset] = useState<string>(current?.ratio || '1/4" = 1\'')
  const [unit, setUnit] = useState<Unit>(current?.unit || 'ft')
  const [customPixels, setCustomPixels] = useState<string>('')
  const [calibrationDistance, setCalibrationDistance] = useState<string>('')
  const [calibrationUnit, setCalibrationUnit] = useState<Unit>('ft')
  const [calibrationFeet, setCalibrationFeet] = useState<string>('')
  const [calibrationInches, setCalibrationInches] = useState<string>('')

  // Reset state when modal opens with current settings
  useEffect(() => {
    if (open) {
      // Check if we have two calibration points - if so, switch to calibration mode
      const hasCalibrationPoints = calibrationPoints && Array.isArray(calibrationPoints) && calibrationPoints.length === 2
      
      if (hasCalibrationPoints) {
        setMode(prev => prev !== 'calibration' ? 'calibration' : prev)
        // Don't reset calibration distance if user already entered it
        if (!calibrationDistance.trim()) {
          setCalibrationDistance('')
        }
      } else {
        // Only reset if we're not in the middle of calibration (have 1 point)
        // If we have 1 point, we're waiting for the second, so keep calibration mode
        const hasOnePoint = calibrationPoints && Array.isArray(calibrationPoints) && calibrationPoints.length === 1
        
        if (!hasOnePoint) {
          const currentRatio = current?.ratio || '1/4" = 1\''
          const currentUnit = current?.unit || 'ft'
          setPreset(prev => prev !== currentRatio ? currentRatio : prev)
          setUnit(prev => prev !== currentUnit ? currentUnit : prev)
          setCustomPixels('')
          setCalibrationDistance('')
          setCalibrationUnit('ft')
          setCalibrationFeet('')
          setCalibrationInches('')
          setMode(prev => prev !== 'ratio' ? 'ratio' : prev)
        } else {
          // We have 1 point, so we're in calibration mode waiting for the second point
          setMode(prev => prev !== 'calibration' ? 'calibration' : prev)
        }
      }
    }
  }, [open, current?.ratio, current?.unit, calibrationPoints, calibrationDistance])

  const calibrationDistanceInfo = useMemo(() => {
    if (calibrationUnit === 'ft') {
      const feetRaw = calibrationFeet.trim()
      const inchesRaw = calibrationInches.trim()

      const parsedFeet = feetRaw === '' ? null : Number(feetRaw)
      const parsedInches = inchesRaw === '' ? null : Number(inchesRaw)

      if (
        (parsedFeet !== null && (!Number.isFinite(parsedFeet) || parsedFeet < 0)) ||
        (parsedInches !== null && (!Number.isFinite(parsedInches) || parsedInches < 0))
      ) {
        return { value: null as number | null, label: '' }
      }

      const totalFeet =
        (parsedFeet ?? 0) +
        (parsedInches ?? 0) / 12

      if (!Number.isFinite(totalFeet) || totalFeet <= 0) {
        return { value: null as number | null, label: '' }
      }

      const formatSegment = (segment: string) => {
        if (!segment.trim()) return null
        const numeric = Number(segment)
        if (!Number.isFinite(numeric)) return null
        return Number.isInteger(numeric) ? `${numeric}` : numeric.toString()
      }

      const segments: string[] = []
      const formattedFeet = formatSegment(calibrationFeet)
      const formattedInches = formatSegment(calibrationInches)

      if (parsedFeet !== null && parsedFeet > 0 && formattedFeet) {
        segments.push(`${formattedFeet}'`)
      }

      if (parsedInches !== null && parsedInches > 0 && formattedInches) {
        segments.push(`${formattedInches}"`)
      }

      if (segments.length === 0) {
        segments.push(`0'`)
      }

      return {
        value: totalFeet,
        label: `${segments.join(' ')} (ft)`
      }
    }

    const normalizedDistance = calibrationDistance.trim()
    if (!normalizedDistance) {
      return { value: null as number | null, label: '' }
    }

    const distance = Number(normalizedDistance)
    if (!Number.isFinite(distance) || distance <= 0) {
      return { value: null as number | null, label: '' }
    }

    return {
      value: distance,
      label: `${normalizedDistance} ${calibrationUnit}`
    }
  }, [calibrationUnit, calibrationDistance, calibrationFeet, calibrationInches])

  const { value: calibrationDistanceValue, label: calibrationDistanceLabel } = calibrationDistanceInfo

  // Calculate pixelsPerUnit from calibration points
  const calibrationPixelsPerUnit = useMemo(() => {
    if (!calibrationPoints || calibrationPoints.length !== 2 || !calibrationDistanceValue) {
      return null
    }
    
    const pixelDistance = Math.sqrt(
      Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
      Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
    )
    
    if (pixelDistance === 0) return null
    
    return pixelDistance / calibrationDistanceValue
  }, [calibrationPoints, calibrationDistanceValue])

  const computedPixelsPerUnit = useMemo(() => {
    // Manual override takes precedence
    if (customPixels.trim()) {
      const n = Number(customPixels)
      return Number.isFinite(n) && n > 0 ? n : undefined
    }
    
    // Try to calculate from scale ratio using actual page dimensions
    const found = PRESET_SCALES.find(p => p.value === preset)
    if (found && found.scaleRatio !== undefined && pageDimensions && pdfNativeDimensions) {
      const calculated = calculatePixelsPerUnitFromRatio(
        found.scaleRatio,
        found.unit,
        pageDimensions.width,
        pdfNativeDimensions.width
      )
      if (calculated !== null) {
        return calculated
      }
    }
    
    // Fallback to hardcoded value if available (for backwards compatibility)
    return found?.pixelsPerUnit
  }, [preset, customPixels, pageDimensions, pdfNativeDimensions])

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
      const ratioDisplay = calibrationDistanceLabel || `${calibrationDistanceValue ?? ''} ${calibrationUnit}`
      const ratio = `${pixelDistance.toFixed(0)}px = ${ratioDisplay}`
      
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
                <span>
                  {pageDimensions && pdfNativeDimensions ? (
                    <span className="text-green-600">✓ Auto-calculated: {computedPixelsPerUnit.toFixed(2)} px per {unit}</span>
                  ) : (
                    <span>Computed: {computedPixelsPerUnit.toFixed(2)} px per {unit}</span>
                  )}
                </span>
              ) : (
                <span>
                  {pageDimensions && pdfNativeDimensions ? (
                    <span>Select a scale ratio to auto-calculate, or enter pixels per unit manually.</span>
                  ) : (
                    <span>Enter a valid number for pixels per unit or choose a preset.</span>
                  )}
                </span>
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
                  <div className={calibrationUnit === 'ft' ? 'col-span-2' : undefined}>
                    <Label className="mb-1 block">Known Distance</Label>
                    {calibrationUnit === 'ft' ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-gray-600 mb-1 block">Feet</Label>
                          <Input
                            type="number"
                            placeholder="e.g., 10"
                            value={calibrationFeet}
                            onChange={(e) => setCalibrationFeet(e.target.value)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 mb-1 block">Inches</Label>
                          <Input
                            type="number"
                            placeholder="e.g., 6"
                            value={calibrationInches}
                            onChange={(e) => setCalibrationInches(e.target.value)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        placeholder="e.g., 10"
                        value={calibrationDistance}
                        onChange={(e) => setCalibrationDistance(e.target.value)}
                        step="0.01"
                        min="0"
                      />
                    )}
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
                    <span>
                      {calibrationUnit === 'ft'
                        ? 'Enter the known distance using feet and inches.'
                        : 'Enter the known distance between the two points.'}
                    </span>
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





