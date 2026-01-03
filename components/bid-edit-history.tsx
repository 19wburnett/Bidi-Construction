'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { History, User, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
// Format time ago helper (replacement for date-fns)
const formatTimeAgo = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

interface BidEditHistoryProps {
  bidId: string
}

interface EditHistoryEntry {
  id: string
  edited_by: string
  edited_at: string
  field_name: string
  old_value: any
  new_value: any
  change_type: 'field_update' | 'line_item_add' | 'line_item_update' | 'line_item_delete'
  notes: string | null
  edited_by_user?: {
    id: string
    email: string
  }
}

export default function BidEditHistory({ bidId }: BidEditHistoryProps) {
  const [history, setHistory] = useState<EditHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (bidId) {
      loadHistory()
    }
  }, [bidId])

  const loadHistory = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/bids/${bidId}/edit-history`)
      if (!response.ok) {
        throw new Error('Failed to load edit history')
      }
      const data = await response.json()
      setHistory(data.history || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load edit history')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'Not set'
    if (typeof value === 'number') {
      if (value === 0) return '$0.00'
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value)
    }
    if (typeof value === 'string') return value
    if (typeof value === 'object') {
      // For line items
      if (value.description) {
        return `${value.description} - ${formatValue(value.amount)}`
      }
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'field_update':
        return 'Field Updated'
      case 'line_item_add':
        return 'Line Item Added'
      case 'line_item_update':
        return 'Line Item Updated'
      case 'line_item_delete':
        return 'Line Item Deleted'
      default:
        return type
    }
  }

  const getFieldLabel = (fieldName: string) => {
    switch (fieldName) {
      case 'bid_amount':
        return 'Bid Amount'
      case 'timeline':
        return 'Timeline'
      case 'notes':
        return 'Notes'
      case 'line_item':
        return 'Line Item'
      default:
        return fieldName
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-orange-600" />
            Edit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Loading history...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-orange-600" />
            Edit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">{error}</div>
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-orange-600" />
            Edit History
          </CardTitle>
          <CardDescription>No edit history available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-orange-600" />
          Edit History
        </CardTitle>
        <CardDescription>
          Complete audit trail of all changes made to this bid
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry) => {
            const isExpanded = expandedItems.has(entry.id)
            const editedDate = new Date(entry.edited_at)
            const timeAgo = formatTimeAgo(editedDate)

            return (
              <div
                key={entry.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {getChangeTypeLabel(entry.change_type)}
                      </Badge>
                      <span className="text-sm font-medium text-gray-700">
                        {getFieldLabel(entry.field_name)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{entry.edited_by_user?.email || 'Unknown user'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{timeAgo}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="pt-3 border-t space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">Previous Value</div>
                        <div className="text-sm bg-gray-50 p-2 rounded border">
                          {formatValue(entry.old_value)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">New Value</div>
                        <div className="text-sm bg-orange-50 p-2 rounded border border-orange-200">
                          {formatValue(entry.new_value)}
                        </div>
                      </div>
                    </div>
                    {entry.notes && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">Notes</div>
                        <div className="text-sm text-gray-700 italic">{entry.notes}</div>
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      {editedDate.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
