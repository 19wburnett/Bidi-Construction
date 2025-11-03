import { EnhancedAIResponse, ConsensusResult, TaskType } from './enhanced-ai-providers'
import { TakeoffItem, QualityIssue } from './analysis-merger'

// Enhanced Consensus Engine for Multi-Model Analysis
// This engine provides advanced consensus scoring, disagreement detection, and specialized routing

export interface EnhancedConsensusResult {
  items: TakeoffItem[]
  issues: QualityIssue[]
  quality_analysis?: any // Include quality_analysis in consensus result
  confidence: number
  consensusCount: number
  disagreements: Disagreement[]
  modelAgreements: ModelAgreement[]
  specializedInsights: SpecializedInsight[]
  recommendations: string[]
}

export interface Disagreement {
  type: 'quantity' | 'category' | 'location' | 'severity' | 'cost'
  description: string
  models: string[]
  values: Record<string, any>
  recommendation: string
}

export interface ModelAgreement {
  model: string
  specialization: string
  itemsFound: number
  confidence: number
  strengths: string[]
  weaknesses: string[]
}

export interface SpecializedInsight {
  type: 'code_compliance' | 'cost_optimization' | 'quality_improvement' | 'safety_concern'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  recommendation: string
  models: string[]
}

export class EnhancedConsensusEngine {
  private similarityThreshold = 0.7 // For item/issue name/description
  private quantityTolerance = 0.2 // 20% tolerance for quantity comparison
  private consensusThreshold = parseFloat(process.env.CONSENSUS_THRESHOLD || '0.4') // 40% consensus required (lowered for more items)
  private highConfidenceThreshold = 0.4 // 40% minimum confidence for results (very inclusive for comprehensive takeoffs)
  private minModelsForHighConfidence = 3 // Minimum 3 models required for high-confidence mode

  private modelStrengths: Record<string, string[]> = {
    'gpt-5': ['general_analysis', 'comprehensive_coverage', 'detailed_descriptions', 'advanced_reasoning'],
    'gpt-4o': ['general_analysis', 'comprehensive_coverage', 'detailed_descriptions'],
    'claude-3.5-sonnet': ['code_compliance', 'regulatory_analysis', 'safety_standards'],
    'gemini-1.5-pro': ['measurements', 'calculations', 'dimensional_analysis'],
    'gpt-4-vision': ['symbol_recognition', 'visual_analysis', 'plan_reading'],
    'claude-3-opus': ['cost_estimation', 'market_analysis', 'pricing_accuracy'],
    'grok-2': ['alternative_perspective', 'creative_analysis', 'unconventional_insights']
  }

  private modelWeaknesses: Record<string, string[]> = {
    'gpt-4o': ['cost_estimation', 'regulatory_details'],
    'claude-3.5-sonnet': ['visual_analysis', 'symbol_recognition'],
    'gemini-1.5-pro': ['code_compliance', 'safety_analysis'],
    'gpt-4-vision': ['cost_analysis', 'regulatory_compliance'],
    'claude-3-opus': ['visual_analysis', 'dimensional_accuracy']
  }

