/**
 * Missing Information Analyzer
 * 
 * Analyzes takeoff items to identify what information CANNOT be determined from plans
 * and generates structured reports explaining what's missing and why it's needed.
 */

import { MissingInformation } from '@/types/takeoff'

export interface MissingInformationAnalysis {
  missingInformation: MissingInformation[]
  summary: {
    total_missing: number
    by_category: {
      measurement: number
      quantity: number
      specification: number
      detail: number
      other: number
    }
    by_impact: {
      critical: number
      high: number
      medium: number
      low: number
    }
    items_affected: number
  }
}

export class MissingInformationAnalyzer {
  /**
   * Analyze takeoff items and identify missing information
   */
  analyze(
    items: any[],
    reviewFindings?: {
      reviewed_items?: Array<{
        item_index: number
        item_name: string
        missing_information?: Array<{
          category: string
          missing_data: string
          why_needed: string
          where_to_find: string
          impact: 'critical' | 'high' | 'medium' | 'low'
        }>
      }>
    }
  ): MissingInformationAnalysis {
    const missingInfo: MissingInformation[] = []
    const itemsWithMissingInfo = new Set<string>()

    // Analyze each item
    items.forEach((item, index) => {
      const itemMissingInfo = this.analyzeItem(item, index, reviewFindings)
      if (itemMissingInfo.length > 0) {
        itemsWithMissingInfo.add(item.id || `item_${index}`)
        missingInfo.push(...itemMissingInfo)
      }
    })

    // Calculate summary
    const byCategory = {
      measurement: 0,
      quantity: 0,
      specification: 0,
      detail: 0,
      other: 0
    }

    const byImpact = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    missingInfo.forEach(info => {
      byCategory[info.category] = (byCategory[info.category] || 0) + 1
      byImpact[info.impact] = (byImpact[info.impact] || 0) + 1
    })

    return {
      missingInformation: missingInfo,
      summary: {
        total_missing: missingInfo.length,
        by_category: byCategory,
        by_impact: byImpact,
        items_affected: itemsWithMissingInfo.size
      }
    }
  }

  /**
   * Analyze a single item for missing information
   */
  private analyzeItem(
    item: any,
    index: number,
    reviewFindings?: {
      reviewed_items?: Array<{
        item_index: number
        item_name: string
        missing_information?: Array<{
          category: string
          missing_data: string
          why_needed: string
          where_to_find: string
          impact: 'critical' | 'high' | 'medium' | 'low'
        }>
      }>
    }
  ): MissingInformation[] {
    const missing: MissingInformation[] = []

    // Check for missing information from review findings
    if (reviewFindings?.reviewed_items) {
      const reviewedItem = reviewFindings.reviewed_items.find(
        r => r.item_index === index + 1 || r.item_name === item.name || r.item_name === item.description
      )
      
      if (reviewedItem?.missing_information) {
        reviewedItem.missing_information.forEach(mi => {
          missing.push({
            item_id: item.id,
            item_name: item.name || item.description || `Item ${index + 1}`,
            category: mi.category as any,
            missing_data: mi.missing_data,
            why_needed: mi.why_needed,
            where_to_find: mi.where_to_find,
            impact: mi.impact,
            location: item.location || item.location_reference || undefined
          })
        })
      }
    }

    // Analyze item for missing measurements
    if (!item.quantity || item.quantity === 0) {
      // Check if dimensions are available
      const hasDimensions = item.dimensions && 
        item.dimensions !== 'dimension not visible' && 
        item.dimensions !== 'N/A' &&
        item.dimensions.trim().length > 0

      if (!hasDimensions) {
        // Determine what measurements are needed based on unit
        const neededMeasurements = this.getNeededMeasurements(item.unit)
        
        neededMeasurements.forEach(measurement => {
          missing.push({
            item_id: item.id,
            item_name: item.name || item.description || `Item ${index + 1}`,
            category: 'measurement',
            missing_data: measurement,
            why_needed: `Cannot calculate ${item.unit} quantity without ${measurement}`,
            where_to_find: this.getWhereToFindMeasurement(item),
            impact: this.getImpactForMeasurement(item.unit),
            location: item.location || item.location_reference || undefined,
            suggested_action: `Measure or find ${measurement} in plans to calculate quantity`
          })
        })
      }
    }

    // Check for missing quantity (count)
    if (item.unit === 'EA' && (!item.quantity || item.quantity === 0)) {
      missing.push({
        item_id: item.id,
        item_name: item.name || item.description || `Item ${index + 1}`,
        category: 'quantity',
        missing_data: 'Item count',
        why_needed: 'Cannot estimate cost without knowing how many items are needed',
        where_to_find: this.getWhereToFindQuantity(item),
        impact: 'high',
        location: item.location || item.location_reference || undefined,
        suggested_action: 'Count items from plans or check schedules'
      })
    }

    // Check for missing specifications
    if (!item.material_specs || Object.keys(item.material_specs || {}).length === 0) {
      // Check if item notes mention missing specs
      if (item.notes && (
        item.notes.includes('grade not specified') ||
        item.notes.includes('type unclear') ||
        item.notes.includes('specification missing')
      )) {
        missing.push({
          item_id: item.id,
          item_name: item.name || item.description || `Item ${index + 1}`,
          category: 'specification',
          missing_data: 'Material specifications (grade, type, size)',
          why_needed: 'Cannot provide accurate pricing without material specifications',
          where_to_find: 'Check specifications section, details, or material schedules',
          impact: 'medium',
          location: item.location || item.location_reference || undefined,
          suggested_action: 'Review specifications section or contact architect'
        })
      }
    }

    // Check notes for explicit missing information markers
    if (item.notes) {
      const missingMarkers = item.notes.match(/⚠️ MISSING: ([^\.]+)\. WHY NEEDED: ([^\.]+)\. WHERE TO FIND: ([^\.]+)\. IMPACT: (critical|high|medium|low)/g)
      if (missingMarkers) {
        missingMarkers.forEach((marker: string) => {
          const match = marker.match(/⚠️ MISSING: ([^\.]+)\. WHY NEEDED: ([^\.]+)\. WHERE TO FIND: ([^\.]+)\. IMPACT: (critical|high|medium|low)/)
          if (match) {
            missing.push({
              item_id: item.id,
              item_name: item.name || item.description || `Item ${index + 1}`,
              category: 'other',
              missing_data: match[1],
              why_needed: match[2],
              where_to_find: match[3],
              impact: match[4] as any,
              location: item.location || item.location_reference || undefined
            })
          }
        })
      }
    }

    return missing
  }

