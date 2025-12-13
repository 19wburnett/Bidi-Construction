'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GitCompare, X, AlertCircle } from 'lucide-react'

interface AIAnalysisResult {
  summary: string
  bestValue?: {
    bidId: string
    bidderName: string
    reasoning: string
  }
  keyDifferences?: string[]
  keyFindings?: string[]
  recommendations: string[]
  priceBreakdown?: {
    totalVariance: number
    averageUnitCost: Record<string, number>
    priceRange: Record<string, { min: number; max: number; variance: number }>
  }
  priceAnalysis?: {
    takeoffTotal: number
    bidTotal: number
    variance: number
    variancePercentage: number
    averageUnitCostDifference: number
  }
  scopeAnalysis?: {
    missingItems: Array<{ bidId: string; items: string[] }>
    extraItems: Array<{ bidId: string; items: string[] }>
    coverageGaps: string[]
  }
  scopeCoverage?: {
    matchedItems: number
    missingItems: number
    extraItems: number
    coveragePercentage: number
  }
  riskAssessment: {
    lowBidRisks?: Array<{ bidId: string; concerns: string[] }>
    highBidRisks?: Array<{ bidId: string; concerns: string[] }>
    qualityIndicators?: Record<string, string>
    scopeGaps?: string[]
    potentialChangeOrders?: string[]
    qualityConcerns?: string[]
  }
  negotiationPoints?: Array<{
    bidId: string
    bidderName: string
    points: string[]
  }>
  costPerUnitAnalysis?: Record<string, {
    item: string
    prices: Record<string, number>
    average: number
    variance: number
  }>
  missingItems?: Array<{
    takeoffItem: { description: string; quantity: number; unit: string; unit_cost: number }
    reason: string
  }>
  extraItems?: Array<{
    bidItem: { description: string; quantity: number; unit: string; unit_price: number }
    reason: string
  }>
  quantityDiscrepancies?: Array<{
    takeoffItem: any
    bidItem: any
    variance: number
    impact: string
  }>
  priceDiscrepancies?: Array<{
    takeoffItem: any
    bidItem: any
    variance: number
    impact: string
  }>
}

interface Bid {
  id: string
  subcontractors?: {
    name: string
  } | null
  gc_contacts?: {
    name: string
  } | null
  subcontractor_email?: string
}

interface BidComparisonAISidebarProps {
  isOpen: boolean
  onClose: () => void
  loading: boolean
  error: string | null
  analysis: AIAnalysisResult | null
  bids: Bid[]
  onRetry?: () => void
}