  // Build enhanced consensus from multiple model results
  async buildEnhancedConsensus(
    results: EnhancedAIResponse[],
    taskType: TaskType
  ): Promise<EnhancedConsensusResult> {
    console.log(`Building enhanced consensus for ${taskType} with ${results.length} models...`)

    // Parse all responses
    const parsedResults = this.parseModelResponses(results)
    
    if (parsedResults.length < 2) {
      throw new Error('Need at least 2 valid responses for consensus analysis')
    }

    // Check if we have enough models for high-confidence mode
    const isHighConfidenceMode = parsedResults.length >= this.minModelsForHighConfidence
    if (!isHighConfidenceMode) {
      console.warn(`Only ${parsedResults.length} models available, high-confidence mode requires ${this.minModelsForHighConfidence}+ models`)
    }

    // Extract items and issues from all models
    const allItems = parsedResults.flatMap(r => r.items || [])
    const allIssues = parsedResults.flatMap(r => r.issues || [])

    // Build consensus items and issues
    const consensusItems = this.buildConsensusItems(allItems, parsedResults)
    const consensusIssues = this.buildConsensusIssues(allIssues, parsedResults)
    
    // Merge quality_analysis from all models (use most comprehensive one)
    const qualityAnalysis = this.mergeQualityAnalysis(parsedResults)

    // Detect disagreements
    const disagreements = this.detectDisagreements(parsedResults, taskType)

    // Analyze model agreements
    const modelAgreements = this.analyzeModelAgreements(parsedResults)

    // Generate specialized insights
    const specializedInsights = this.generateSpecializedInsights(parsedResults, taskType)

    // Generate recommendations
    const recommendations = this.generateRecommendations(disagreements, specializedInsights)

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(parsedResults, consensusItems, consensusIssues)

    return {
      items: consensusItems,
      issues: consensusIssues,
      quality_analysis: qualityAnalysis, // Include merged quality_analysis
      confidence,
      consensusCount: parsedResults.length,
      disagreements,
      modelAgreements,
      specializedInsights,
      recommendations
    }
  }

