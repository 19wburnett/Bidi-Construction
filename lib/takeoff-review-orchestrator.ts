/**
 * Takeoff Review Orchestrator
 * 
 * Coordinates multi-AI review of takeoff analysis:
 * - Reviewer 1: Reviews existing takeoff items
 * - Reviewer 2: Re-analyzes plans for missing items
 * - Reviewer 3: Validates quantities and cost codes
 */

import { aiGateway } from '@/lib/ai-gateway-provider'
import { buildReviewTakeoffPrompt, buildReanalyzePlansPrompt, buildValidationPrompt } from '@/lib/takeoff-review-prompts'
import { CostCodeStandard } from '@/lib/cost-code-helpers'

export interface ReviewResult {
  reviewed_items: Array<{
    item_index: number
    item_name: string
    status: string
    missing_information: Array<{
      category: string
      missing_data: string
      why_needed: string
      where_to_find: string
      impact: 'critical' | 'high' | 'medium' | 'low'
    }>
    cost_code_issues?: string
    quantity_calculable: boolean
    notes?: string
  }>
  missing_items: Array<{
    item_name: string
    category: string
    reason: string
    location: string
    cost_code: string
    impact: 'critical' | 'high' | 'medium' | 'low'
  }>
  summary: {
    items_reviewed: number
    items_with_issues: number
    missing_items_found: number
    critical_issues: number
    notes: string
  }
}

export interface ReanalysisResult {
  missing_items: Array<{
    name: string
    description: string
    category: string
    subcategory: string
    cost_code: string
    cost_code_description: string
    location: string
    bounding_box: {
      page: number
      x: number
      y: number
      width: number
      height: number
    }
    missing_information: Array<{
      category: string
      missing_data: string
      why_needed: string
      where_to_find: string
      impact: 'critical' | 'high' | 'medium' | 'low'
    }>
    confidence: number
  }>
  items_with_missing_data: Array<{
    item_name: string
    missing_measurements: string[]
    missing_quantities: string[]
    where_to_find: string
    impact: 'critical' | 'high' | 'medium' | 'low'
  }>
  summary: {
    missing_items_found: number
    items_with_missing_data: number
    critical_missing_info: number
    notes: string
  }
}

export interface ValidationResult {
  validated_items: Array<{
    item_index: number
    item_name: string
    quantity_valid: boolean
    quantity_validation_notes: string
    cost_code_valid: boolean
    cost_code_validation_notes: string
    calculation_possible: boolean
    missing_for_calculation: string[]
    discrepancies: string[]
    recommendation: string
  }>
  impossible_calculations: Array<{
    item_name: string
    reason: string
    missing_data: string[]
    impact: 'critical' | 'high' | 'medium' | 'low'
  }>
  summary: {
    items_validated: number
    valid_quantities: number
    invalid_quantities: number
    impossible_calculations: number
    cost_code_issues: number
    notes: string
  }
}

export interface ReviewOrchestratorResult {
  reviewResult: ReviewResult
  reanalysisResult: ReanalysisResult
  validationResult: ValidationResult
  mergedMissingItems: Array<{
    name: string
    category: string
    reason: string
    location: string
    cost_code: string
    impact: 'critical' | 'high' | 'medium' | 'low'
    source: 'reviewer1' | 'reviewer2' | 'both'
  }>
  allMissingInformation: Array<{
    item_id?: string
    item_name: string
    category: 'measurement' | 'quantity' | 'specification' | 'detail' | 'other'
    missing_data: string
    why_needed: string
    where_to_find: string
    impact: 'critical' | 'high' | 'medium' | 'low'
    suggested_action?: string
    location?: string
  }>
}