export function BidComparisonAISidebar({
  isOpen,
  onClose,
  loading,
  error,
  analysis,
  bids,
  onRetry,
}: BidComparisonAISidebarProps) {
  if (!isOpen) return null

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white border-l shadow-xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
        <h3 className="text-lg font-bold text-gray-900">AI Analysis</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-4"></div>
            <p className="text-gray-500">Generating AI analysis...</p>
          </div>
        ) : error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">Error generating analysis</p>
              </div>
              <p className="text-sm text-red-600 mt-2">{error}</p>
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={onRetry}
                >
                  Retry
                </Button>
              )}
            </CardContent>
          </Card>
        ) : analysis ? (
          <>
            {/* Executive Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{analysis.summary}</p>
              </CardContent>
            </Card>

            {/* Best Value */}
            {analysis.bestValue && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-base text-green-900">Best Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold text-green-900 mb-2">
                    {analysis.bestValue.bidderName}
                  </p>
                  <p className="text-sm text-green-800">{analysis.bestValue.reasoning}</p>
                </CardContent>
              </Card>
            )}

            {/* Scope Coverage (for takeoff analysis) */}
            {analysis.scopeCoverage && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Scope Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Matched Items</div>
                      <div className="text-2xl font-bold text-green-600">{analysis.scopeCoverage.matchedItems}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Coverage</div>
                      <div className="text-2xl font-bold text-blue-600">{analysis.scopeCoverage.coveragePercentage}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Missing</div>
                      <div className="text-2xl font-bold text-red-600">{analysis.scopeCoverage.missingItems}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Extra Items</div>
                      <div className="text-2xl font-bold text-orange-600">{analysis.scopeCoverage.extraItems}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Price Analysis (for takeoff analysis) */}
            {analysis.priceAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Price Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Takeoff Total</span>
                      <span className="font-semibold text-blue-600">${analysis.priceAnalysis.takeoffTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Bid Total</span>
                      <span className="font-semibold text-green-600">${analysis.priceAnalysis.bidTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm font-medium text-gray-700">Variance</span>
                      <span className={`font-bold ${analysis.priceAnalysis.variancePercentage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {analysis.priceAnalysis.variancePercentage > 0 ? '+' : ''}{analysis.priceAnalysis.variancePercentage.toFixed(1)}%
                        <span className="text-sm font-normal ml-1">(${Math.abs(analysis.priceAnalysis.variance).toLocaleString()})</span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Differences or Key Findings */}
            {(analysis.keyDifferences || analysis.keyFindings) && ((analysis.keyDifferences?.length ?? 0) > 0 || (analysis.keyFindings?.length ?? 0) > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{analysis.keyFindings ? 'Key Findings' : 'Key Differences'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(analysis.keyFindings || analysis.keyDifferences || []).map((item: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-orange-600 mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Risk Assessment */}
            {analysis.riskAssessment && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Risk Assessment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.riskAssessment.lowBidRisks && analysis.riskAssessment.lowBidRisks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-orange-700 mb-2">Low Bid Risks</h4>
                      {analysis.riskAssessment.lowBidRisks.map((risk: any, idx: number) => (
                        <div key={idx} className="mb-3 p-2 bg-orange-50 rounded">
                          <p className="text-xs font-medium text-orange-900 mb-1">
                            {bids.find(b => b.id === risk.bidId)?.subcontractors?.name || 
                             bids.find(b => b.id === risk.bidId)?.gc_contacts?.name || 
                             risk.bidId}
                          </p>
                          <ul className="space-y-1">
                            {risk.concerns.map((concern: string, cIdx: number) => (
                              <li key={cIdx} className="text-xs text-orange-800">• {concern}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {analysis.riskAssessment.highBidRisks && analysis.riskAssessment.highBidRisks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-700 mb-2">High Bid Risks</h4>
                      {analysis.riskAssessment.highBidRisks.map((risk: any, idx: number) => (
                        <div key={idx} className="mb-3 p-2 bg-red-50 rounded">
                          <p className="text-xs font-medium text-red-900 mb-1">
                            {bids.find(b => b.id === risk.bidId)?.subcontractors?.name || 
                             bids.find(b => b.id === risk.bidId)?.gc_contacts?.name || 
                             risk.bidId}
                          </p>
                          <ul className="space-y-1">
                            {risk.concerns.map((concern: string, cIdx: number) => (
                              <li key={cIdx} className="text-xs text-red-800">• {concern}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Negotiation Points */}
            {analysis.negotiationPoints && analysis.negotiationPoints.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Negotiation Points</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.negotiationPoints.map((np: any, idx: number) => (
                    <div key={idx} className="p-3 bg-blue-50 rounded">
                      <p className="text-sm font-semibold text-blue-900 mb-2">{np.bidderName}</p>
                      <ul className="space-y-1">
                        {np.points.map((point: string, pIdx: number) => (
                          <li key={pIdx} className="text-xs text-blue-800">• {point}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Scope Analysis (for bid-to-bid) */}
            {analysis.scopeAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Scope Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.scopeAnalysis.missingItems && analysis.scopeAnalysis.missingItems.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-700 mb-2">Missing Items</h4>
                      {analysis.scopeAnalysis.missingItems.map((missing: any, idx: number) => (
                        <div key={idx} className="mb-2 p-2 bg-red-50 rounded">
                          <p className="text-xs font-medium text-red-900 mb-1">
                            {bids.find(b => b.id === missing.bidId)?.subcontractors?.name || 
                             bids.find(b => b.id === missing.bidId)?.gc_contacts?.name || 
                             missing.bidId}
                          </p>
                          <ul className="space-y-1">
                            {missing.items.map((item: string, iIdx: number) => (
                              <li key={iIdx} className="text-xs text-red-800">• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {analysis.scopeAnalysis.extraItems && analysis.scopeAnalysis.extraItems.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-green-700 mb-2">Extra Items</h4>
                      {analysis.scopeAnalysis.extraItems.map((extra: any, idx: number) => (
                        <div key={idx} className="mb-2 p-2 bg-green-50 rounded">
                          <p className="text-xs font-medium text-green-900 mb-1">
                            {bids.find(b => b.id === extra.bidId)?.subcontractors?.name || 
                             bids.find(b => b.id === extra.bidId)?.gc_contacts?.name || 
                             extra.bidId}
                          </p>
                          <ul className="space-y-1">
                            {extra.items.map((item: string, iIdx: number) => (
                              <li key={iIdx} className="text-xs text-green-800">• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Missing Items (for takeoff analysis) */}
            {analysis.missingItems && analysis.missingItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Missing Items in Bid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.missingItems.map((missing: any, idx: number) => (
                      <div key={idx} className="p-2 bg-red-50 rounded border border-red-200">
                        <p className="text-sm font-medium text-red-900 mb-1">
                          {missing.takeoffItem?.description || 'Unknown item'}
                        </p>
                        <p className="text-xs text-red-700 mb-1">
                          {missing.takeoffItem?.quantity} {missing.takeoffItem?.unit} @ ${missing.takeoffItem?.unit_cost || 0}
                        </p>
                        <p className="text-xs text-red-600 italic">{missing.reason}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Extra Items (for takeoff analysis) */}
            {analysis.extraItems && analysis.extraItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Extra Items in Bid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.extraItems.map((extra: any, idx: number) => (
                      <div key={idx} className="p-2 bg-green-50 rounded border border-green-200">
                        <p className="text-sm font-medium text-green-900 mb-1">
                          {extra.bidItem?.description || 'Unknown item'}
                        </p>
                        <p className="text-xs text-green-700 mb-1">
                          {extra.bidItem?.quantity || 'N/A'} {extra.bidItem?.unit || ''} @ ${extra.bidItem?.unit_price || 0}
                        </p>
                        <p className="text-xs text-green-600 italic">{extra.reason}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quantity Discrepancies (for takeoff analysis) */}
            {analysis.quantityDiscrepancies && analysis.quantityDiscrepancies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quantity Discrepancies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.quantityDiscrepancies.map((disc: any, idx: number) => (
                      <div key={idx} className="p-2 bg-orange-50 rounded border border-orange-200">
                        <p className="text-sm font-medium text-orange-900 mb-1">
                          {disc.takeoffItem?.description || 'Unknown item'}
                        </p>
                        <p className="text-xs text-orange-700">
                          Variance: {disc.variance.toFixed(1)}% | {disc.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Price Discrepancies (for takeoff analysis) */}
            {analysis.priceDiscrepancies && analysis.priceDiscrepancies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Price Discrepancies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.priceDiscrepancies.map((disc: any, idx: number) => (
                      <div key={idx} className="p-2 bg-orange-50 rounded border border-orange-200">
                        <p className="text-sm font-medium text-orange-900 mb-1">
                          {disc.takeoffItem?.description || 'Unknown item'}
                        </p>
                        <p className="text-xs text-orange-700">
                          Variance: {disc.variance.toFixed(1)}% | {disc.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scope Gaps (for takeoff analysis) */}
            {analysis.riskAssessment?.scopeGaps && analysis.riskAssessment.scopeGaps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Scope Gaps</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.riskAssessment.scopeGaps.map((gap: string, idx: number) => (
                      <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Potential Change Orders (for takeoff analysis) */}
            {analysis.riskAssessment?.potentialChangeOrders && analysis.riskAssessment.potentialChangeOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Potential Change Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.riskAssessment.potentialChangeOrders.map((co: string, idx: number) => (
                      <li key={idx} className="text-sm text-orange-700 flex items-start gap-2">
                        <span className="text-orange-600 mt-1">•</span>
                        <span>{co}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Quality Concerns (for takeoff analysis) */}
            {analysis.riskAssessment?.qualityConcerns && analysis.riskAssessment.qualityConcerns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quality Concerns</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.riskAssessment.qualityConcerns.map((concern: string, idx: number) => (
                      <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{concern}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <GitCompare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">
                Select bids to compare and AI analysis will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