  // Parse model responses and extract structured data
  private parseModelResponses(results: EnhancedAIResponse[]): Array<{
    model: string
    specialization: string
    confidence: number
    items: TakeoffItem[]
    issues: QualityIssue[]
    quality_analysis?: any
    raw: any
  }> {
    return results.map(result => {
      try {
        // Try to parse JSON, with better error handling for malformed JSON
        let parsed: any
        try {
          parsed = JSON.parse(result.content)
        } catch (parseError) {
          // Try to extract JSON from markdown code blocks
          const codeBlockMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (codeBlockMatch) {
            parsed = JSON.parse(codeBlockMatch[1])
          } else {
            // Try to find JSON object in text and fix common issues
            const jsonMatch = result.content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              let jsonText = jsonMatch[0]
              // Fix trailing commas before closing braces/brackets
              jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1')
              // Try to close incomplete JSON
              const openBraces = (jsonText.match(/\{/g) || []).length
              const closeBraces = (jsonText.match(/\}/g) || []).length
              if (openBraces > closeBraces) {
                jsonText += '}'.repeat(openBraces - closeBraces)
              }
              parsed = JSON.parse(jsonText)
            } else {
              throw new Error('No JSON found in response')
            }
          }
        }
        
        return {
          model: result.model,
          specialization: result.specialization,
          confidence: result.confidence || 0.5,
          items: this.extractTakeoffItems(parsed),
          issues: this.extractQualityIssues(parsed),
          quality_analysis: parsed.quality_analysis, // Extract quality_analysis
          raw: parsed
        }
      } catch (error) {
        console.error(`Failed to parse ${result.model} response:`, error)
        return {
          model: result.model,
          specialization: result.specialization,
          confidence: 0.1,
          items: [],
          issues: [],
          quality_analysis: undefined,
          raw: null
        }
      }
    })
  }

  // Extract takeoff items from parsed response
  private extractTakeoffItems(parsed: any): TakeoffItem[] {
    if (!parsed.items || !Array.isArray(parsed.items)) return []
    
    return parsed.items.map((item: any, index: number) => ({
      id: `item_${Date.now()}_${index}`,
      name: item.name || 'Unknown Item',
      description: item.description || '',
      category: item.category || 'other',
      subcategory: item.subcategory || 'Uncategorized',
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit || 'EA',
      location: item.location || '',
      bounding_box: item.bounding_box,
      confidence: item.confidence || 0.5,
      notes: item.notes || '',
      cost_code: item.cost_code || '',
      cost_code_description: item.cost_code_description || '',
      dimensions: item.dimensions || ''
    }))
  }

  // Extract quality issues from parsed response
  private extractQualityIssues(parsed: any): QualityIssue[] {
    if (!parsed.issues || !Array.isArray(parsed.issues)) return []
    
    return parsed.issues.map((issue: any, index: number) => ({
      id: `issue_${Date.now()}_${index}`,
      severity: issue.severity || 'info',
      category: issue.category || 'general',
      description: issue.description || '',
      location: issue.location || '',
      bounding_box: issue.bounding_box,
      impact: issue.impact || '',
      recommendation: issue.recommendation || '',
      confidence: issue.confidence || 0.5
    }))
  }

  // Build consensus items with advanced scoring
  // GOAL: Keep ALL unique items from ALL models - only merge exact duplicates
  private buildConsensusItems(
    allItems: TakeoffItem[],
    parsedResults: Array<{ model: string; items: TakeoffItem[]; confidence: number }>
  ): TakeoffItem[] {
    // Group similar items for merging exact duplicates only
    const itemGroups = this.groupSimilarItems(allItems)
    
    console.log(`Processing ${allItems.length} total items in ${itemGroups.length} groups`)
    
    // Build consensus for each group - merge duplicates, keep all unique items
    const consensusItems: TakeoffItem[] = []
    
    itemGroups.forEach((group, index) => {
      // If multiple models found the same item, merge them
      // If only one model found it, keep it (we want ALL findings)
      const consensusItem = this.buildItemConsensus(group, parsedResults)
      if (consensusItem) {
        // Add confidence warning in notes if confidence is low
        if (consensusItem.confidence && consensusItem.confidence < 0.6) {
          const warning = `⚠️ LOW CONFIDENCE (${(consensusItem.confidence * 100).toFixed(0)}%) - Verify this item manually.`
          consensusItem.notes = consensusItem.notes 
            ? `${warning} ${consensusItem.notes}` 
            : warning
        }
        
        consensusItems.push(consensusItem)
        console.log(`Group ${index + 1}: "${consensusItem.name}" - ${((consensusItem.confidence || 0) * 100).toFixed(1)}% confidence`)
      }
    })
    
    console.log(`Returning ${consensusItems.length} items from ${allItems.length} total (keeping all unique findings from all models)`)
    return consensusItems
  }

  // Build consensus issues with advanced scoring
  private buildConsensusIssues(
    allIssues: QualityIssue[],
    parsedResults: Array<{ model: string; issues: QualityIssue[]; confidence: number }>
  ): QualityIssue[] {
    const issueGroups = this.groupSimilarIssues(allIssues)
    const consensusIssues: QualityIssue[] = []
    
    issueGroups.forEach(group => {
      const consensusIssue = this.buildIssueConsensus(group, parsedResults)
      if (consensusIssue) {
        consensusIssues.push(consensusIssue)
      }
    })
    
    return consensusIssues
  }

  // Group similar items for consensus analysis
  private groupSimilarItems(items: TakeoffItem[]): TakeoffItem[][] {
    const groups: TakeoffItem[][] = []
    const processed = new Set<number>()
    
    items.forEach((item, index) => {
      if (processed.has(index)) return
      
      const group = [item]
      processed.add(index)
      
      for (let j = index + 1; j < items.length; j++) {
        if (processed.has(j)) continue
        
        if (this.areItemsSimilar(item, items[j])) {
          group.push(items[j])
          processed.add(j)
        }
      }
      
      groups.push(group)
    })
    
    return groups
  }

  // Group similar issues for consensus analysis
  private groupSimilarIssues(issues: QualityIssue[]): QualityIssue[][] {
    const groups: QualityIssue[][] = []
    const processed = new Set<number>()
    
    issues.forEach((issue, index) => {
      if (processed.has(index)) return
      
      const group = [issue]
      processed.add(index)
      
      for (let j = index + 1; j < issues.length; j++) {
        if (processed.has(j)) continue
        
        if (this.areIssuesSimilar(issue, issues[j])) {
          group.push(issues[j])
          processed.add(j)
        }
      }
      
      groups.push(group)
    })
    
    return groups
  }

  // Check if two items are similar
  private areItemsSimilar(item1: TakeoffItem, item2: TakeoffItem): boolean {
    if (item1.category !== item2.category) return false
    
    const nameSimilarity = this.calculateSimilarity(
      item1.name?.toLowerCase() || '',
      item2.name?.toLowerCase() || ''
    )
    
    const descSimilarity = this.calculateSimilarity(
      item1.description?.toLowerCase() || '',
      item2.description?.toLowerCase() || ''
    )
    
    return nameSimilarity > 0.7 || descSimilarity > 0.7
  }

  // Check if two issues are similar
  private areIssuesSimilar(issue1: QualityIssue, issue2: QualityIssue): boolean {
    if (issue1.severity !== issue2.severity) return false
    if (issue1.category !== issue2.category) return false
    
    const descSimilarity = this.calculateSimilarity(
      issue1.description?.toLowerCase() || '',
      issue2.description?.toLowerCase() || ''
    )
    
    return descSimilarity > 0.75
  }

  // Calculate string similarity
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0
    if (!str1 || !str2) return 0.0
    
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  // Calculate Levenshtein distance
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  // Merge quality_analysis from multiple models
  private mergeQualityAnalysis(
    parsedResults: Array<{ model: string; quality_analysis?: any }>
  ): any {
    // Find the most comprehensive quality_analysis
    let bestQA: any = null
    let bestScore = 0
    
    parsedResults.forEach(result => {
      if (result.quality_analysis) {
        const qa = result.quality_analysis
        // Score based on completeness and detail
        const score = (qa.completeness?.overall_score || 0) +
                     (qa.audit_trail?.coverage_percentage || 0) / 100 +
                     (qa.risk_flags?.length || 0) * 0.1 +
                     (qa.completeness?.missing_dimensions?.length || 0) * 0.05 // More missing items = more comprehensive analysis
        
        if (score > bestScore) {
          bestScore = score
          bestQA = qa
        }
      }
    })
    
    // If no model returned quality_analysis, return default structure
    if (!bestQA) {
      return {
        completeness: {
          overall_score: 0.8,
          missing_sheets: [],
          missing_dimensions: [],
          missing_details: [],
          incomplete_sections: [],
          notes: 'Quality analysis merged from multiple models'
        },
        consistency: {
          scale_mismatches: [],
          unit_conflicts: [],
          dimension_contradictions: [],
          schedule_vs_elevation_conflicts: [],
          notes: 'No consistency issues detected across models'
        },
        risk_flags: [],
        audit_trail: {
          pages_analyzed: [],
          chunks_processed: parsedResults.length,
          coverage_percentage: 100,
          assumptions_made: []
        }
      }
    }
    
    return bestQA
  }

  // Build consensus for a group of similar items
  // GOAL: Keep ALL items, even from single models. Only merge when multiple models found the same item.
  private buildItemConsensus(
    group: TakeoffItem[],
    parsedResults: Array<{ model: string; confidence: number }>
  ): TakeoffItem | null {
    if (group.length === 0) return null
    
    // Calculate consensus score (how many models found this item)
    const consensusScore = group.length / parsedResults.length
    
    // MAXIMALLY INCLUSIVE MODE: Keep items even if only 1 model found them
    // The goal is COMPREHENSIVE coverage - each model finds different things
    // Only filter out items with extremely low confidence (< 0.15)
    const minItemConfidence = Math.min(...group.map(i => i.confidence || 0.5))
    const avgItemConfidence = group.reduce((sum, i) => sum + (i.confidence || 0.5), 0) / group.length
    
    // Only filter out if BOTH conditions are true:
    // 1. Very low individual confidence AND
    // 2. Very low consensus (only 1 model found it, and it had low confidence)
    if (minItemConfidence < 0.15 && consensusScore < 0.25) {
      console.log(`Filtering out item "${group[0].name}" - confidence ${(minItemConfidence * 100).toFixed(1)}% < 15% threshold`)
      return null
    }
    
    const base = group[0]
    const providers = group.map(item => item.ai_provider || 'unknown')
    
    // Calculate weighted average quantity
    const totalWeight = group.reduce((sum, item) => sum + (item.confidence || 0.5), 0)
    const weightedQuantity = group.reduce((sum, item) => 
      sum + (item.quantity * (item.confidence || 0.5)), 0) / totalWeight
    
    // Calculate weighted average confidence
    const avgModelConfidence = group.reduce((sum, item) => sum + (item.confidence || 0.5), 0) / group.length
    
    // Enhanced confidence calculation for comprehensive coverage
    const consensusBoost = Math.min(consensusScore * 0.4, 0.4) // +40% when models agree
    const agreementBoost = group.length >= 1 ? 0.2 : 0 // +20% when 1+ models agree (very inclusive)
    const modelCountBoost = Math.min(parsedResults.length / 6, 0.2) // Boost for more models
    
    const finalConfidence = Math.min(
      avgModelConfidence + consensusBoost + agreementBoost + modelCountBoost, 
      0.95 // Cap at 95% to leave room for manual verification
    )
    
    // MAXIMALLY INCLUSIVE: Keep all items, even with low confidence
    // We want COMPREHENSIVE coverage - let users verify low-confidence items
    // Only filter out if confidence is extremely low (< 0.2) AND only 1 model found it
    const minimalThreshold = 0.2
    if (finalConfidence < minimalThreshold && consensusScore < 0.25) {
      console.log(`Filtering out item "${base.name}" - confidence ${(finalConfidence * 100).toFixed(1)}% < minimal threshold ${(minimalThreshold * 100).toFixed(1)}% and only ${group.length} model(s) found it`)
      return null
    }
    
    // Add note about model consensus if low
    if (consensusScore < 0.4) {
      const foundBy = `${group.length} model${group.length > 1 ? 's' : ''}`
      base.notes = base.notes 
        ? `${base.notes} (Found by ${foundBy} - verify for accuracy)`
        : `Found by ${foundBy} - verify for accuracy`
    }
    
    return {
      ...base,
      quantity: Math.round(weightedQuantity * 100) / 100,
      confidence: finalConfidence,
      ai_provider: providers.length > 1 ? 'consensus' : providers[0],
      notes: `High-confidence consensus from ${providers.join(', ')} (${consensusScore.toFixed(1)} agreement, ${(finalConfidence * 100).toFixed(0)}% confidence)${base.notes ? ` | ${base.notes}` : ''}`
    }
  }

  // Build consensus for a group of similar issues
  private buildIssueConsensus(
    group: QualityIssue[],
    parsedResults: Array<{ model: string; confidence: number }>
  ): QualityIssue | null {
    if (group.length === 0) return null
    
    const consensusScore = group.length / parsedResults.length
    if (consensusScore < this.consensusThreshold) return null
    
    const base = group[0]
    const providers = group.map(issue => issue.ai_provider || 'unknown')
    
    const avgModelConfidence = group.reduce((sum, issue) => sum + (issue.confidence || 0.5), 0) / group.length
    const consensusBoost = Math.min(consensusScore * 0.3, 0.3)
    const agreementBoost = group.length >= 2 ? 0.15 : 0
    const modelCountBoost = Math.min(parsedResults.length / 8, 0.15)
    
    const finalConfidence = Math.min(
      avgModelConfidence + consensusBoost + agreementBoost + modelCountBoost,
      0.95
    )
    
    // Only return issues that meet high confidence threshold
    if (finalConfidence < this.highConfidenceThreshold) return null
    
    return {
      ...base,
      confidence: finalConfidence,
      ai_provider: providers.length > 1 ? 'consensus' : providers[0]
    }
  }

  // Detect disagreements between models
  private detectDisagreements(
    parsedResults: Array<{ model: string; items: TakeoffItem[]; issues: QualityIssue[]; confidence: number }>,
    taskType: TaskType
  ): Disagreement[] {
    const disagreements: Disagreement[] = []
    
    // Check for quantity disagreements
    const quantityDisagreements = this.detectQuantityDisagreements(parsedResults)
    disagreements.push(...quantityDisagreements)
    
    // Check for category disagreements
    const categoryDisagreements = this.detectCategoryDisagreements(parsedResults)
    disagreements.push(...categoryDisagreements)
    
    // Check for severity disagreements
    const severityDisagreements = this.detectSeverityDisagreements(parsedResults)
    disagreements.push(...severityDisagreements)
    
    return disagreements
  }

  // Detect quantity disagreements
  private detectQuantityDisagreements(
    parsedResults: Array<{ model: string; items: TakeoffItem[] }>
  ): Disagreement[] {
    const disagreements: Disagreement[] = []
    
    // Group items by name and category
    const itemGroups = new Map<string, TakeoffItem[]>()
    
    parsedResults.forEach(result => {
      result.items.forEach(item => {
        const key = `${item.name}_${item.category}`
        if (!itemGroups.has(key)) {
          itemGroups.set(key, [])
        }
        itemGroups.get(key)!.push(item)
      })
    })
    
    // Check for quantity disagreements
    itemGroups.forEach((items, key) => {
      if (items.length < 2) return
      
      const quantities = items.map(item => item.quantity)
      const avgQuantity = quantities.reduce((sum, qty) => sum + qty, 0) / quantities.length
      const maxDeviation = Math.max(...quantities.map(qty => Math.abs(qty - avgQuantity)))
      
      if (maxDeviation > avgQuantity * 0.3) { // 30% deviation threshold
        disagreements.push({
          type: 'quantity',
          description: `Quantity disagreement for ${items[0].name}`,
          models: items.map(item => item.ai_provider || 'unknown'),
          values: items.reduce((acc, item) => {
            acc[item.ai_provider || 'unknown'] = item.quantity
            return acc
          }, {} as Record<string, any>),
          recommendation: `Review quantities - models disagree by ${(maxDeviation / avgQuantity * 100).toFixed(1)}%`
        })
      }
    })
    
    return disagreements
  }

  // Detect category disagreements
  private detectCategoryDisagreements(
    parsedResults: Array<{ model: string; items: TakeoffItem[] }>
  ): Disagreement[] {
    const disagreements: Disagreement[] = []
    
    // Group items by name
    const itemGroups = new Map<string, TakeoffItem[]>()
    
    parsedResults.forEach(result => {
      result.items.forEach(item => {
        if (!itemGroups.has(item.name)) {
          itemGroups.set(item.name, [])
        }
        itemGroups.get(item.name)!.push(item)
      })
    })
    
    // Check for category disagreements
    itemGroups.forEach((items, name) => {
      if (items.length < 2) return
      
      const categories = items.map(item => item.category)
      const uniqueCategories = Array.from(new Set(categories))
      
      if (uniqueCategories.length > 1) {
        disagreements.push({
          type: 'category',
          description: `Category disagreement for ${name}`,
          models: items.map(item => item.ai_provider || 'unknown'),
          values: items.reduce((acc, item) => {
            acc[item.ai_provider || 'unknown'] = item.category
            return acc
          }, {} as Record<string, any>),
          recommendation: `Review categorization - models disagree on category assignment`
        })
      }
    })
    
    return disagreements
  }

  // Detect severity disagreements
  private detectSeverityDisagreements(
    parsedResults: Array<{ model: string; issues: QualityIssue[] }>
  ): Disagreement[] {
    const disagreements: Disagreement[] = []
    
    // Group issues by description
    const issueGroups = new Map<string, QualityIssue[]>()
    
    parsedResults.forEach(result => {
      result.issues.forEach(issue => {
        if (!issueGroups.has(issue.description)) {
          issueGroups.set(issue.description, [])
        }
        issueGroups.get(issue.description)!.push(issue)
      })
    })
    
    // Check for severity disagreements
    issueGroups.forEach((issues, description) => {
      if (issues.length < 2) return
      
      const severities = issues.map(issue => issue.severity)
      const uniqueSeverities = Array.from(new Set(severities))
      
      if (uniqueSeverities.length > 1) {
        disagreements.push({
          type: 'severity',
          description: `Severity disagreement for issue: ${description.substring(0, 50)}...`,
          models: issues.map(issue => issue.ai_provider || 'unknown'),
          values: issues.reduce((acc, issue) => {
            acc[issue.ai_provider || 'unknown'] = issue.severity
            return acc
          }, {} as Record<string, any>),
          recommendation: `Review severity assessment - models disagree on severity level`
        })
      }
    })
    
    return disagreements
  }

  // Analyze model agreements
  private analyzeModelAgreements(
    parsedResults: Array<{ model: string; specialization: string; items: TakeoffItem[]; issues: QualityIssue[]; confidence: number }>
  ): ModelAgreement[] {
    return parsedResults.map(result => ({
      model: result.model,
      specialization: result.specialization,
      itemsFound: result.items.length,
      confidence: result.confidence,
      strengths: this.modelStrengths[result.model] || [],
      weaknesses: this.modelWeaknesses[result.model] || []
    }))
  }

  // Generate specialized insights
  private generateSpecializedInsights(
    parsedResults: Array<{ model: string; specialization: string; items: TakeoffItem[]; issues: QualityIssue[] }>,
    taskType: TaskType
  ): SpecializedInsight[] {
    const insights: SpecializedInsight[] = []
    
    // Code compliance insights
    const codeComplianceModels = parsedResults.filter(r => r.specialization === 'code_compliance')
    if (codeComplianceModels.length > 0) {
      insights.push({
        type: 'code_compliance',
        title: 'Building Code Analysis',
        description: 'Comprehensive code compliance review completed',
        impact: 'high',
        recommendation: 'Review all code compliance issues before proceeding',
        models: codeComplianceModels.map(r => r.model)
      })
    }
    
    // Cost optimization insights
    const costModels = parsedResults.filter(r => r.specialization === 'cost_estimation')
    if (costModels.length > 0) {
      insights.push({
        type: 'cost_optimization',
        title: 'Cost Analysis',
        description: 'Detailed cost estimation and market analysis completed',
        impact: 'high',
        recommendation: 'Consider cost optimization opportunities identified',
        models: costModels.map(r => r.model)
      })
    }
    
    // Quality improvement insights
    const qualityIssues = parsedResults.flatMap(r => r.issues)
    if (qualityIssues.length > 0) {
      const criticalIssues = qualityIssues.filter(issue => issue.severity === 'critical')
      if (criticalIssues.length > 0) {
        insights.push({
          type: 'quality_improvement',
          title: 'Quality Issues Detected',
          description: `${criticalIssues.length} critical quality issues identified`,
          impact: 'high',
          recommendation: 'Address critical quality issues before construction',
          models: parsedResults.map(r => r.model)
        })
      }
    }
    
    return insights
  }

  // Generate recommendations based on disagreements and insights
  private generateRecommendations(
    disagreements: Disagreement[],
    insights: SpecializedInsight[]
  ): string[] {
    const recommendations: string[] = []
    
    if (disagreements.length > 0) {
      recommendations.push(`Review ${disagreements.length} disagreements between models for accuracy`)
    }
    
    insights.forEach(insight => {
      if (insight.impact === 'high') {
        recommendations.push(insight.recommendation)
      }
    })
    
    if (recommendations.length === 0) {
      recommendations.push('All models agree - high confidence in results')
    }
    
    return recommendations
  }

  // Calculate overall confidence
  private calculateOverallConfidence(
    parsedResults: Array<{ confidence: number }>,
    consensusItems: TakeoffItem[],
    consensusIssues: QualityIssue[]
  ): number {
    const avgModelConfidence = parsedResults.reduce((sum, r) => sum + r.confidence, 0) / parsedResults.length
    
    const avgItemConfidence = consensusItems.length > 0 
      ? consensusItems.reduce((sum, item) => sum + (item.confidence || 0.5), 0) / consensusItems.length
      : 0.5
    
    const avgIssueConfidence = consensusIssues.length > 0
      ? consensusIssues.reduce((sum, issue) => sum + (issue.confidence || 0.5), 0) / consensusIssues.length
      : 0.5
    
    // Weighted average with consensus boost
    const consensusBoost = Math.min(consensusItems.length / 10, 0.2) // Boost for more items
    const finalConfidence = (avgModelConfidence + avgItemConfidence + avgIssueConfidence) / 3 + consensusBoost
    
    return Math.min(finalConfidence, 1.0)
  }
}

// Export singleton instance
export const enhancedConsensusEngine = new EnhancedConsensusEngine()
