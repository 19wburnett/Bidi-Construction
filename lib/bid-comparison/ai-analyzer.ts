import { callAnalysisLLM } from '@/lib/llm/providers'
import type { BidLineItem, LineItemMatch } from './ai-matcher'

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

export interface AIAnalysisResult {
  summary: string
  bestValue: {
    bidId: string
    bidderName: string
    reasoning: string
  }
  keyDifferences: string[]
  recommendations: string[]
  priceBreakdown: {
    totalVariance: number
    averageUnitCost: Record<string, number>
    priceRange: Record<string, { min: number; max: number; variance: number }>
  }
  scopeAnalysis: {
    missingItems: Array<{ bidId: string; items: string[] }>
    extraItems: Array<{ bidId: string; items: string[] }>
    coverageGaps: string[]
  }
  riskAssessment: {
    lowBidRisks: Array<{ bidId: string; concerns: string[] }>
    highBidRisks: Array<{ bidId: string; concerns: string[] }>
    qualityIndicators: Record<string, string>
  }
  negotiationPoints: Array<{
    bidId: string
    bidderName: string
    points: string[]
  }>
  costPerUnitAnalysis: Record<string, {
    item: string
    prices: Record<string, number>
    average: number
    variance: number
  }>
}

/**
 * Generate comprehensive AI analysis of bid comparison
 */
