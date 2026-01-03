'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, XCircle, Info, GitCompare } from 'lucide-react'

export interface ReviewFinding {
  item_name: string
  status: string
  missing_information?: Array<{
    category: string
    missing_data: string
    why_needed: string
    where_to_find: string
    impact: 'critical' | 'high' | 'medium' | 'low'
  }>
  cost_code_issues?: string
  quantity_calculable: boolean
  notes?: string
}

export interface MissingItem {
  item_name: string
  category: string
  reason: string
  location: string
  cost_code: string
  impact: 'critical' | 'high' | 'medium' | 'low'
  source: 'reviewer1' | 'reviewer2' | 'both'
}

interface TakeoffReviewPanelProps {
  reviewFindings?: {
    reviewed_items?: ReviewFinding[]
    missing_items?: MissingItem[]
    summary?: {
      items_reviewed: number
      items_with_issues: number
      missing_items_found: number
      critical_issues: number
      notes: string
    }
  }
  onAcceptFinding?: (finding: ReviewFinding | MissingItem) => void
  onRejectFinding?: (finding: ReviewFinding | MissingItem) => void
}

export default function TakeoffReviewPanel({
  reviewFindings,
  onAcceptFinding,
  onRejectFinding
}: TakeoffReviewPanelProps) {
  if (!reviewFindings) {
    return null
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    if (status === 'complete') {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    }
    if (status.includes('missing')) {
      return <AlertCircle className="h-4 w-4 text-red-600" />
    }
    return <Info className="h-4 w-4 text-yellow-600" />
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="h-5 w-5" />
          AI Review Findings
        </CardTitle>
        {reviewFindings.summary && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              {reviewFindings.summary.items_reviewed} Items Reviewed
            </Badge>
            <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
              {reviewFindings.summary.items_with_issues} With Issues
            </Badge>
            <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">
              {reviewFindings.summary.missing_items_found} Missing Items Found
            </Badge>
            <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">
              {reviewFindings.summary.critical_issues} Critical Issues
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Missing Items Section */}
        {reviewFindings.missing_items && reviewFindings.missing_items.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              Missing Items Found ({reviewFindings.missing_items.length})
            </h4>
            <div className="space-y-2">
              {reviewFindings.missing_items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 border rounded-lg bg-red-50/50 border-red-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.item_name}</div>
                      <div className="text-xs text-gray-600 mt-1">{item.reason}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${getImpactColor(item.impact)}`}>
                          {item.impact} impact
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {item.source === 'both' ? 'Both Reviewers' : item.source === 'reviewer1' ? 'Reviewer 1' : 'Reviewer 2'}
                        </Badge>
                      </div>
                      {item.location && (
                        <div className="text-xs text-gray-500 mt-1">
                          Location: {item.location}
                        </div>
                      )}
                    </div>
                    {onAcceptFinding && onRejectFinding && (
                      <div className="flex gap-2 ml-2">
                        <button
                          onClick={() => onAcceptFinding(item)}
                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                          title="Accept"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onRejectFinding(item)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded"
                          title="Reject"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Items with Issues Section */}
        {reviewFindings.reviewed_items && reviewFindings.reviewed_items.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              Items with Issues ({reviewFindings.reviewed_items.filter(i => i.status !== 'complete').length})
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {reviewFindings.reviewed_items
                .filter(item => item.status !== 'complete')
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 border rounded-lg bg-yellow-50/50 border-yellow-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <span className="font-medium text-sm">{item.item_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.status}
                          </Badge>
                          {!item.quantity_calculable && (
                            <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">
                              Cannot Calculate Quantity
                            </Badge>
                          )}
                        </div>
                        {item.missing_information && item.missing_information.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {item.missing_information.map((missing, midx) => (
                              <div key={midx} className="text-xs text-gray-600 pl-4 border-l-2 border-yellow-300">
                                <div className="font-medium">{missing.missing_data}</div>
                                <div className="text-gray-500">Why: {missing.why_needed}</div>
                                <div className="text-gray-500">Where: {missing.where_to_find}</div>
                                <Badge variant="outline" className={`text-xs mt-1 ${getImpactColor(missing.impact)}`}>
                                  {missing.impact} impact
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                        {item.cost_code_issues && (
                          <div className="text-xs text-red-600 mt-1">
                            Cost Code Issue: {item.cost_code_issues}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-xs text-gray-500 mt-1">{item.notes}</div>
                        )}
                      </div>
                      {onAcceptFinding && onRejectFinding && (
                        <div className="flex gap-2 ml-2">
                          <button
                            onClick={() => onAcceptFinding(item)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                            title="Accept"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onRejectFinding(item)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {reviewFindings.summary?.notes && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">{reviewFindings.summary.notes}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