  /**
   * Get needed measurements based on unit type
   */
  private getNeededMeasurements(unit: string): string[] {
    switch (unit?.toUpperCase()) {
      case 'SF':
      case 'SQ':
        return ['Length', 'Width']
      case 'CF':
        return ['Length', 'Width', 'Height']
      case 'CY':
        return ['Length', 'Width', 'Height']
      case 'LF':
        return ['Length']
      case 'EA':
        return [] // Count-based, not measurement-based
      default:
        return ['Dimensions']
    }
  }

  /**
   * Get impact level for missing measurements based on unit
   */
  private getImpactForMeasurement(unit: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (unit?.toUpperCase()) {
      case 'SF':
      case 'SQ':
      case 'CF':
      case 'CY':
        return 'critical' // Cannot calculate quantity without dimensions
      case 'LF':
        return 'high' // Length is critical for linear measurements
      default:
        return 'medium'
    }
  }

  /**
   * Get guidance on where to find measurements
   */
  private getWhereToFindMeasurement(item: any): string {
    const location = item.location || item.location_reference || ''
    const page = item.bounding_box?.page || item.plan_page_number
    
    if (page) {
      return `Check dimensions on page ${page}${location ? `, ${location}` : ''} or in detail drawings`
    }
    
    if (location) {
      return `Check dimensions in ${location} or detail drawings`
    }
    
    return 'Check plan dimensions, detail drawings, or schedules'
  }

  /**
   * Get guidance on where to find quantities
   */
  private getWhereToFindQuantity(item: any): string {
    const location = item.location || item.location_reference || ''
    const page = item.bounding_box?.page || item.plan_page_number
    
    if (item.category === 'mep') {
      return `Check ${item.subcategory || 'MEP'} schedule on electrical/mechanical sheets${page ? ` (page ${page})` : ''}`
    }
    
    if (item.category === 'interior' || item.category === 'exterior') {
      return `Count from plans${page ? ` (page ${page})` : ''} or check door/window/fixture schedules`
    }
    
    if (page) {
      return `Count items from page ${page}${location ? `, ${location}` : ''} or check schedules`
    }
    
    return 'Count items from plans or check schedules'
  }
}
