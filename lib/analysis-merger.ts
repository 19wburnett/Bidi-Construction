import stringSimilarity from 'string-similarity'

export interface TakeoffItem {
  id: string
  name: string
  description: string
  category: string
  subcategory?: string
  quantity: number
  unit: string
  location?: string
  bounding_box?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  confidence?: number
  ai_provider?: string
  notes?: string
  cost_code?: string
  cost_code_description?: string
  dimensions?: string
}

export interface QualityIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  description: string
  location?: string
  bounding_box?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  impact?: string
  recommendation?: string
  confidence?: number
  ai_provider?: string
}

export interface MergedResult {
  items: TakeoffItem[]
  metadata: {
    totalFromOpenAI: number
    totalFromClaude: number
    totalFromGemini: number
    duplicatesRemoved: number
    uniqueItems: number
  }
}

export interface MergedQualityResult {
  issues: QualityIssue[]
  metadata: {
    totalFromOpenAI: number
    totalFromClaude: number
    totalFromGemini: number
    duplicatesRemoved: number
    uniqueIssues: number
  }
}

export function mergeAnalysisResults(
  openaiItems: TakeoffItem[],
  claudeItems: TakeoffItem[],
  geminiItems: TakeoffItem[]
): MergedResult {
  // Tag each item with its source
  const taggedItems = [
    ...openaiItems.map(item => ({ ...item, ai_provider: 'openai' })),
    ...claudeItems.map(item => ({ ...item, ai_provider: 'claude' })),
    ...geminiItems.map(item => ({ ...item, ai_provider: 'gemini' }))
  ]

  const merged: TakeoffItem[] = []
  const processed = new Set<number>()

  taggedItems.forEach((item, index) => {
    if (processed.has(index)) return

    // Find similar items from other providers
    const similar: TakeoffItem[] = [item]
    
    for (let j = index + 1; j < taggedItems.length; j++) {
      if (processed.has(j)) continue
      
      const otherItem = taggedItems[j]
      if (areItemsSimilar(item, otherItem)) {
        similar.push(otherItem)
        processed.add(j)
      }
    }

    // Merge similar items
    const mergedItem = mergeSimilarItems(similar)
    merged.push(mergedItem)
    processed.add(index)
  })

  return {
    items: merged,
    metadata: {
      totalFromOpenAI: openaiItems.length,
      totalFromClaude: claudeItems.length,
      totalFromGemini: geminiItems.length,
      duplicatesRemoved: taggedItems.length - merged.length,
      uniqueItems: merged.length
    }
  }
}

export function mergeQualityResults(
  openaiIssues: QualityIssue[],
  claudeIssues: QualityIssue[],
  geminiIssues: QualityIssue[]
): MergedQualityResult {
  // Tag each issue with its source
  const taggedIssues = [
    ...openaiIssues.map(issue => ({ ...issue, ai_provider: 'openai' })),
    ...claudeIssues.map(issue => ({ ...issue, ai_provider: 'claude' })),
    ...geminiIssues.map(issue => ({ ...issue, ai_provider: 'gemini' }))
  ]

  const merged: QualityIssue[] = []
  const processed = new Set<number>()

  taggedIssues.forEach((issue, index) => {
    if (processed.has(index)) return

    // Find similar issues from other providers
    const similar: QualityIssue[] = [issue]
    
    for (let j = index + 1; j < taggedIssues.length; j++) {
      if (processed.has(j)) continue
      
      const otherIssue = taggedIssues[j]
      if (areIssuesSimilar(issue, otherIssue)) {
        similar.push(otherIssue)
        processed.add(j)
      }
    }

    // Merge similar issues
    const mergedIssue = mergeSimilarIssues(similar)
    merged.push(mergedIssue)
    processed.add(index)
  })

  return {
    issues: merged,
    metadata: {
      totalFromOpenAI: openaiIssues.length,
      totalFromClaude: claudeIssues.length,
      totalFromGemini: geminiIssues.length,
      duplicatesRemoved: taggedIssues.length - merged.length,
      uniqueIssues: merged.length
    }
  }
}

function areItemsSimilar(item1: TakeoffItem, item2: TakeoffItem): boolean {
  // Same category
  if (item1.category !== item2.category) return false

  // Similar names/descriptions
  const nameSimil = stringSimilarity.compareTwoStrings(
    item1.name.toLowerCase(),
    item2.name.toLowerCase()
  )
  const descSimil = stringSimilarity.compareTwoStrings(
    item1.description?.toLowerCase() || '',
    item2.description?.toLowerCase() || ''
  )

  if (nameSimil < 0.7 && descSimil < 0.7) return false

  // Similar location
  if (item1.location && item2.location) {
    const locSimil = stringSimilarity.compareTwoStrings(
      item1.location.toLowerCase(),
      item2.location.toLowerCase()
    )
    if (locSimil < 0.6) return false
  }

  // Similar quantities (within 20%)
  if (item1.unit === item2.unit) {
    const qtyRatio = Math.max(item1.quantity, item2.quantity) / 
                     Math.min(item1.quantity, item2.quantity)
    if (qtyRatio > 1.2) return false
  }

  return true
}

function areIssuesSimilar(issue1: QualityIssue, issue2: QualityIssue): boolean {
  // Same severity and category
  if (issue1.severity !== issue2.severity) return false
  if (issue1.category !== issue2.category) return false

  // Similar descriptions
  const descSimil = stringSimilarity.compareTwoStrings(
    issue1.description.toLowerCase(),
    issue2.description.toLowerCase()
  )

  if (descSimil < 0.75) return false

  // Similar location
  if (issue1.location && issue2.location) {
    const locSimil = stringSimilarity.compareTwoStrings(
      issue1.location.toLowerCase(),
      issue2.location.toLowerCase()
    )
    if (locSimil < 0.7) return false
  }

  return true
}

function mergeSimilarItems(items: TakeoffItem[]): TakeoffItem {
  // Prefer item with bounding box
  const withBbox = items.find(i => i.bounding_box)
  const base = withBbox || items[0]

  // Average quantities
  const avgQuantity = items.reduce((sum, i) => sum + i.quantity, 0) / items.length

  // Combine providers
  const providers = items.map(i => i.ai_provider).filter(Boolean)

  // Average confidence
  const avgConfidence = items.reduce((sum, i) => sum + (i.confidence || 0.5), 0) / items.length

  return {
    ...base,
    quantity: Math.round(avgQuantity * 100) / 100,
    confidence: avgConfidence,
    ai_provider: providers.length > 1 ? 'merged' : providers[0],
    notes: `Detected by: ${providers.join(', ')}${base.notes ? ` | ${base.notes}` : ''}`
  }
}

function mergeSimilarIssues(issues: QualityIssue[]): QualityIssue {
  // Prefer issue with bounding box
  const withBbox = issues.find(i => i.bounding_box)
  const base = withBbox || issues[0]

  // Combine providers
  const providers = issues.map(i => i.ai_provider).filter(Boolean)

  // Average confidence
  const avgConfidence = issues.reduce((sum, i) => sum + (i.confidence || 0.5), 0) / issues.length

  // Combine impact and recommendations
  const impacts = issues.map(i => i.impact).filter(Boolean)
  const recommendations = issues.map(i => i.recommendation).filter(Boolean)

  return {
    ...base,
    confidence: avgConfidence,
    ai_provider: providers.length > 1 ? 'merged' : providers[0],
    impact: impacts.length > 1 ? impacts.join(' | ') : (impacts[0] || base.impact),
    recommendation: recommendations.length > 1 ? recommendations.join(' | ') : (recommendations[0] || base.recommendation)
  }
}

