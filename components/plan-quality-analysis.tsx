'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle, 
  FileQuestion, 
  Ruler, 
  Eye,
  FileX,
  HelpCircle,
  CheckCircle2
} from 'lucide-react'
import { TakeoffItem } from './takeoff-accordion'

interface PlanQualityAnalysisProps {
  items: TakeoffItem[]
  missingInformation?: Array<{
    item_id?: string
    item_name: string
    category: string
    missing_data: string
    why_needed: string
    where_to_find: string
    impact: 'critical' | 'high' | 'medium' | 'low'
  }>
  qualityAnalysis?: {
    completeness?: {
      missing_dimensions?: string[]
      missing_specifications?: string[]
      missing_schedules?: string[]
    }
    notes?: string
  }
}

interface QualityIssue {
  type: 'unmeasurable' | 'missing_dimension' | 'missing_spec' | 'missing_from_plans'
  title: string
  description: string
  impact: 'critical' | 'high' | 'medium' | 'low'
  itemName?: string
  suggestion?: string
}

export default function PlanQualityAnalysis({
  items,
  missingInformation = [],
  qualityAnalysis
}: PlanQualityAnalysisProps) {
  // Analyze items and missing info to extract plan quality issues
  const qualityIssues = useMemo(() => {
    const issues: QualityIssue[] = []

    // Find items that need measurement (quantity = 0)
    const unmeasurableItems = items.filter(item => 
      item.quantity === 0 || item.needs_measurement === true
    )

    // Group unmeasurable items by reason
    const unmeasurableReasons = new Map<string, TakeoffItem[]>()
    unmeasurableItems.forEach(item => {
      const reason = item.notes || item.measurement_instructions || 'Quantity not determinable from plans'
      const existing = unmeasurableReasons.get(reason) || []
      unmeasurableReasons.set(reason, [...existing, item])
    })

    // Add unmeasurable issues
    unmeasurableReasons.forEach((itemsList, reason) => {
      if (itemsList.length > 0) {
        issues.push({
          type: 'unmeasurable',
          title: `${itemsList.length} item${itemsList.length > 1 ? 's' : ''} cannot be measured from plans`,
          description: reason,
          impact: itemsList.length >= 5 ? 'high' : itemsList.length >= 2 ? 'medium' : 'low',
          suggestion: 'Use the measurement tools or refer to specifications/schedules'
        })
      }
    })

    // Process missing information for plan-level issues
    const planLevelMissing = missingInformation.filter(mi => 
      mi.category === 'measurement' || 
      mi.where_to_find?.toLowerCase().includes('not shown') ||
      mi.where_to_find?.toLowerCase().includes('not visible') ||
      mi.where_to_find?.toLowerCase().includes('missing from')
    )

    planLevelMissing.forEach(mi => {
      issues.push({
        type: 'missing_from_plans',
        title: mi.missing_data,
        description: mi.why_needed,
        impact: mi.impact,
        itemName: mi.item_name,
        suggestion: mi.where_to_find
      })
    })

    // Add quality analysis issues if available
    if (qualityAnalysis?.completeness) {
      qualityAnalysis.completeness.missing_dimensions?.forEach(dim => {
        issues.push({
          type: 'missing_dimension',
          title: dim,
          description: 'Dimension not shown on plans',
          impact: 'medium',
          suggestion: 'Check specifications or request clarification from architect'
        })
      })

      qualityAnalysis.completeness.missing_specifications?.forEach(spec => {
        issues.push({
          type: 'missing_spec',
          title: spec,
          description: 'Specification not included in plans',
          impact: 'medium',
          suggestion: 'Check project manual or specification documents'
        })
      })

      qualityAnalysis.completeness.missing_schedules?.forEach(schedule => {
        issues.push({
          type: 'missing_from_plans',
          title: `Missing ${schedule}`,
          description: 'Schedule not found in plan set',
          impact: 'high',
          suggestion: 'Request updated plans with required schedules'
        })
      })
    }

    // Sort by impact
    const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return issues.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact])
  }, [items, missingInformation, qualityAnalysis])

  // Summary stats
  const stats = useMemo(() => {
    const unmeasurableCount = items.filter(i => i.quantity === 0 || i.needs_measurement).length
    const criticalCount = qualityIssues.filter(i => i.impact === 'critical').length
    const highCount = qualityIssues.filter(i => i.impact === 'high').length
    
    return {
      totalIssues: qualityIssues.length,
      unmeasurable: unmeasurableCount,
      critical: criticalCount,
      high: highCount,
      measurableItems: items.length - unmeasurableCount
    }
  }, [items, qualityIssues])

  // If no issues, show success state
  if (qualityIssues.length === 0 && stats.unmeasurable === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-800 text-base">
            <CheckCircle2 className="h-5 w-5" />
            Plan Quality: Good
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-700">
            All {items.length} items have measurable quantities and no critical information is missing from the plans.
          </p>
        </CardContent>
      </Card>
    )
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'unmeasurable': return <Ruler className="h-4 w-4 text-orange-600" />
      case 'missing_dimension': return <Eye className="h-4 w-4 text-yellow-600" />
      case 'missing_spec': return <FileQuestion className="h-4 w-4 text-blue-600" />
      case 'missing_from_plans': return <FileX className="h-4 w-4 text-red-600" />
      default: return <HelpCircle className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Plan Quality Analysis
        </CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
            {stats.measurableItems} items ready
          </Badge>
          {stats.unmeasurable > 0 && (
            <Badge variant="outline" className="text-xs bg-orange-50 border-orange-300 text-orange-700">
              {stats.unmeasurable} need measurement
            </Badge>
          )}
          {stats.critical > 0 && (
            <Badge variant="outline" className="text-xs bg-red-50 border-red-300 text-red-700">
              {stats.critical} critical
            </Badge>
          )}
          {stats.high > 0 && (
            <Badge variant="outline" className="text-xs bg-orange-50 border-orange-300 text-orange-700">
              {stats.high} high priority
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary message */}
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          <p>
            {stats.unmeasurable > 0 ? (
              <>
                <strong>{stats.unmeasurable} items</strong> need quantities entered manually because they couldn't be determined from the plans.
                Click on the <Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-50 border-blue-200 text-blue-700 mx-1">
                  <Ruler className="h-2.5 w-2.5 mr-0.5 inline" />Needs Qty
                </Badge> badge on each item in the spreadsheet to see measurement instructions.
              </>
            ) : (
              'All quantities could be determined from the plans.'
            )}
          </p>
        </div>

        {/* Issues list */}
        {qualityIssues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Information Not Found in Plans
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {qualityIssues.slice(0, 10).map((issue, idx) => (
                <div
                  key={idx}
                  className={`p-3 border rounded-lg ${
                    issue.impact === 'critical' ? 'bg-red-50/50 border-red-200' :
                    issue.impact === 'high' ? 'bg-orange-50/50 border-orange-200' :
                    'bg-yellow-50/50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {getTypeIcon(issue.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">{issue.title}</span>
                        <Badge variant="outline" className={`text-[10px] ${getImpactColor(issue.impact)}`}>
                          {issue.impact}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{issue.description}</p>
                      {issue.itemName && (
                        <p className="text-xs text-gray-500 mt-1">
                          Affects: <span className="font-medium">{issue.itemName}</span>
                        </p>
                      )}
                      {issue.suggestion && (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <HelpCircle className="h-3 w-3" />
                          {issue.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {qualityIssues.length > 10 && (
                <p className="text-xs text-gray-500 text-center py-2">
                  + {qualityIssues.length - 10} more issues
                </p>
              )}
            </div>
          </div>
        )}

        {/* Quality notes */}
        {qualityAnalysis?.notes && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">{qualityAnalysis.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
