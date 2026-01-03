'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DollarSign, Calendar, FileText, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BidEditFormProps {
  bid: {
    id: string
    bid_amount: number | null
    timeline: string | null
    notes: string | null
  }
  onSave: (data: { bid_amount: number | null; timeline: string | null; notes: string | null; edit_notes?: string }) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function BidEditForm({ bid, onSave, onCancel, loading = false }: BidEditFormProps) {
  const [bidAmount, setBidAmount] = useState<string>(bid.bid_amount?.toString() || '')
  const [timeline, setTimeline] = useState<string>(bid.timeline || '')
  const [notes, setNotes] = useState<string>(bid.notes || '')
  const [editNotes, setEditNotes] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const bidAmountValue = bidAmount.trim() === '' ? null : parseFloat(bidAmount)
      if (bidAmountValue !== null && (isNaN(bidAmountValue) || bidAmountValue < 0)) {
        setError('Bid amount must be a valid positive number')
        setSaving(false)
        return
      }

      await onSave({
        bid_amount: bidAmountValue,
        timeline: timeline.trim() || null,
        notes: notes.trim() || null,
        edit_notes: editNotes.trim() || undefined
      })
    } catch (err: any) {
      setError(err.message || 'Failed to save changes')
      setSaving(false)
    }
  }

  const originalAmount = bid.bid_amount?.toString() || ''
  const originalTimeline = bid.timeline || ''
  const originalNotes = bid.notes || ''

  const hasChanges = 
    bidAmount !== originalAmount ||
    timeline !== originalTimeline ||
    notes !== originalNotes

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Bid Amount */}
      <div className="space-y-2">
        <Label htmlFor="bid_amount" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-orange-600" />
          Bid Amount
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">$</span>
          <Input
            id="bid_amount"
            type="number"
            step="0.01"
            min="0"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder="0.00"
            className={cn(
              "flex-1",
              bidAmount !== originalAmount && "border-orange-300 bg-orange-50"
            )}
          />
        </div>
        {bidAmount !== originalAmount && (
          <p className="text-xs text-gray-500">
            Original: {originalAmount ? `$${parseFloat(originalAmount).toLocaleString()}` : 'Not set'}
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <Label htmlFor="timeline" className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-orange-600" />
          Timeline
        </Label>
        <Input
          id="timeline"
          type="text"
          value={timeline}
          onChange={(e) => setTimeline(e.target.value)}
          placeholder="e.g., 2-3 weeks, 30 days"
          className={cn(
            timeline !== originalTimeline && "border-orange-300 bg-orange-50"
          )}
        />
        {timeline !== originalTimeline && (
          <p className="text-xs text-gray-500">
            Original: {originalTimeline || 'Not set'}
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-orange-600" />
          Notes
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes about this bid..."
          rows={4}
          className={cn(
            notes !== originalNotes && "border-orange-300 bg-orange-50"
          )}
        />
        {notes !== originalNotes && (
          <p className="text-xs text-gray-500">
            Original: {originalNotes || 'Not set'}
          </p>
        )}
      </div>

      {/* Edit Notes (optional reason for edit) */}
      <div className="space-y-2">
        <Label htmlFor="edit_notes" className="text-sm text-gray-600">
          Reason for Edit (optional)
        </Label>
        <Textarea
          id="edit_notes"
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          placeholder="e.g., Updated after phone conversation with subcontractor..."
          rows={2}
          className="text-sm"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving || loading}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!hasChanges || saving || loading}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving || loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