export async function generateBidAnalysis(
  selectedBid: Bid,
  comparisonBids: Bid[],
  matches: LineItemMatch[],
  unmatchedItems: {
    selectedBid: BidLineItem[]
    comparisonBids: Record<string, BidLineItem[]>
  },
  pdfTexts?: Record<string, string>
): Promise<AIAnalysisResult> {
  const systemPrompt = `You are an expert construction bid analyst with 20+ years of experience. Your task is to provide comprehensive analysis of construction bid comparisons.

You have access to:
1. Structured bid data (line items, amounts, timelines, notes)
2. Original PDF documents from each bidder (full text content)

HYBRID ANALYSIS APPROACH:
- Use structured data for precise line-item comparisons and price analysis
- Use PDF text content to identify:
  * Additional context, terms, and conditions not captured in structured data
  * Material specifications and quality indicators
  * Warranty information, guarantees, or exclusions
  * Timeline details and scheduling constraints
  * Scope clarifications or assumptions
  * Any discrepancies between structured data and original documents

Analyze the provided bid data and generate insights including:
1. Best value identification (not just lowest price, but best overall value)
2. Key differences between bids
3. Recommendations for the general contractor
4. Price breakdown and variance analysis
5. Scope analysis (missing items, extra items, coverage gaps)
6. Risk assessment (low bid risks, high bid risks, quality indicators)
7. Negotiation points for each bidder
8. Cost per unit analysis

Be thorough, professional, and provide actionable insights. Consider:
- Price vs quality trade-offs
- Missing scope items that could lead to change orders
- Unusually low bids that might indicate quality concerns
- Unusually high bids that might be overpriced
- Material quality differences
- Timeline implications
- Risk factors
- Terms and conditions from PDFs that may affect the bid value

Return your analysis as JSON with this exact structure:
{
  "summary": "Executive summary paragraph (2-3 sentences)",
  "bestValue": {
    "bidId": "string",
    "bidderName": "string",
    "reasoning": "Why this bid offers best value (consider price, scope, quality indicators)"
  },
  "keyDifferences": ["Array of key differences between bids"],
  "recommendations": ["Array of actionable recommendations"],
  "priceBreakdown": {
    "totalVariance": number (percentage),
    "averageUnitCost": {"item description": unit price},
    "priceRange": {"item description": {"min": number, "max": number, "variance": number}}
  },
  "scopeAnalysis": {
    "missingItems": [{"bidId": "string", "items": ["item descriptions"]}],
    "extraItems": [{"bidId": "string", "items": ["item descriptions"]}],
    "coverageGaps": ["Array of scope gaps identified"]
  },
  "riskAssessment": {
    "lowBidRisks": [{"bidId": "string", "concerns": ["risk concerns"]}],
    "highBidRisks": [{"bidId": "string", "concerns": ["risk concerns"]}],
    "qualityIndicators": {"bidId": "quality assessment"}
  },
  "negotiationPoints": [{"bidId": "string", "bidderName": "string", "points": ["negotiation points"]}],
  "costPerUnitAnalysis": {"item description": {"item": "normalized description", "prices": {"bidId": unit price}, "average": number, "variance": number}}
}`

  // Build comprehensive user prompt with all bid data
  const bidSummaries = [
    {
      id: selectedBid.id,
      name: selectedBid.subcontractors?.name || selectedBid.gc_contacts?.name || 'Selected Bid',
      amount: selectedBid.bid_amount,
      timeline: selectedBid.timeline,
      trade: selectedBid.subcontractors?.trade_category || selectedBid.gc_contacts?.trade_category || 'Unknown',
      notes: selectedBid.notes,
      isSelected: true,
    },
    ...comparisonBids.map(bid => ({
      id: bid.id,
      name: bid.subcontractors?.name || bid.gc_contacts?.name || 'Unknown',
      amount: bid.bid_amount,
      timeline: bid.timeline,
      trade: bid.subcontractors?.trade_category || bid.gc_contacts?.trade_category || 'Unknown',
      notes: bid.notes,
      isSelected: false,
    })),
  ]

  const matchesSummary = matches.map(match => {
    const comparisonSummary = match.comparisonItems.map(ci => 
      `${ci.bidId}: ${ci.item.description} - $${ci.item.unit_price || 0}/${ci.item.unit || 'ea'} (confidence: ${ci.confidence}%)`
    ).join('\n    ')
    
    return `Selected: ${match.selectedBidItem.description} - $${match.selectedBidItem.unit_price || 0}/${match.selectedBidItem.unit || 'ea'}
  Matches:
    ${comparisonSummary}`
  }).join('\n\n')

  const unmatchedSummary = [
    `Selected Bid Unmatched: ${unmatchedItems.selectedBid.map(i => i.description).join(', ') || 'None'}`,
    ...Object.entries(unmatchedItems.comparisonBids).map(([bidId, items]) => 
      `${bidId} Unmatched: ${items.map(i => i.description).join(', ') || 'None'}`
    ),
  ].join('\n')

  // Build PDF content section
  let pdfContentSection = ''
  if (pdfTexts && Object.keys(pdfTexts).length > 0) {
    pdfContentSection = '\n\n=== ORIGINAL PDF DOCUMENTS ===\n'
    
    // Add selected bid PDF
    if (pdfTexts[selectedBid.id]) {
      const pdfText = pdfTexts[selectedBid.id]
      const truncatedText = pdfText.length > 8000 ? pdfText.slice(0, 8000) + '\n\n...(PDF text truncated for length)' : pdfText
      pdfContentSection += `\nSelected Bid (${bidSummaries[0].name}) PDF Content:\n${truncatedText}\n`
    }
    
    // Add comparison bid PDFs
    for (const bid of bidSummaries.slice(1)) {
      if (pdfTexts[bid.id]) {
        const pdfText = pdfTexts[bid.id]
        const truncatedText = pdfText.length > 8000 ? pdfText.slice(0, 8000) + '\n\n...(PDF text truncated for length)' : pdfText
        pdfContentSection += `\nComparison Bid (${bid.name}) PDF Content:\n${truncatedText}\n`
      }
    }
    
    pdfContentSection += '\nUse the PDF content above to identify additional context, terms, conditions, specifications, and any information not captured in the structured line items. Cross-reference PDF content with structured data to identify discrepancies or important details.'
  }

  const userPrompt = `BID COMPARISON DATA

Selected Bid:
- Bidder: ${bidSummaries[0].name}
- Total Amount: $${bidSummaries[0].amount || 'N/A'}
- Timeline: ${bidSummaries[0].timeline || 'Not specified'}
- Trade: ${bidSummaries[0].trade}
- Notes: ${bidSummaries[0].notes || 'None'}

Comparison Bids:
${bidSummaries.slice(1).map(bid => `- ${bid.name}: $${bid.amount || 'N/A'} (Timeline: ${bid.timeline || 'Not specified'}, Trade: ${bid.trade})`).join('\n')}

MATCHED LINE ITEMS:
${matchesSummary || 'No matches found'}

UNMATCHED ITEMS:
${unmatchedSummary || 'All items matched'}${pdfContentSection}

Please provide comprehensive analysis of these bids, incorporating insights from both the structured data and the original PDF documents.`

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

    const analysis = JSON.parse(jsonMatch[0]) as AIAnalysisResult

    // Validate and ensure all required fields exist
    return {
      summary: analysis.summary || 'Analysis generated successfully.',
      bestValue: analysis.bestValue || {
        bidId: selectedBid.id,
        bidderName: bidSummaries[0].name,
        reasoning: 'Analysis in progress',
      },
      keyDifferences: analysis.keyDifferences || [],
      recommendations: analysis.recommendations || [],
      priceBreakdown: analysis.priceBreakdown || {
        totalVariance: 0,
        averageUnitCost: {},
        priceRange: {},
      },
      scopeAnalysis: analysis.scopeAnalysis || {
        missingItems: [],
        extraItems: [],
        coverageGaps: [],
      },
      riskAssessment: analysis.riskAssessment || {
        lowBidRisks: [],
        highBidRisks: [],
        qualityIndicators: {},
      },
      negotiationPoints: analysis.negotiationPoints || [],
      costPerUnitAnalysis: analysis.costPerUnitAnalysis || {},
    }
  } catch (error) {
    console.error('Error generating bid analysis:', error)
    
    // Return a basic fallback analysis
    const totalAmounts = bidSummaries.map(b => b.amount || 0)
    const minAmount = Math.min(...totalAmounts)
    const maxAmount = Math.max(...totalAmounts)
    const variance = maxAmount > 0 ? ((maxAmount - minAmount) / maxAmount) * 100 : 0
    
    return {
      summary: 'Analysis generation encountered an error. Please review bids manually.',
      bestValue: {
        bidId: selectedBid.id,
        bidderName: bidSummaries[0].name,
        reasoning: 'Unable to generate detailed analysis',
      },
      keyDifferences: [`Price variance: ${variance.toFixed(1)}%`],
      recommendations: ['Review bids manually for detailed comparison'],
      priceBreakdown: {
        totalVariance: variance,
        averageUnitCost: {},
        priceRange: {},
      },
      scopeAnalysis: {
        missingItems: [],
        extraItems: [],
        coverageGaps: [],
      },
      riskAssessment: {
        lowBidRisks: [],
        highBidRisks: [],
        qualityIndicators: {},
      },
      negotiationPoints: [],
      costPerUnitAnalysis: {},
    }
  }
}














