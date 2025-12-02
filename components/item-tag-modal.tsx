'use client'

import { useState, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import { ITEM_TYPES, getItemTypesByCategory, CATEGORY_LABELS, type ItemTypeDefinition } from '@/lib/item-types'

interface ItemTagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  x: number
  y: number
  pageNumber: number
  onSave: (item: {
    itemType: string
    itemLabel?: string
    itemNotes?: string
    itemCategory?: string
  }) => void
  editingItem?: {
    itemType: string
    itemLabel?: string
    itemNotes?: string
    itemCategory?: string
  } | null
  onSetForQuickTagging?: (item: {
    itemType: string
    itemLabel?: string
    itemCategory?: string
  }) => void
}

export default function ItemTagModal({
  open,
  onOpenChange,
  x,
  y,
  pageNumber,
  onSave,
  editingItem,
  onSetForQuickTagging
}: ItemTagModalProps) {
  const [formData, setFormData] = useState({
    itemType: editingItem?.itemType || '',
    itemLabel: editingItem?.itemLabel || '',
    itemNotes: editingItem?.itemNotes || '',
    itemCategory: editingItem?.itemCategory || ''
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Reset form when modal opens/closes or editing item changes
  useEffect(() => {
    if (open) {
      if (editingItem) {
        setFormData({
          itemType: editingItem.itemType || '',
          itemLabel: editingItem.itemLabel || '',
          itemNotes: editingItem.itemNotes || '',
          itemCategory: editingItem.itemCategory || ''
        })
      } else {
        setFormData({
          itemType: '',
          itemLabel: '',
          itemNotes: '',
          itemCategory: ''
        })
      }
      setSearchQuery('')
      setSelectedCategory('all')
    }
  }, [open, editingItem])

  // Filter item types based on search and category
  const filteredItemTypes = useMemo(() => {
    let filtered = ITEM_TYPES

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(type => type.category === selectedCategory)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(type =>
        type.label.toLowerCase().includes(query) ||
        type.id.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [searchQuery, selectedCategory])

  // Group filtered types by category for display
  const groupedTypes = useMemo(() => {
    const grouped: Record<string, ItemTypeDefinition[]> = {}
    filteredItemTypes.forEach(type => {
      if (!grouped[type.category]) {
        grouped[type.category] = []
      }
      grouped[type.category].push(type)
    })
    return grouped
  }, [filteredItemTypes])

  const selectedItemType = ITEM_TYPES.find(type => type.id === formData.itemType)

  const handleSave = () => {
    if (!formData.itemType) {
      alert('Please select an item type')
      return
    }

    const selectedType = ITEM_TYPES.find(type => type.id === formData.itemType)
    const category = selectedType?.category || formData.itemCategory || undefined

    onSave({
      itemType: formData.itemType,
      itemLabel: formData.itemLabel.trim() || undefined,
      itemNotes: formData.itemNotes.trim() || undefined,
      itemCategory: category
    })

    // Reset form
    setFormData({
      itemType: '',
      itemLabel: '',
      itemNotes: '',
      itemCategory: ''
    })
    setSearchQuery('')
    setSelectedCategory('all')
    onOpenChange(false)
  }

  const handleCancel = () => {
    setFormData({
      itemType: '',
      itemLabel: '',
      itemNotes: '',
      itemCategory: ''
    })
    setSearchQuery('')
    setSelectedCategory('all')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] md:w-full p-4 md:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 md:pb-4">
          <DialogTitle className="flex items-center space-x-2 text-base md:text-lg">
            <span>{editingItem ? 'Edit Item' : 'Tag Item'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="text-xs md:text-sm text-gray-600">
            Position: Page {pageNumber} at ({Math.round(x)}, {Math.round(y)})
          </div>

          {/* Category Filter */}
          <div>
            <Label className="block mb-2">Filter by Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div>
            <Label className="block mb-2">Search Item Types</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search for item types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Item Type Selection */}
          <div>
            <Label className="block mb-2">Item Type *</Label>
            <div className="border rounded-lg p-3 max-h-[300px] overflow-y-auto">
              {filteredItemTypes.length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">
                  No item types found. Try a different search.
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedTypes).map(([category, types]) => (
                    <div key={category}>
                      <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                        {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {types.map(type => {
                          const Icon = type.icon
                          const isSelected = formData.itemType === type.id
                          return (
                            <Button
                              key={type.id}
                              type="button"
                              variant={isSelected ? 'default' : 'outline'}
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  itemType: type.id,
                                  itemCategory: type.category
                                }))
                              }}
                              className="h-auto py-3 flex flex-col items-center gap-1.5"
                              style={isSelected ? { backgroundColor: type.color, borderColor: type.color } : {}}
                            >
                              <Icon className="h-5 w-5" />
                              <span className="text-xs text-center">{type.label}</span>
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedItemType && (
              <div className="mt-2 text-xs text-gray-600">
                Selected: <span className="font-medium">{selectedItemType.label}</span>
              </div>
            )}
          </div>

          {/* Custom Item Type Option */}
          <div>
            <Label className="block mb-2">Or Enter Custom Type</Label>
            <Input
              placeholder="e.g., Custom Fixture"
              value={formData.itemType.startsWith('custom_') ? formData.itemType.replace('custom_', '') : ''}
              onChange={(e) => {
                const customType = e.target.value.trim()
                setFormData(prev => ({
                  ...prev,
                  itemType: customType ? `custom_${customType}` : '',
                  itemCategory: prev.itemCategory || 'other'
                }))
              }}
              className="h-10"
            />
          </div>

          {/* Optional Label */}
          <div>
            <Label htmlFor="itemLabel" className="text-xs md:text-sm">Label/Name (optional)</Label>
            <Input
              id="itemLabel"
              placeholder="e.g., Main Entry Door"
              value={formData.itemLabel}
              onChange={(e) => setFormData(prev => ({ ...prev, itemLabel: e.target.value }))}
              className="h-10"
            />
          </div>

          {/* Optional Notes */}
          <div>
            <Label htmlFor="itemNotes" className="text-xs md:text-sm">Notes (optional)</Label>
            <Textarea
              id="itemNotes"
              placeholder="Add any notes about this item..."
              value={formData.itemNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, itemNotes: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse md:flex-row justify-end gap-2 md:space-x-2 pt-2">
            <Button variant="outline" onClick={handleCancel} className="h-10 md:h-auto w-full md:w-auto">
              Cancel
            </Button>
            {editingItem && onSetForQuickTagging && (
              <Button 
                variant="secondary" 
                onClick={() => {
                  const selectedType = ITEM_TYPES.find(type => type.id === formData.itemType)
                  const category = selectedType?.category || formData.itemCategory || undefined
                  onSetForQuickTagging({
                    itemType: formData.itemType,
                    itemCategory: category,
                    itemLabel: formData.itemLabel.trim() || undefined
                  })
                  onOpenChange(false)
                }} 
                disabled={!formData.itemType}
                className="h-10 md:h-auto w-full md:w-auto"
              >
                Add More of This Type
              </Button>
            )}
            <Button onClick={handleSave} disabled={!formData.itemType} className="h-10 md:h-auto w-full md:w-auto">
              {editingItem ? 'Update Item' : 'Tag Item'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