export class TakeoffReviewOrchestrator {
  /**
   * Run all three reviewers in parallel
   */
  async runReview(
    primaryTakeoff: any,
    planImages: string[],
    costCodeStandard: CostCodeStandard = 'csi-16',
    userId?: string
  ): Promise<ReviewOrchestratorResult> {
    const items = primaryTakeoff.items || []
    
    console.log(`🔍 Starting multi-AI review with ${items.length} items and ${planImages.length} plan images`)

    // Run all three reviewers in parallel
    const [reviewResult, reanalysisResult, validationResult] = await Promise.all([
      this.reviewTakeoffItems(items, costCodeStandard, userId),
      this.reanalyzePlans(planImages, costCodeStandard, items, userId),
      this.validateTakeoff(primaryTakeoff, undefined) // Will be updated with review findings
    ])

    // Update validation with review findings
    const updatedValidationResult = await this.validateTakeoff(
      primaryTakeoff,
      { reviewed_items: reviewResult.reviewed_items, missing_items: reviewResult.missing_items }
    )

    // Merge results
    const mergedMissingItems = this.mergeMissingItems(reviewResult.missing_items, reanalysisResult.missing_items)
    const allMissingInformation = this.collectAllMissingInformation(
      reviewResult,
      reanalysisResult,
      updatedValidationResult,
      items
    )

    return {
      reviewResult,
      reanalysisResult,
      validationResult: updatedValidationResult,
      mergedMissingItems,
      allMissingInformation
    }
  }

