'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { MapPin, Plus } from 'lucide-react'

export interface TakeoffItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  unit_cost?: number
  notes?: string
  marker?: { x: number; y: number; page: number }
}

interface TakeoffItemFormProps {
  onAddItem: (item: TakeoffItem) => void
  onPlaceMarker: () => void
  isPlacingMarker: boolean
  markerPosition?: { x: number; y: number; page: number } | null
  editingItem?: TakeoffItem | null
  onCancelEdit?: () => void
}

const CATEGORIES = [
  'Concrete',
  'Framing',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Drywall',
  'Flooring',
  'Roofing',
  'Windows & Doors',
  'Insulation',
  'Painting',
  'Landscaping',
  'Other'
]

const UNITS = [
  'sq ft',
  'linear ft',
  'cu yd',
  'units',
  'each',
  'lbs',
  'tons',
  'gallons',
  'hours'
]

export default function TakeoffItemForm({
  onAddItem,
  onPlaceMarker,
  isPlacingMarker,
  markerPosition,
  editingItem,
  onCancelEdit
}: TakeoffItemFormProps) {
  const [formData, setFormData] = useState<Partial<TakeoffItem>>(
    editingItem || {
      name: '',
      category: 'Concrete',
      quantity: 0,
      unit: 'sq ft',
      unit_cost: undefined,
      notes: '',
      marker: undefined
    }
  )

  // Update form when marker is placed
  useEffect(() => {
    if (markerPosition && !editingItem) {
      setFormData(prev => ({ ...prev, marker: markerPosition }))
    }
  }, [markerPosition, editingItem])

  const handleSubmit = () => {
    if (!formData.name || !formData.quantity) {
      alert('Please fill in item name and quantity')
      return
    }

    const item: TakeoffItem = {
      id: editingItem?.id || `item-${Date.now()}`,
      name: formData.name!,
      category: formData.category!,
      quantity: formData.quantity!,
      unit: formData.unit!,
      unit_cost: formData.unit_cost,
      notes: formData.notes,
      marker: formData.marker
    }

    onAddItem(item)
    
    // Reset form if not editing
    if (!editingItem) {
      setFormData({
        name: '',
        category: 'Concrete',
        quantity: 0,
        unit: 'sq ft',
        unit_cost: undefined,
        notes: '',
        marker: undefined
      })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="item-name">Item Name *</Label>
        <Input
          id="item-name"
          placeholder="e.g., Foundation Slab"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className="mt-1"
        />
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="quantity">Quantity *</Label>
          <Input
            id="quantity"
            type="number"
            placeholder="0"
            value={formData.quantity || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="unit">Unit *</Label>
          <Select
            value={formData.unit}
            onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
          >
            <SelectTrigger id="unit" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map(unit => (
                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="unit-cost">Unit Cost (optional)</Label>
        <Input
          id="unit-cost"
          type="number"
          placeholder="0.00"
          value={formData.unit_cost || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, unit_cost: parseFloat(e.target.value) || undefined }))}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Additional details..."
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
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
          onClick={() => {
            onPlaceMarker()
            // This will be updated when marker is placed via parent
          }}
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
        {editingItem && onCancelEdit && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancelEdit}
          >
            Cancel
          </Button>
        )}
        <Button
          className="flex-1 bg-blue-600 hover:bg-blue-700"
          onClick={handleSubmit}
        >
          <Plus className="h-4 w-4 mr-2" />
          {editingItem ? 'Update Item' : 'Add Item'}
        </Button>
      </div>
    </div>
  )
}

