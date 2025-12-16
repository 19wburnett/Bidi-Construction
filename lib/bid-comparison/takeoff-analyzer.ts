import { callAnalysisLLM } from '@/lib/llm/providers'
import type { TakeoffItem, MatchedTakeoffItem } from './takeoff-matcher'
import type { BidLineItem } from './ai-matcher'

export interface Bid {
  id: string
  bid_amount: number | null
  timeline: string | null
  notes: string | null
  subcontractors?: {
    name: string
    email: string
    trade_category: string | null
  } | null
  gc_contacts?: {
    name: string
    email: string
    trade_category: string
  } | null
}

export interface TakeoffAnalysisResult {
  summary: string
  scopeCoverage: {
    matchedItems: number
    missingItems: number
    extraItems: number
    coveragePercentage: number
  }
  priceAnalysis: {
    takeoffTotal: number
    bidTotal: number
    variance: number
    variancePercentage: number
    averageUnitCostDifference: number
  }
  keyFindings: string[]
  recommendations: string[]
  missingItems: Array<{
    takeoffItem: TakeoffItem
    reason: string
  }>
  extraItems: Array<{
    bidItem: BidLineItem
    reason: string
  }>
  quantityDiscrepancies: Array<{
    takeoffItem: TakeoffItem
    bidItem: BidLineItem
    variance: number
    impact: string
  }>
  priceDiscrepancies: Array<{
    takeoffItem: TakeoffItem
    bidItem: BidLineItem
    variance: number
    impact: string
  }>
  riskAssessment: {
    scopeGaps: string[]
    potentialChangeOrders: string[]
    qualityConcerns: string[]
  }
}

/**
 * Generate comprehensive AI analysis of takeoff to bid comparison
 */