  /**
   * Reviewer 1: Review existing takeoff items
   */
  private async reviewTakeoffItems(
    items: any[],
    costCodeStandard: CostCodeStandard,
    userId?: string
  ): Promise<ReviewResult> {
    console.log('📋 Reviewer 1: Reviewing takeoff items...')
    
    try {
      const prompt = await buildReviewTakeoffPrompt(items, costCodeStandard, userId)
      
      const response = await aiGateway.generate({
        model: 'gpt-4o',
        system: 'You are an expert construction estimator reviewing takeoff items for completeness and accuracy.',
        prompt,
        maxTokens: 16384,
        temperature: 0.2,
        responseFormat: { type: 'json_object' }
      })

      const content = response.content
      if (!content) {
        throw new Error('No response from Reviewer 1')
      }

      // Parse JSON response
      let parsed: ReviewResult
      try {
        const jsonText = this.extractJSON(content)
        parsed = JSON.parse(jsonText)
      } catch (error) {
        console.error('Error parsing Reviewer 1 response:', error)
        console.error('Response length:', content.length, 'chars')
        console.error('Response preview (last 500 chars):', content.slice(-500))
        // Return empty result structure
        parsed = {
          reviewed_items: [],
          missing_items: [],
          summary: {
            items_reviewed: 0,
            items_with_issues: 0,
            missing_items_found: 0,
            critical_issues: 0,
            notes: 'Error parsing review response'
          }
        }
      }

      console.log(`✅ Reviewer 1 completed: ${parsed.reviewed_items.length} items reviewed, ${parsed.missing_items.length} missing items found`)
      return parsed
    } catch (error) {
      console.error('Error in Reviewer 1:', error)
      return {
        reviewed_items: [],
        missing_items: [],
        summary: {
          items_reviewed: 0,
          items_with_issues: 0,
          missing_items_found: 0,
          critical_issues: 0,
          notes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }
  }

  /**
   * Reviewer 2: Re-analyze plans for missing items
   */
  private async reanalyzePlans(
    planImages: string[],
    costCodeStandard: CostCodeStandard,
    existingItems: any[],
    userId?: string
  ): Promise<ReanalysisResult> {
    console.log('🔍 Reviewer 2: Re-analyzing plans for missing items...')
    
    try {
      const prompt = await buildReanalyzePlansPrompt(planImages.length, costCodeStandard, existingItems, userId)
      
      const response = await aiGateway.generate({
        model: 'claude-sonnet-4-20250514',
        system: 'You are an expert construction estimator re-analyzing plans to find items missed in the initial takeoff.',
        prompt,
        images: planImages,
        maxTokens: 16384,
        temperature: 0.2,
        responseFormat: { type: 'json_object' }
      })

      const content = response.content
      if (!content) {
        throw new Error('No response from Reviewer 2')
      }

      // Parse JSON response
      let parsed: ReanalysisResult
      try {
        const jsonText = this.extractJSON(content)
        parsed = JSON.parse(jsonText)
      } catch (error) {
        console.error('Error parsing Reviewer 2 response:', error)
        console.error('Response length:', content.length, 'chars')
        console.error('Response preview (last 500 chars):', content.slice(-500))
        parsed = {
          missing_items: [],
          items_with_missing_data: [],
          summary: {
            missing_items_found: 0,
            items_with_missing_data: 0,
            critical_missing_info: 0,
            notes: 'Error parsing reanalysis response'
          }
        }
      }

      console.log(`✅ Reviewer 2 completed: ${parsed.missing_items.length} missing items found, ${parsed.items_with_missing_data.length} items with missing data`)
      return parsed
    } catch (error) {
      console.error('Error in Reviewer 2:', error)
      return {
        missing_items: [],
        items_with_missing_data: [],
        summary: {
          missing_items_found: 0,
          items_with_missing_data: 0,
          critical_missing_info: 0,
          notes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }
  }

  /**
   * Reviewer 3: Validate quantities and cost codes
   */
  private async validateTakeoff(
    primaryTakeoff: any,
    reviewFindings?: any
  ): Promise<ValidationResult> {
    console.log('✅ Reviewer 3: Validating quantities and cost codes...')
    
    try {
      const prompt = buildValidationPrompt(primaryTakeoff, reviewFindings)
      
      const response = await aiGateway.generate({
        model: 'gpt-4o',
        system: 'You are an expert construction estimator validating takeoff quantities and cost code assignments.',
        prompt,
        maxTokens: 16384,
        temperature: 0.2,
        responseFormat: { type: 'json_object' }
      })

      const content = response.content
      if (!content) {
        throw new Error('No response from Reviewer 3')
      }

      // Parse JSON response
      let parsed: ValidationResult
      try {
        const jsonText = this.extractJSON(content)
        parsed = JSON.parse(jsonText)
      } catch (error) {
        console.error('Error parsing Reviewer 3 response:', error)
        console.error('Response length:', content.length, 'chars')
        console.error('Response preview (last 500 chars):', content.slice(-500))
        parsed = {
          validated_items: [],
          impossible_calculations: [],
          summary: {
            items_validated: 0,
            valid_quantities: 0,
            invalid_quantities: 0,
            impossible_calculations: 0,
            cost_code_issues: 0,
            notes: 'Error parsing validation response'
          }
        }
      }

      console.log(`✅ Reviewer 3 completed: ${parsed.validated_items.length} items validated, ${parsed.impossible_calculations.length} impossible calculations`)
      return parsed
    } catch (error) {
      console.error('Error in Reviewer 3:', error)
      return {
        validated_items: [],
        impossible_calculations: [],
        summary: {
          items_validated: 0,
          valid_quantities: 0,
          invalid_quantities: 0,
          impossible_calculations: 0,
          cost_code_issues: 0,
          notes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }
  }

  /**
   * Merge missing items from different reviewers
   */
  private mergeMissingItems(
    reviewMissingItems: ReviewResult['missing_items'],
    reanalysisMissingItems: ReanalysisResult['missing_items']
  ): ReviewOrchestratorResult['mergedMissingItems'] {
    const merged: ReviewOrchestratorResult['mergedMissingItems'] = []
    const seen = new Map<string, { item: any, sources: Set<string> }>()

    // Add items from Reviewer 1
    reviewMissingItems.forEach(item => {
      const key = `${item.item_name}_${item.category}`
      seen.set(key, { item, sources: new Set(['reviewer1']) })
    })

    // Add items from Reviewer 2
    reanalysisMissingItems.forEach(item => {
      const key = `${item.name}_${item.category}`
      if (seen.has(key)) {
        seen.get(key)!.sources.add('reviewer2')
      } else {
        seen.set(key, {
          item: {
            name: item.name,
            category: item.category,
            reason: item.description || 'Found in plan reanalysis',
            location: item.location,
            cost_code: item.cost_code,
            impact: item.missing_information?.[0]?.impact || 'medium'
          },
          sources: new Set(['reviewer2'])
        })
      }
    })

    // Convert to merged format
    seen.forEach(({ item, sources }) => {
      merged.push({
        name: item.name || item.item_name,
        category: item.category,
        reason: item.reason,
        location: item.location,
        cost_code: item.cost_code,
        impact: item.impact || 'medium',
        source: sources.has('reviewer1') && sources.has('reviewer2') ? 'both' : 
                sources.has('reviewer1') ? 'reviewer1' : 'reviewer2'
      })
    })

    return merged
  }

  /**
   * Collect all missing information from all reviewers
   */
  private collectAllMissingInformation(
    reviewResult: ReviewResult,
    reanalysisResult: ReanalysisResult,
    validationResult: ValidationResult,
    items: any[]
  ): ReviewOrchestratorResult['allMissingInformation'] {
    const allMissing: ReviewOrchestratorResult['allMissingInformation'] = []

    // From Reviewer 1 (reviewed items)
    reviewResult.reviewed_items.forEach((reviewedItem, idx) => {
      if (reviewedItem.missing_information && reviewedItem.missing_information.length > 0) {
        const originalItem = items[reviewedItem.item_index - 1]
        reviewedItem.missing_information.forEach(missing => {
          allMissing.push({
            item_id: originalItem?.id,
            item_name: reviewedItem.item_name,
            category: missing.category as any,
            missing_data: missing.missing_data,
            why_needed: missing.why_needed,
            where_to_find: missing.where_to_find,
            impact: missing.impact,
            location: originalItem?.location || originalItem?.location_reference || undefined
          })
        })
      }
    })

    // From Reviewer 2 (reanalysis missing items)
    reanalysisResult.missing_items.forEach(item => {
      if (item.missing_information && item.missing_information.length > 0) {
        item.missing_information.forEach(missing => {
          allMissing.push({
            item_name: item.name,
            category: missing.category as any,
            missing_data: missing.missing_data,
            why_needed: missing.why_needed,
            where_to_find: missing.where_to_find,
            impact: missing.impact,
            location: item.location
          })
        })
      }
    })

    // From Reviewer 3 (impossible calculations)
    validationResult.impossible_calculations.forEach(calc => {
      calc.missing_data.forEach(missingData => {
        allMissing.push({
          item_name: calc.item_name,
          category: 'measurement',
          missing_data: missingData,
          why_needed: calc.reason,
          where_to_find: 'Check plans for missing dimensions or specifications',
          impact: calc.impact,
          suggested_action: 'Provide missing measurements to enable quantity calculation'
        })
      })
    })

    return allMissing
  }

  /**
   * Extract JSON from response (handles markdown code blocks)
   */
  private extractJSON(content: string): string {
    // Remove markdown code blocks if present
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
      return this.repairJSON(codeBlockMatch[1])
    }
    
    // Try to find JSON object in the text
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return this.repairJSON(jsonMatch[0])
    }
    
    return this.repairJSON(content)
  }

  /**
   * Attempt to repair truncated or malformed JSON
   */
  private repairJSON(json: string): string {
    let repaired = json.trim()
    
    // Track open brackets/braces
    let openBraces = 0
    let openBrackets = 0
    let inString = false
    let escapeNext = false
    
    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i]
      
      if (escapeNext) {
        escapeNext = false
        continue
      }
      
      if (char === '\\' && inString) {
        escapeNext = true
        continue
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString
        continue
      }
      
      if (!inString) {
        if (char === '{') openBraces++
        if (char === '}') openBraces--
        if (char === '[') openBrackets++
        if (char === ']') openBrackets--
      }
    }
    
    // If we're in a string, close it
    if (inString) {
      repaired += '"'
    }
    
    // Remove trailing incomplete array elements (common truncation issue)
    // Look for patterns like: }, { "incomplete... or , "incomplete...
    const truncatedArrayPattern = /,\s*\{[^}]*$/
    const truncatedValuePattern = /,\s*"[^"]*$/
    const truncatedKeyPattern = /,\s*"[^"]*":\s*$/
    const incompleteObjectPattern = /\{[^{}]*$/
    
    if (truncatedArrayPattern.test(repaired)) {
      repaired = repaired.replace(truncatedArrayPattern, '')
    } else if (truncatedValuePattern.test(repaired)) {
      repaired = repaired.replace(truncatedValuePattern, '')
    } else if (truncatedKeyPattern.test(repaired)) {
      repaired = repaired.replace(truncatedKeyPattern, '')
    }
    
    // Close unclosed brackets and braces
    // Recount after potential repairs
    openBraces = 0
    openBrackets = 0
    inString = false
    escapeNext = false
    
    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i]
      
      if (escapeNext) {
        escapeNext = false
        continue
      }
      
      if (char === '\\' && inString) {
        escapeNext = true
        continue
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString
        continue
      }
      
      if (!inString) {
        if (char === '{') openBraces++
        if (char === '}') openBraces--
        if (char === '[') openBrackets++
        if (char === ']') openBrackets--
      }
    }
    
    // Add missing closing brackets/braces
    while (openBrackets > 0) {
      repaired += ']'
      openBrackets--
    }
    while (openBraces > 0) {
      repaired += '}'
      openBraces--
    }
    
    return repaired
  }
}
