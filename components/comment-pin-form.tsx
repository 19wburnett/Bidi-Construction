'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { MessageSquare, X, CheckCircle, AlertCircle, Lightbulb } from 'lucide-react'

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
      <DialogContent className="max-w-md w-[95vw] md:w-full p-4 md:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 md:pb-4">
          <DialogTitle className="flex items-center space-x-2 text-base md:text-lg">
            <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
            <span>Add Comment</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 md:space-y-4 pt-2">
          <div className="text-xs md:text-sm text-gray-600">
            Position: Page {pageNumber} at ({Math.round(x)}, {Math.round(y)})
          </div>

          <div>
            <Label className="block mb-2">Note Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button
                type="button"
                variant={formData.noteType === 'requirement' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, noteType: 'requirement' }))}
                className="h-auto py-3 flex flex-col items-center gap-1.5"
                size="sm"
              >
                <CheckCircle className="h-5 w-5" />
                <span className="text-xs">Requirement</span>
              </Button>
              <Button
                type="button"
                variant={formData.noteType === 'concern' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, noteType: 'concern' }))}
                className="h-auto py-3 flex flex-col items-center gap-1.5"
                size="sm"
              >
                <AlertCircle className="h-5 w-5" />
                <span className="text-xs">Concern</span>
              </Button>
              <Button
                type="button"
                variant={formData.noteType === 'suggestion' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, noteType: 'suggestion' }))}
                className="h-auto py-3 flex flex-col items-center gap-1.5"
                size="sm"
              >
                <Lightbulb className="h-5 w-5" />
                <span className="text-xs">Suggestion</span>
              </Button>
              <Button
                type="button"
                variant={formData.noteType === 'other' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, noteType: 'other' }))}
                className="h-auto py-3 flex flex-col items-center gap-1.5"
                size="sm"
              >
                <MessageSquare className="h-5 w-5" />
                <span className="text-xs">Other</span>
              </Button>
            </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div>
              <Label htmlFor="category" className="text-xs md:text-sm">Category (optional)</Label>
              <Input
                id="category"
                placeholder="e.g., Electrical, Plumbing"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="h-9 md:h-10"
              />
            </div>
            <div>
              <Label htmlFor="location" className="text-xs md:text-sm">Location (optional)</Label>
              <Input
                id="location"
                placeholder="e.g., Floor 2, Room A"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="h-9 md:h-10"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse md:flex-row justify-end gap-2 md:space-x-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 md:h-auto w-full md:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.content.trim()} className="h-10 md:h-auto w-full md:w-auto">
              Save Comment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
