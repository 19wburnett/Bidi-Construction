'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageSquare, X } from 'lucide-react'

interface CommentPinFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  x: number
  y: number
  pageNumber: number
  onSave: (comment: {
    noteType: 'requirement' | 'concern' | 'suggestion' | 'other'
    content: string
    category?: string
    location?: string
  }) => void
}

export default function CommentPinForm({
  open,
  onOpenChange,
  x,
  y,
  pageNumber,
  onSave
}: CommentPinFormProps) {
  const [formData, setFormData] = useState({
    noteType: 'other' as 'requirement' | 'concern' | 'suggestion' | 'other',
    content: '',
    category: '',
    location: ''
  })

  const handleSave = () => {
    if (!formData.content.trim()) {
      alert('Please enter comment content')
      return
    }

    onSave({
      noteType: formData.noteType,
      content: formData.content,
      category: formData.category || undefined,
      location: formData.location || undefined
    })

    // Reset form
    setFormData({
      noteType: 'other',
      content: '',
      category: '',
      location: ''
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Add Comment</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Position: Page {pageNumber} at ({Math.round(x)}, {Math.round(y)})
          </div>

          <div>
            <Label htmlFor="noteType">Note Type</Label>
            <Select
              value={formData.noteType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, noteType: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="requirement">Requirement</SelectItem>
                <SelectItem value="concern">Concern</SelectItem>
                <SelectItem value="suggestion">Suggestion</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="content">Comment *</Label>
            <Textarea
              id="content"
              placeholder="Enter your comment..."
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category (optional)</Label>
              <Input
                id="category"
                placeholder="e.g., Electrical, Plumbing"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                placeholder="e.g., Floor 2, Room A"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.content.trim()}>
              Save Comment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
