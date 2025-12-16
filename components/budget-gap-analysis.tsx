'use client'

import React, { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Bid {
  id: string
  bid_amount: number | null
  subcontractors?: {
    trade_category: string | null
  } | null
  gc_contacts?: {
    trade_category: string
  } | null
  bid_packages?: {
    trade_category: string
  } | null
}

interface TakeoffItem {
  id: string
  category: string
}

interface BudgetGapAnalysisProps {
  bids: Bid[]
  scenarioBidIds?: Set<string>
  takeoffItems: TakeoffItem[]
  bidPackages?: Array<{ trade_category: string }>
  onCreateBidPackage?: (tradeCategory: string) => void
  onViewBids?: (tradeCategory: string) => void
  onAddToScenario?: (tradeCategory: string) => void
}

export default function BudgetGapAnalysis({
  bids,
  scenarioBidIds,
  takeoffItems,
  bidPackages = [],
  onCreateBidPackage,
  onViewBids,
  onAddToScenario
}: BudgetGapAnalysisProps) {
  // Analyze gaps based on actual subcontractor trade categories
  const gapAnalysis = useMemo(() => {
    // Get all unique trade categories from bid packages (these are the trades needed for the job)
    const requiredTrades = new Set<string>()
    bidPackages.forEach(pkg => {
      if (pkg.trade_category) {
        requiredTrades.add(pkg.trade_category)
      }
    })

    // Also get trades from bids (in case there are bids without packages)
    bids.forEach(bid => {
      const tradeCategory = bid.subcontractors?.trade_category || 
                           bid.gc_contacts?.trade_category || 
                           bid.bid_packages?.trade_category
      if (tradeCategory) {
        requiredTrades.add(tradeCategory)
      }
    })

    // Get trades with bids (all bids, not just scenario) - using actual trade categories
    const tradesWithBids = new Set<string>()
    const tradesWithScenarioBids = new Set<string>()
    const tradeBidCounts: Record<string, number> = {}
    const tradeScenarioBidCounts: Record<string, number> = {}

    bids.forEach(bid => {
      const tradeCategory = bid.subcontractors?.trade_category || 
                           bid.gc_contacts?.trade_category || 
                           bid.bid_packages?.trade_category
      
      if (!tradeCategory) return
      
      tradesWithBids.add(tradeCategory)
      tradeBidCounts[tradeCategory] = (tradeBidCounts[tradeCategory] || 0) + 1

      if (scenarioBidIds?.has(bid.id)) {
        tradesWithScenarioBids.add(tradeCategory)
        tradeScenarioBidCounts[tradeCategory] = (tradeScenarioBidCounts[tradeCategory] || 0) + 1
      }
    })

    // Categorize trades based on actual trade categories
    const tradesNoBids: string[] = []
    const tradesWithBidsNotInScenario: string[] = []
    const tradesCovered: string[] = []

    // Check all required trades
    requiredTrades.forEach(trade => {
      if (!tradesWithBids.has(trade)) {
        tradesNoBids.push(trade)
      } else if (!tradesWithScenarioBids.has(trade)) {
        tradesWithBidsNotInScenario.push(trade)
      } else {
        tradesCovered.push(trade)
      }
    })

    // Also include trades that have bids but aren't in required trades (extra coverage)
    tradesWithBids.forEach(trade => {
      if (!requiredTrades.has(trade) && tradesWithScenarioBids.has(trade)) {
        tradesCovered.push(trade)
      }
    })

    // Calculate coverage
    const totalTrades = requiredTrades.size
    const coveredTrades = tradesCovered.filter(t => requiredTrades.has(t)).length
    const coveragePercentage = totalTrades > 0 ? Math.round((coveredTrades / totalTrades) * 100) : 0

    return {
      tradesNoBids,
      tradesWithBidsNotInScenario,
      tradesCovered,
      tradeBidCounts,
      tradeScenarioBidCounts,
      coveragePercentage,
      totalTrades,
      coveredTrades
    }
  }, [bids, scenarioBidIds, bidPackages])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Gap Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Coverage Summary */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-50/50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Coverage</div>
              <div className="text-2xl font-bold text-orange-900">
                {gapAnalysis.coveragePercentage}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Trades Covered</div>
              <div className="text-2xl font-bold text-orange-900">
                {gapAnalysis.coveredTrades} / {gapAnalysis.totalTrades}
              </div>
            </div>
          </div>
        </div>

        {/* Trades with no bids */}
        {gapAnalysis.tradesNoBids.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              No Bids ({gapAnalysis.tradesNoBids.length})
            </h4>
            <div className="space-y-2">
              {gapAnalysis.tradesNoBids.map(trade => (
                <div
                  key={trade}
                  className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-900">
                      {trade}
                    </span>
                  </div>
                  {onCreateBidPackage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-100"
                      onClick={() => onCreateBidPackage(trade)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create Bid Package
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trades with bids but not in scenario */}
        {gapAnalysis.tradesWithBidsNotInScenario.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-yellow-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Available Bids Not in Scenario ({gapAnalysis.tradesWithBidsNotInScenario.length})
            </h4>
            <div className="space-y-2">
              {gapAnalysis.tradesWithBidsNotInScenario.map(trade => {
                const availableCount = gapAnalysis.tradeBidCounts[trade] || 0
                return (
                  <div
                    key={trade}
                    className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium text-yellow-900">
                        {trade}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {availableCount} {availableCount === 1 ? 'bid' : 'bids'} available
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {onViewBids && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                          onClick={() => onViewBids(trade)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Bids
                        </Button>
                      )}
                      {onAddToScenario && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-orange-300 text-orange-700 hover:bg-orange-100"
                          onClick={() => onAddToScenario(trade)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add to Scenario
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Trades covered */}
        {gapAnalysis.tradesCovered.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Covered ({gapAnalysis.tradesCovered.length})
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {gapAnalysis.tradesCovered.map(trade => {
                const scenarioCount = gapAnalysis.tradeScenarioBidCounts[trade] || 0
                return (
                  <div
                    key={trade}
                    className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      <span className="text-sm font-medium text-green-900">
                        {trade}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                      {scenarioCount} {scenarioCount === 1 ? 'bid' : 'bids'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No gaps message */}
        {gapAnalysis.tradesNoBids.length === 0 && 
         gapAnalysis.tradesWithBidsNotInScenario.length === 0 && 
         gapAnalysis.tradesCovered.length > 0 && (
          <div className="text-center py-4 text-green-700">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <p className="text-sm font-medium">All trades have bids in this scenario!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

