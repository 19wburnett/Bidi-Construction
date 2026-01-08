'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Tag, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X,
  Palette
} from 'lucide-react'
import { MeasurementTagPersistence, MeasurementTag } from '@/lib/measurement-tag-persistence'

interface MeasurementTagManagerProps {
  planId: string
  userId?: string
  guestUser?: { id: string; name: string }
  selectedTagId: string | null
  onTagSelect: (tagId: string | null) => void
  onTagChange?: () => void
}

const AVAILABLE_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#a855f7', // Violet
  '#eab308', // Yellow
  '#64748b', // Slate
  '#dc2626', // Dark Red
  '#16a34a', // Dark Green
]

export default function MeasurementTagManager({
  planId,
  userId,
  guestUser,
  selectedTagId,
  onTagSelect,
  onTagChange
}: MeasurementTagManagerProps) {
  const [tags, setTags] = useState<MeasurementTag[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(AVAILABLE_COLORS[0])
  const [editTagName, setEditTagName] = useState('')
  const [editTagColor, setEditTagColor] = useState(AVAILABLE_COLORS[0])
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null)
  const [deleteConfirming, setDeleteConfirming] = useState<string | null>(null)

  const tagPersistence = new MeasurementTagPersistence(planId, userId, guestUser)

  const loadTags = useCallback(async () => {
    setLoading(true)
    try {
      const loadedTags = await tagPersistence.loadTags()
      setTags(loadedTags)
    } catch (error) {
      console.error('Error loading tags:', error)
    } finally {
      setLoading(false)
    }
  }, [planId, userId, guestUser])

  useEffect(() => {
    loadTags()
  }, [loadTags])

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    setCreating(true)
    try {
      const newTag = await tagPersistence.createTag(newTagName.trim(), newTagColor)
      if (newTag) {
        await loadTags()
        setNewTagName('')
        setNewTagColor(AVAILABLE_COLORS[0])
        onTagChange?.()
      }
    } catch (error) {
      console.error('Error creating tag:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleEditTag = async (tagId: string) => {
    if (!editTagName.trim()) return

    try {
      const updated = await tagPersistence.updateTag(tagId, editTagName.trim(), editTagColor)
      if (updated) {
        await loadTags()
        setEditingId(null)
        setEditTagName('')
        setEditTagColor(AVAILABLE_COLORS[0])
        onTagChange?.()
      }
    } catch (error) {
      console.error('Error updating tag:', error)
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    try {
      const deleted = await tagPersistence.deleteTag(tagId)
      if (deleted) {
        await loadTags()
        if (selectedTagId === tagId) {
          onTagSelect(null)
        }
        setDeleteConfirming(null)
        onTagChange?.()
      }
    } catch (error) {
      console.error('Error deleting tag:', error)
    }
  }

  const startEdit = (tag: MeasurementTag) => {
    setEditingId(tag.id)
    setEditTagName(tag.name)
    setEditTagColor(tag.color)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTagName('')
    setEditTagColor(AVAILABLE_COLORS[0])
  }

  if (loading) {
    return (
      <div className="p-2 text-sm text-gray-500">
        Loading tags...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Tag List */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {tags.length === 0 ? (
          <div className="text-xs text-gray-500 p-2 text-center">
            No tags yet. Create one to start tagging measurements.
          </div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                selectedTagId === tag.id
                  ? 'bg-blue-100 border border-blue-300'
                  : 'hover:bg-gray-100 border border-transparent'
              }`}
            >
              {editingId === tag.id ? (
                <>
                  <input
                    type="color"
                    value={editTagColor}
                    onChange={(e) => setEditTagColor(e.target.value)}
                    className="w-6 h-6 rounded border border-gray-300 cursor-pointer"
                  />
                  <Input
                    value={editTagName}
                    onChange={(e) => setEditTagName(e.target.value)}
                    className="flex-1 h-7 text-sm"
                    placeholder="Tag name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleEditTag(tag.id)
                      } else if (e.key === 'Escape') {
                        cancelEdit()
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleEditTag(tag.id)}
                  >
                    <Check className="h-3 w-3 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={cancelEdit}
                  >
                    <X className="h-3 w-3 text-gray-500" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    className="flex items-center gap-2 flex-1 min-w-0"
                    onClick={() => onTagSelect(selectedTagId === tag.id ? null : tag.id)}
                  >
                    <div
                      className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm font-medium text-gray-700 truncate">
                      {tag.name}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => startEdit(tag)}
                    title="Edit tag"
                  >
                    <Edit2 className="h-3 w-3 text-gray-500" />
                  </Button>
                  {deleteConfirming === tag.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleDeleteTag(tag.id)}
                        title="Confirm delete"
                      >
                        <Check className="h-3 w-3 text-red-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setDeleteConfirming(null)}
                        title="Cancel"
                      >
                        <X className="h-3 w-3 text-gray-500" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setDeleteConfirming(tag.id)}
                      title="Delete tag"
                    >
                      <Trash2 className="h-3 w-3 text-gray-500" />
                    </Button>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create New Tag */}
      <div className="border-t border-gray-200 pt-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">Create New Tag</div>
              
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Tag Name</label>
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="e.g., LVP Flooring"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateTag()
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block">Color</label>
                <div className="grid grid-cols-8 gap-2">
                  {AVAILABLE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 ${
                        newTagColor === color
                          ? 'border-gray-900 shadow-md ring-2 ring-offset-1 ring-gray-400'
                          : 'border-gray-300 hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    >
                      {newTagColor === color && (
                        <Check className="h-3 w-3 text-white m-auto drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-full h-8 rounded border border-gray-300 cursor-pointer"
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || creating}
                className="w-full"
                size="sm"
              >
                {creating ? 'Creating...' : 'Create Tag'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}