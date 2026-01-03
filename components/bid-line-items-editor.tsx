'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit2, Save, X, Package, Hammer, Wrench, FileText, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BidLineItem {
  id: string
  item_number: number
  description: string
  category: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number
  notes: string | null
  is_optional?: boolean | null
  option_group?: string | null
}

interface BidLineItemsEditorProps {
  bidId: string
  lineItems: BidLineItem[]
  onItemAdded: () => void
  onItemUpdated: () => void
  onItemDeleted: () => void
  loading?: boolean
}

const CATEGORIES = [
  { value: 'labor', label: 'Labor', icon: Hammer },
  { value: 'materials', label: 'Materials', icon: Package },
  { value: 'equipment', label: 'Equipment', icon: Wrench },
  { value: 'permits', label: 'Permits', icon: FileText },
  { value: 'other', label: 'Other', icon: DollarSign }
]

const UNITS = ['sq ft', 'sq yd', 'cubic ft', 'cubic yd', 'linear ft', 'hours', 'days', 'each', 'lump sum']

export default function BidLineItemsEditor({
  bidId,
  lineItems: initialLineItems,
  onItemAdded,
  onItemUpdated,
  onItemDeleted,
  loading = false
}: BidLineItemsEditorProps) {
  const [lineItems, setLineItems] = useState<BidLineItem[]>(initialLineItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')
  // Track which optional items are selected
  const [selectedOptionalItems, setSelectedOptionalItems] = useState<Set<string>>(new Set())

  // Form state for adding/editing
  const [formData, setFormData] = useState<Partial<BidLineItem>>({
    description: '',
    category: null,
    quantity: null,
    unit: null,
    unit_price: null,
    amount: 0,
    notes: null,
    is_optional: false,
    option_group: null
  })

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const calculateAmount = (qty: string, unitPrice: string) => {
    const q = parseFloat(qty) || 0
    const up = parseFloat(unitPrice) || 0
    return q * up
  }

  const handleAddNew = () => {
    setIsAdding(true)
    setEditingId(null)
    setFormData({
      description: '',
      category: null,
      quantity: null,
      unit: null,
      unit_price: null,
      amount: 0,
      notes: null,
      is_optional: false,
      option_group: null
    })
    setError('')
  }

  const handleEdit = (item: BidLineItem) => {
    setEditingId(item.id)
    setIsAdding(false)
    setFormData({
      description: item.description,
      category: item.category || null,
      quantity: item.quantity || null,
      unit: item.unit || null,
      unit_price: item.unit_price || null,
      amount: item.amount,
      notes: item.notes || null,
      is_optional: item.is_optional || false,
      option_group: item.option_group || null
    })
    setError('')
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({
      description: '',
      category: null,
      quantity: null,
      unit: null,
      unit_price: null,
      amount: 0,
      notes: null,
      is_optional: false,
      option_group: null
    })
    setError('')
  }

  const handleSave = async () => {
    setError('')
    
    if (!formData.description?.trim()) {
      setError('Description is required')
      return
    }

    if (!formData.amount && formData.amount !== 0) {
      setError('Amount is required')
      return
    }

    setSaving(true)

    try {
      if (isAdding) {
        // Add new item
        const response = await fetch(`/api/bids/${bidId}/line-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: formData.description,
            category: formData.category,
            quantity: formData.quantity,
            unit: formData.unit,
            unit_price: formData.unit_price,
            amount: formData.amount,
            notes: formData.notes,
            is_optional: formData.is_optional,
            option_group: formData.option_group || null
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to add line item')
        }

        onItemAdded()
      } else if (editingId) {
        // Update existing item
        const response = await fetch(`/api/bids/${bidId}/line-items`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: editingId,
            description: formData.description,
            category: formData.category,
            quantity: formData.quantity,
            unit: formData.unit,
            unit_price: formData.unit_price,
            amount: formData.amount,
            notes: formData.notes,
            is_optional: formData.is_optional,
            option_group: formData.option_group || null
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to update line item')
        }

        onItemUpdated()
      }

      handleCancel()
    } catch (err: any) {
      setError(err.message || 'Failed to save line item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this line item?')) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/bids/${bidId}/line-items?item_id=${itemId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete line item')
      }

      onItemDeleted()
    } catch (err: any) {
      setError(err.message || 'Failed to delete line item')
    } finally {
      setSaving(false)
    }
  }

  const updateFormField = (field: keyof BidLineItem, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      
      // Auto-calculate amount if quantity and unit_price are provided
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? value : (prev.quantity || 0)
        const unitPrice = field === 'unit_price' ? value : (prev.unit_price || 0)
        if (qty && unitPrice) {
          updated.amount = calculateAmount(String(qty), String(unitPrice))
        }
      }
      
      return updated
    })
  }

  // Group items by option_group for display
  const groupedItems = lineItems.reduce((acc, item) => {
    const group = item.option_group || 'standard'
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(item)
    return acc
  }, {} as Record<string, BidLineItem[]>)

  const standardItems = groupedItems['standard'] || []
  const optionGroups = Object.keys(groupedItems).filter(g => g !== 'standard')

  // Toggle optional item selection
  const toggleOptionalItem = (itemId: string) => {
    setSelectedOptionalItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  // Calculate totals
  const standardTotal = standardItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  const selectedOptionalTotal = lineItems
    .filter(item => item.is_optional && selectedOptionalItems.has(item.id))
    .reduce((sum, item) => sum + (item.amount || 0), 0)
  const grandTotal = standardTotal + selectedOptionalTotal

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Standard Items */}
      {standardItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Standard Items</h4>
          <div className="space-y-2">
            {standardItems.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                {editingId === item.id ? (
                  <EditForm
                    formData={formData}
                    updateFormField={updateFormField}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    saving={saving}
                  />
                ) : (
                  <ItemDisplay
                    item={item}
                    onEdit={() => handleEdit(item)}
                    onDelete={() => handleDelete(item.id)}
                    formatCurrency={formatCurrency}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Option Groups */}
      {optionGroups.map((groupName) => (
        <div key={groupName} className="space-y-2 border-l-4 border-l-orange-400 pl-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
              {groupName}
            </Badge>
            <span className="text-sm text-gray-600">Optional</span>
          </div>
          <div className="space-y-2">
            {groupedItems[groupName].map((item) => {
              const isSelected = selectedOptionalItems.has(item.id)
              return (
                <div 
                  key={item.id} 
                  className={`border rounded-lg p-4 ${
                    isSelected 
                      ? 'bg-orange-100 border-orange-400' 
                      : 'bg-orange-50/30 border-orange-200'
                  }`}
                >
                  {editingId === item.id ? (
                    <EditForm
                      formData={formData}
                      updateFormField={updateFormField}
                      onSave={handleSave}
                      onCancel={handleCancel}
                      saving={saving}
                    />
                  ) : (
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`optional-${item.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleOptionalItem(item.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <ItemDisplay
                          item={item}
                          onEdit={() => handleEdit(item)}
                          onDelete={() => handleDelete(item.id)}
                          formatCurrency={formatCurrency}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Add New Item Form */}
      {isAdding && (
        <div className="border-2 border-dashed border-orange-300 rounded-lg p-4 bg-orange-50/30">
          <EditForm
            formData={formData}
            updateFormField={updateFormField}
            onSave={handleSave}
            onCancel={handleCancel}
            saving={saving}
          />
        </div>
      )}

      {/* Add Button */}
      {!isAdding && (
        <Button
          type="button"
          variant="outline"
          onClick={handleAddNew}
          disabled={saving || loading}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Line Item
        </Button>
      )}

      {/* Total Summary */}
      <div className="border-t-2 border-gray-300 pt-4 mt-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Standard Items Total:</span>
            <span className="font-semibold">{formatCurrency(standardTotal)}</span>
          </div>
          {selectedOptionalTotal > 0 && (
            <div className="flex justify-between items-center text-sm text-orange-700">
              <span>Selected Optional Items:</span>
              <span className="font-semibold">{formatCurrency(selectedOptionalTotal)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-lg font-bold text-gray-900">
              Grand Total {selectedOptionalTotal > 0 ? '(with selected options)' : ''}:
            </span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ItemDisplay({
  item,
  onEdit,
  onDelete,
  formatCurrency
}: {
  item: BidLineItem
  onEdit: () => void
  onDelete: () => void
  formatCurrency: (amount: number | null) => string
}) {
  const categoryConfig = CATEGORIES.find(c => c.value === item.category) || CATEGORIES[CATEGORIES.length - 1]
  const CategoryIcon = categoryConfig.icon

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">#{item.item_number}</span>
          <span className="text-sm font-semibold">{item.description}</span>
          {item.is_optional && (
            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
              Optional
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          {item.category && (
            <div className="flex items-center gap-1">
              <CategoryIcon className="h-3 w-3" />
              <span>{categoryConfig.label}</span>
            </div>
          )}
          {item.quantity && item.unit && (
            <span>
              {item.quantity} {item.unit}
            </span>
          )}
          {item.unit_price && (
            <span>@ {formatCurrency(item.unit_price)}</span>
          )}
        </div>
        {item.notes && (
          <p className="text-xs text-gray-500 italic">{item.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-lg font-semibold text-orange-600">
            {formatCurrency(item.amount)}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEdit}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function EditForm({
  formData,
  updateFormField,
  onSave,
  onCancel,
  saving
}: {
  formData: Partial<BidLineItem>
  updateFormField: (field: keyof BidLineItem, value: any) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="description">Description *</Label>
          <Input
            id="description"
            value={formData.description || ''}
            onChange={(e) => updateFormField('description', e.target.value)}
            placeholder="Item description"
            required
          />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category || ''}
            onValueChange={(value) => updateFormField('category', value || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={formData.amount || 0}
            onChange={(e) => updateFormField('amount', parseFloat(e.target.value) || 0)}
            required
          />
        </div>

        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            step="0.01"
            min="0"
            value={formData.quantity || ''}
            onChange={(e) => updateFormField('quantity', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="0"
          />
        </div>

        <div>
          <Label htmlFor="unit">Unit</Label>
          <Select
            value={formData.unit || ''}
            onValueChange={(value) => updateFormField('unit', value || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="unit_price">Unit Price</Label>
          <Input
            id="unit_price"
            type="number"
            step="0.01"
            min="0"
            value={formData.unit_price || ''}
            onChange={(e) => updateFormField('unit_price', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="0.00"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes || ''}
            onChange={(e) => updateFormField('notes', e.target.value || null)}
            placeholder="Additional notes..."
            rows={2}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 pt-2 border-t">
        <div className="flex items-center gap-2">
          <Checkbox
            id="is_optional"
            checked={formData.is_optional || false}
            onCheckedChange={(checked) => updateFormField('is_optional', checked)}
          />
          <Label htmlFor="is_optional" className="cursor-pointer">
            Mark as optional
          </Label>
        </div>

        {formData.is_optional && (
          <div className="flex-1">
            <Label htmlFor="option_group">Option Group</Label>
            <Input
              id="option_group"
              value={formData.option_group || ''}
              onChange={(e) => updateFormField('option_group', e.target.value || null)}
              placeholder="e.g., Option A, Option B"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