export async function generateTakeoffAnalysis(
  selectedBid: Bid,
  takeoffItems: TakeoffItem[],
  bidLineItems: BidLineItem[],
  matches: MatchedTakeoffItem[]
): Promise<TakeoffAnalysisResult> {
  const systemPrompt = `You are an expert construction bid analyst with 20+ years of experience. Your task is to analyze how well a bid matches the takeoff/estimate.

Analyze the provided data and generate insights including:
1. Scope coverage analysis (what's matched, missing, extra)
2. Price analysis (total variance, unit cost differences)
3. Key findings and discrepancies
4. Recommendations for the general contractor
5. Risk assessment (scope gaps, potential change orders, quality concerns)

Be thorough, professional, and provide actionable insights. Consider:
- Items in takeoff but not in bid (scope gaps)
- Items in bid but not in takeoff (potential extras or scope creep)
- Quantity discrepancies that could lead to change orders
- Price discrepancies that might indicate quality differences
- Overall bid competitiveness vs takeoff estimate

Return your analysis as JSON with this exact structure:
{
  "summary": "Executive summary paragraph (2-3 sentences)",
  "scopeCoverage": {
    "matchedItems": number,
    "missingItems": number,
    "extraItems": number,
    "coveragePercentage": number
  },
  "priceAnalysis": {
    "takeoffTotal": number,
    "bidTotal": number,
    "variance": number,
    "variancePercentage": number,
    "averageUnitCostDifference": number
  },
  "keyFindings": ["Array of key findings"],
  "recommendations": ["Array of actionable recommendations"],
  "missingItems": [{"takeoffItem": {"description": "string", "quantity": number, "unit": "string", "unit_cost": number}, "reason": "why it's missing"}],
  "extraItems": [{"bidItem": {"description": "string", "quantity": number, "unit": "string", "unit_price": number}, "reason": "why it might be extra"}],
  "quantityDiscrepancies": [{"takeoffItem": {...}, "bidItem": {...}, "variance": number, "impact": "description"}],
  "priceDiscrepancies": [{"takeoffItem": {...}, "bidItem": {...}, "variance": number, "impact": "description"}],
  "riskAssessment": {
    "scopeGaps": ["Array of scope gaps identified"],
    "potentialChangeOrders": ["Array of potential change order items"],
    "qualityConcerns": ["Array of quality concerns"]
  }
}`

  const takeoffTotal = takeoffItems.reduce((sum, item) => sum + (item.quantity * (item.unit_cost || 0)), 0)
  const bidTotal = bidLineItems.reduce((sum, item) => sum + item.amount, 0)
  const matchedCount = matches.filter(m => m.bidItem !== null).length
  const missingCount = matches.filter(m => m.bidItem === null).length
  const extraBidItems = bidLineItems.filter(bidItem => !matches.some(m => m.bidItem?.id === bidItem.id))

  const userPrompt = `BID vs TAKEOFF COMPARISON ANALYSIS

Selected Bid:
- Bidder: ${selectedBid.subcontractors?.name || selectedBid.gc_contacts?.name || 'Unknown'}
- Total Amount: $${selectedBid.bid_amount || 'N/A'}
- Timeline: ${selectedBid.timeline || 'Not specified'}
- Trade: ${selectedBid.subcontractors?.trade_category || selectedBid.gc_contacts?.trade_category || 'Unknown'}

Takeoff Summary:
- Total Items: ${takeoffItems.length}
- Takeoff Total: $${takeoffTotal.toLocaleString()}
- Items: ${takeoffItems.map(item => `${item.description} (${item.quantity} ${item.unit} @ $${item.unit_cost || 0})`).join('; ')}

Bid Summary:
- Total Line Items: ${bidLineItems.length}
- Bid Total: $${bidTotal.toLocaleString()}
- Items: ${bidLineItems.map(item => `${item.description} (${item.quantity || 'N/A'} ${item.unit || ''} @ $${item.unit_price || 0})`).join('; ')}

Matching Results:
- Matched: ${matchedCount} items
- Missing from Bid: ${missingCount} takeoff items
- Extra in Bid: ${extraBidItems.length} items not in takeoff

Matched Items with Confidence:
${matches.filter(m => m.bidItem).map(m => `- Takeoff: "${m.takeoffItem.description}" → Bid: "${m.bidItem?.description}" (${m.confidence}% confidence, ${m.matchType} match)`).join('\n')}

Missing Items (in takeoff but not in bid):
${matches.filter(m => !m.bidItem).map(m => `- ${m.takeoffItem.description} (${m.takeoffItem.quantity} ${m.takeoffItem.unit})`).join('\n') || 'None'}

Extra Items (in bid but not in takeoff):
${extraBidItems.map(item => `- ${item.description} (${item.quantity || 'N/A'} ${item.unit || ''})`).join('\n') || 'None'}

Please provide comprehensive analysis of this comparison.`

  try {
    const response = await callAnalysisLLM(
      {
        systemPrompt,
        userPrompt,
        images: []
      },
      {
        temperature: 0.3,
        maxTokens: 4000
      }
    )

    const content = response.content.trim()
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response')
    }

    const analysis = JSON.parse(jsonMatch[0]) as TakeoffAnalysisResult

    // Validate and ensure all required fields exist
    return {
      summary: analysis.summary || 'Analysis generated successfully.',
      scopeCoverage: analysis.scopeCoverage || {
        matchedItems: matchedCount,
        missingItems: missingCount,
        extraItems: extraBidItems.length,
        coveragePercentage: takeoffItems.length > 0 ? Math.round((matchedCount / takeoffItems.length) * 100) : 0,
      },
      priceAnalysis: analysis.priceAnalysis || {
        takeoffTotal,
        bidTotal,
        variance: bidTotal - takeoffTotal,
        variancePercentage: takeoffTotal > 0 ? ((bidTotal - takeoffTotal) / takeoffTotal) * 100 : 0,
        averageUnitCostDifference: 0,
      },
      keyFindings: analysis.keyFindings || [],
      recommendations: analysis.recommendations || [],
      missingItems: analysis.missingItems || [],
      extraItems: analysis.extraItems || [],
      quantityDiscrepancies: analysis.quantityDiscrepancies || [],
      priceDiscrepancies: analysis.priceDiscrepancies || [],
      riskAssessment: analysis.riskAssessment || {
        scopeGaps: [],
        potentialChangeOrders: [],
        qualityConcerns: [],
      },
    }
  } catch (error) {
    console.error('Error generating takeoff analysis:', error)
    
    // Return a basic fallback analysis
    const variance = bidTotal - takeoffTotal
    const variancePercentage = takeoffTotal > 0 ? (variance / takeoffTotal) * 100 : 0
    
    return {
      summary: 'Analysis generation encountered an error. Please review comparison manually.',
      scopeCoverage: {
        matchedItems: matchedCount,
        missingItems: missingCount,
        extraItems: extraBidItems.length,
        coveragePercentage: takeoffItems.length > 0 ? Math.round((matchedCount / takeoffItems.length) * 100) : 0,
      },
      priceAnalysis: {
        takeoffTotal,
        bidTotal,
        variance,
        variancePercentage,
        averageUnitCostDifference: 0,
      },
      keyFindings: [`Price variance: ${variancePercentage.toFixed(1)}%`, `Scope coverage: ${matchedCount}/${takeoffItems.length} items matched`],
      recommendations: ['Review comparison manually for detailed analysis'],
      missingItems: [],
      extraItems: [],
      quantityDiscrepancies: [],
      priceDiscrepancies: [],
      riskAssessment: {
        scopeGaps: [],
        potentialChangeOrders: [],
        qualityConcerns: [],
      },
    }
  }
}




