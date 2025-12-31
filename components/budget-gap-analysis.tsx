'use client'

import React, { useMemo } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Bid {
  id: string
  bid_amount: number | null
  status: string | null
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
  subcontractor?: string | null
}

interface BudgetGapAnalysisProps {
  bids: Bid[]
  takeoffItems: TakeoffItem[]
  bidPackages?: Array<{ trade_category: string }>
  scenarioBidIds?: Set<string>
  onCreateBidPackage?: (tradeCategory: string) => void
  onViewBids?: (tradeCategory: string) => void
  onAddToScenario?: (tradeCategory: string) => Promise<void>
}

export default function BudgetGapAnalysis({
  bids,
  takeoffItems,
  bidPackages = [],
  scenarioBidIds,
  onCreateBidPackage,
  onViewBids,
  onAddToScenario
}: BudgetGapAnalysisProps) {
  // Simplified gap analysis - just summary stats
  const gapAnalysis = useMemo(() => {
    // Get all unique trades from takeoff items
    const takeoffTrades = new Set<string>()
    takeoffItems.forEach(item => {
      const trade = item.subcontractor || item.category
      if (trade) {
        takeoffTrades.add(trade)
      }
    })

    // Get trades from bid packages
    bidPackages.forEach(pkg => {
      if (pkg.trade_category) {
        takeoffTrades.add(pkg.trade_category)
      }
    })

    // Get trades with accepted bids
    const tradesWithAcceptedBids = new Set<string>()
    bids.forEach(bid => {
      if (bid.status === 'accepted') {
        const tradeCategory = bid.subcontractors?.trade_category || 
                             bid.gc_contacts?.trade_category || 
                             bid.bid_packages?.trade_category
        if (tradeCategory) {
          tradesWithAcceptedBids.add(tradeCategory)
        }
      }
    })

    // Calculate gaps
    const totalTrades = takeoffTrades.size
    const coveredTrades = Array.from(takeoffTrades).filter(trade => 
      tradesWithAcceptedBids.has(trade)
    ).length
    const gaps = totalTrades - coveredTrades
    const coveragePercentage = totalTrades > 0 ? Math.round((coveredTrades / totalTrades) * 100) : 0

    return {
      totalTrades,
      coveredTrades,
      gaps,
      coveragePercentage
    }
  }, [bids, takeoffItems, bidPackages])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Budget Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-orange-50/50 border border-orange-200 rounded-lg">
            <div className="text-2xl font-bold text-orange-900">
              {gapAnalysis.coveragePercentage}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Coverage</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-orange-50/50 border border-orange-200 rounded-lg">
            <div className="text-2xl font-bold text-orange-900">
              {gapAnalysis.coveredTrades} / {gapAnalysis.totalTrades}
            </div>
            <div className="text-sm text-gray-600 mt-1">Trades Covered</div>
          </div>
        </div>
        {gapAnalysis.gaps > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-900">
              {gapAnalysis.gaps} {gapAnalysis.gaps === 1 ? 'trade' : 'trades'} still need bids
            </span>
          </div>
        )}
        {gapAnalysis.gaps === 0 && gapAnalysis.totalTrades > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-900">
              All trades have accepted bids!
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

