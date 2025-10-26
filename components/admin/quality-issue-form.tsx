'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { MapPin, Plus, AlertTriangle } from 'lucide-react'

export interface QualityIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  description: string
  location?: string
  recommendation?: string
  marker?: { x: number; y: number; page: number }
}

interface QualityIssueFormProps {
  onAddIssue: (issue: QualityIssue) => void
  onPlaceMarker: () => void
  isPlacingMarker: boolean
  markerPosition?: { x: number; y: number; page: number } | null
  editingIssue?: QualityIssue | null
  onCancelEdit?: () => void
}

const SEVERITIES = [
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
  { value: 'warning', label: 'Warning', color: 'text-orange-600' },
  { value: 'info', label: 'Info', color: 'text-blue-600' }
]

const CATEGORIES = [
  'Dimensions',
  'Annotations',
  'Completeness',
  'Compliance',
  'Clarity',
  'Standards',
  'Safety',
  'Code Violations',
  'Missing Details',
  'Inconsistencies',
  'Other'
]

export default function QualityIssueForm({
  onAddIssue,
  onPlaceMarker,
  isPlacingMarker,
  markerPosition,
  editingIssue,
  onCancelEdit
}: QualityIssueFormProps) {
  const [formData, setFormData] = useState<Partial<QualityIssue>>(
    editingIssue || {
      severity: 'warning',
      category: 'Dimensions',
      description: '',
      location: '',
      recommendation: '',
      marker: undefined
    }
  )

  // Update form when marker is placed
  useEffect(() => {
    if (markerPosition && !editingIssue) {
      setFormData(prev => ({ ...prev, marker: markerPosition }))
    }
  }, [markerPosition, editingIssue])

  const handleSubmit = () => {
    if (!formData.description || !formData.description.trim()) {
      alert('Please provide an issue description')
      return
    }

    if (!formData.severity) {
      alert('Please select a severity level')
      return
    }

    if (!formData.category) {
      alert('Please select a category')
      return
    }

    const issue: QualityIssue = {
      id: editingIssue?.id || `issue-${Date.now()}`,
      severity: formData.severity as 'critical' | 'warning' | 'info',
      category: formData.category!,
      description: formData.description!.trim(),
      location: formData.location?.trim(),
      recommendation: formData.recommendation?.trim(),
      marker: formData.marker
    }

    onAddIssue(issue)
    
    // Reset form if not editing
    if (!editingIssue) {
      setFormData({
        severity: 'warning',
        category: 'Dimensions',
        description: '',
        location: '',
        recommendation: '',
        marker: undefined
      })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="severity">Severity *</Label>
        <Select
          value={formData.severity}
          onValueChange={(value) => setFormData(prev => ({ ...prev, severity: value as any }))}
        >
          <SelectTrigger id="severity" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEVERITIES.map(sev => (
              <SelectItem key={sev.value} value={sev.value}>
                <div className="flex items-center">
                  <AlertTriangle className={`h-4 w-4 mr-2 ${sev.color}`} />
                  {sev.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="category">Category *</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
        >
          <SelectTrigger id="category" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          placeholder="Describe the quality issue..."
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="mt-1"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="location">Location (optional)</Label>
        <Input
          id="location"
          placeholder="e.g., Floor 2, Room A, Sheet 3"
          value={formData.location}
          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="recommendation">Recommendation (optional)</Label>
        <Textarea
          id="recommendation"
          placeholder="Suggested fix or improvement..."
          value={formData.recommendation}
          onChange={(e) => setFormData(prev => ({ ...prev, recommendation: e.target.value }))}
          className="mt-1"
          rows={2}
        />
      </div>

      <div>
        <Label>Marker Location</Label>
        <Button
          type="button"
          variant="outline"
          className="w-full mt-1"
          onClick={onPlaceMarker}
          disabled={isPlacingMarker}
        >
          <MapPin className="h-4 w-4 mr-2" />
          {isPlacingMarker ? 'Click on plan to place marker...' : 
           formData.marker ? `Page ${formData.marker.page}` : 'Place Marker on Plan'}
        </Button>
        {formData.marker && (
          <Badge variant="outline" className="mt-2">
            Page {formData.marker.page} at ({Math.round(formData.marker.x)}, {Math.round(formData.marker.y)})
          </Badge>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        {editingIssue && onCancelEdit && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancelEdit}
          >
            Cancel
          </Button>
        )}
        <Button
          className="flex-1 bg-orange-600 hover:bg-orange-700"
          onClick={handleSubmit}
        >
          <Plus className="h-4 w-4 mr-2" />
          {editingIssue ? 'Update Issue' : 'Add Issue'}
        </Button>
      </div>
    </div>
  )
}

