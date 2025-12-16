'use client'

import React, { useMemo, useState } from 'react'
import { X, DollarSign, TrendingUp, TrendingDown, Minus, Download, FileSpreadsheet, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { exportToCSV, exportToExcel } from '@/lib/takeoff-export'

interface Bid {
  id: string
  bid_amount: number | null
  subcontractors?: {
    name: string
    trade_category: string | null
  } | null
  gc_contacts?: {
    name: string
    trade_category: string
  } | null
  bid_packages?: {
    trade_category: string
  } | null
}

interface Scenario {
  id: string
  name: string
  description: string | null
  is_active: boolean
  bids: Bid[]
}

interface ScenarioComparisonModalProps {
  isOpen: boolean
  onClose: () => void
  scenarios: Scenario[]
}

export default function ScenarioComparisonModal({
  isOpen,
  onClose,
  scenarios
}: ScenarioComparisonModalProps) {
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([])

  // Calculate totals for each scenario
  const scenarioTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    scenarios.forEach(scenario => {
      totals[scenario.id] = scenario.bids.reduce((sum, bid) => {
        return sum + (bid.bid_amount || 0)
      }, 0)
    })
    return totals
  }, [scenarios])

  // Get selected scenarios
  const selectedScenarios = useMemo(() => {
    return scenarios.filter(s => selectedScenarioIds.includes(s.id))
  }, [scenarios, selectedScenarioIds])

  // Compare scenarios
  const comparison = useMemo(() => {
    if (selectedScenarios.length < 2) return null

    const comparison: {
      commonBids: Set<string>
      uniqueBids: Record<string, Set<string>>
      tradeBreakdown: Record<string, {
        scenarios: Record<string, number>
        total: number
      }>
    } = {
      commonBids: new Set(),
      uniqueBids: {},
      tradeBreakdown: {}
    }

    // Get all bid IDs for each scenario
    const scenarioBidIds: Record<string, Set<string>> = {}
    selectedScenarios.forEach(scenario => {
      scenarioBidIds[scenario.id] = new Set(scenario.bids.map(b => b.id))
      comparison.uniqueBids[scenario.id] = new Set()
    })

    // Find common bids (bids that appear in all scenarios)
    if (selectedScenarios.length > 0) {
      const firstScenarioBids = scenarioBidIds[selectedScenarios[0].id]
      firstScenarioBids.forEach(bidId => {
        const isInAll = selectedScenarios.every(s => scenarioBidIds[s.id].has(bidId))
        if (isInAll) {
          comparison.commonBids.add(bidId)
        }
      })
    }

    // Find unique bids for each scenario
    selectedScenarios.forEach(scenario => {
      scenario.bids.forEach(bid => {
        const isCommon = comparison.commonBids.has(bid.id)
        const isInOtherScenarios = selectedScenarios.some(s => 
          s.id !== scenario.id && scenarioBidIds[s.id].has(bid.id)
        )
        
        if (!isCommon && !isInOtherScenarios) {
          comparison.uniqueBids[scenario.id].add(bid.id)
        }
      })
    })

    // Trade breakdown
    selectedScenarios.forEach(scenario => {
      scenario.bids.forEach(bid => {
        const tradeCategory = bid.subcontractors?.trade_category || 
                             bid.gc_contacts?.trade_category || 
                             bid.bid_packages?.trade_category || 
                             'Other'
        
        if (!comparison.tradeBreakdown[tradeCategory]) {
          comparison.tradeBreakdown[tradeCategory] = {
            scenarios: {},
            total: 0
          }
        }
        
        const amount = bid.bid_amount || 0
        comparison.tradeBreakdown[tradeCategory].scenarios[scenario.id] = 
          (comparison.tradeBreakdown[tradeCategory].scenarios[scenario.id] || 0) + amount
        comparison.tradeBreakdown[tradeCategory].total += amount
      })
    })

    return comparison
  }, [selectedScenarios])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const handleExport = (format: 'csv' | 'excel') => {
    if (!comparison || selectedScenarios.length < 2) return

    const exportData: any[] = []

    // Add summary
    exportData.push({
      Type: 'Summary',
      Scenario: '',
      Trade: '',
      Bidder: '',
      Amount: '',
      Status: ''
    })

    selectedScenarios.forEach(scenario => {
      exportData.push({
        Type: 'Total',
        Scenario: scenario.name,
        Trade: '',
        Bidder: '',
        Amount: scenarioTotals[scenario.id],
        Status: scenario.is_active ? 'Active' : 'Inactive'
      })
    })

    // Add trade breakdown
    exportData.push({ Type: '', Scenario: '', Trade: '', Bidder: '', Amount: '', Status: '' })
    exportData.push({
      Type: 'Trade Breakdown',
      Scenario: '',
      Trade: '',
      Bidder: '',
      Amount: '',
      Status: ''
    })

    Object.entries(comparison.tradeBreakdown).forEach(([trade, data]) => {
      selectedScenarios.forEach(scenario => {
        const amount = data.scenarios[scenario.id] || 0
        exportData.push({
          Type: 'Trade',
          Scenario: scenario.name,
          Trade: trade,
          Bidder: '',
          Amount: amount,
          Status: ''
        })
      })
    })

    // Add bid details
    exportData.push({ Type: '', Scenario: '', Trade: '', Bidder: '', Amount: '', Status: '' })
    exportData.push({
      Type: 'Bid Details',
      Scenario: '',
      Trade: '',
      Bidder: '',
      Amount: '',
      Status: ''
    })

    selectedScenarios.forEach(scenario => {
      scenario.bids.forEach(bid => {
        const isCommon = comparison.commonBids.has(bid.id)
        const isUnique = comparison.uniqueBids[scenario.id]?.has(bid.id)
        const status = isCommon ? 'Common' : isUnique ? 'Unique' : 'Partial'
        
        exportData.push({
          Type: 'Bid',
          Scenario: scenario.name,
          Trade: bid.subcontractors?.trade_category || bid.gc_contacts?.trade_category || 'Other',
          Bidder: bid.subcontractors?.name || bid.gc_contacts?.name || 'Unknown',
          Amount: bid.bid_amount || 0,
          Status: status
        })
      })
    })

    if (format === 'csv') {
      exportToCSV(exportData)
    } else {
      exportToExcel(exportData)
    }
  }

  // Calculate variance
  const getVariance = (scenario1Total: number, scenario2Total: number) => {
    const diff = scenario2Total - scenario1Total
    const percent = scenario1Total > 0 ? (diff / scenario1Total) * 100 : 0
    return { diff, percent }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Compare Budget Scenarios</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Select 2-3 scenarios to compare side-by-side
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Scenario Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Scenarios to Compare</label>
            <div className="grid grid-cols-2 gap-2">
              {scenarios.map(scenario => {
                const isSelected = selectedScenarioIds.includes(scenario.id)
                return (
                  <Card
                    key={scenario.id}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50'
                        : 'hover:border-gray-300'
                    } ${selectedScenarioIds.length >= 3 && !isSelected ? 'opacity-50' : ''}`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedScenarioIds(selectedScenarioIds.filter(id => id !== scenario.id))
                      } else if (selectedScenarioIds.length < 3) {
                        setSelectedScenarioIds([...selectedScenarioIds, scenario.id])
                      }
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm">{scenario.name}</div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(scenarioTotals[scenario.id])} • {scenario.bids.length} bids
                          </div>
                        </div>
                        {isSelected && (
                          <Badge variant="outline" className="border-orange-300 text-orange-700">
                            Selected
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Comparison */}
          {selectedScenarios.length >= 2 && comparison && (
            <>
              {/* Totals Comparison */}
              <div className="grid grid-cols-2 gap-4">
                {selectedScenarios.map((scenario, index) => {
                  const total = scenarioTotals[scenario.id]
                  const prevTotal = index > 0 ? scenarioTotals[selectedScenarios[index - 1].id] : null
                  const variance = prevTotal ? getVariance(prevTotal, total) : null

                  return (
                    <Card key={scenario.id}>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{scenario.name}</h3>
                            {scenario.is_active && (
                              <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                                Active
                              </Badge>
                            )}
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {formatCurrency(total)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {scenario.bids.length} {scenario.bids.length === 1 ? 'bid' : 'bids'}
                          </div>
                          {variance && (
                            <div className={`flex items-center gap-1 text-sm ${
                              variance.diff > 0 ? 'text-red-600' : variance.diff < 0 ? 'text-green-600' : 'text-gray-600'
                            }`}>
                              {variance.diff > 0 ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : variance.diff < 0 ? (
                                <TrendingDown className="h-4 w-4" />
                              ) : (
                                <Minus className="h-4 w-4" />
                              )}
                              {variance.diff > 0 ? '+' : ''}{formatCurrency(variance.diff)} ({variance.percent > 0 ? '+' : ''}{variance.percent.toFixed(1)}%)
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Common vs Unique Bids */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 text-green-700">Common Bids</h3>
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      {comparison.commonBids.size}
                    </div>
                    <div className="text-sm text-gray-600">
                      Bids in all scenarios
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 text-orange-700">Unique Bids</h3>
                    <div className="space-y-2">
                      {selectedScenarios.map(scenario => {
                        const uniqueCount = comparison.uniqueBids[scenario.id]?.size || 0
                        return (
                          <div key={scenario.id} className="flex items-center justify-between">
                            <span className="text-sm">{scenario.name}:</span>
                            <Badge variant="secondary">{uniqueCount}</Badge>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Trade Breakdown */}
              <div className="space-y-2">
                <h3 className="font-semibold">Trade Breakdown</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Trade</th>
                        {selectedScenarios.map(scenario => (
                          <th key={scenario.id} className="px-4 py-2 text-right text-xs font-semibold text-gray-500">
                            {scenario.name}
                          </th>
                        ))}
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.entries(comparison.tradeBreakdown).map(([trade, data]) => (
                        <tr key={trade}>
                          <td className="px-4 py-2 text-sm font-medium">{trade}</td>
                          {selectedScenarios.map(scenario => (
                            <td key={scenario.id} className="px-4 py-2 text-sm text-right">
                              {formatCurrency(data.scenarios[scenario.id] || 0)}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-sm font-semibold text-right">
                            {formatCurrency(data.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('csv')}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('excel')}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Export Excel
                </Button>
              </div>
            </>
          )}

          {selectedScenarios.length < 2 && (
            <div className="text-center py-8 text-gray-500">
              Select at least 2 scenarios to compare
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

