/**
 * Estimate Enhancement
 * 
 * Analyzes takeoff items and identifies missing information needed for estimates:
 * - Material specifications (grade, type, size, manufacturer)
 * - Labor hours and rates
 * - Waste factors
 * - Equipment needs
 * - Site conditions
 * - Subcontractor requirements
 */

import { aiGateway } from '@/lib/ai-gateway-provider'
import { CostCodeStandard } from '@/lib/cost-code-helpers'

export interface EstimateEnhancement {
  item_id?: string
  item_name: string
  material_specs?: {
    grade?: string
    type?: string
    size?: string
    manufacturer?: string
    model?: string
  }
  labor?: {
    hours?: number
    rate?: number
    trade?: string
  }
  waste_factor?: number
  equipment_needs?: string[]
  site_conditions?: string[]
  subcontractor_required?: boolean
  missing_estimate_info?: Array<{
    category: 'material_specs' | 'labor' | 'waste_factor' | 'equipment' | 'site_conditions'
    missing_data: string
    why_needed: string
    where_to_find: string
    impact: 'critical' | 'high' | 'medium' | 'low'
  }>
}

export interface EstimateEnhancementResult {
  enhanced_items: EstimateEnhancement[]
  summary: {
    items_enhanced: number
    items_with_missing_info: number
    missing_material_specs: number
    missing_labor_info: number
    missing_waste_factors: number
    missing_equipment_info: number
  }
}

export class EstimateEnhancementEngine {
  /**
   * Enhance takeoff items with estimate information
   */
  async enhance(
    items: any[],
    planImages: string[],
    costCodeStandard: CostCodeStandard = 'csi-16'
  ): Promise<EstimateEnhancementResult> {
    console.log(`🔧 Enhancing ${items.length} items with estimate information...`)

    // For now, analyze items locally
    // In the future, could use AI to extract estimate info from plans
    const enhancedItems: EstimateEnhancement[] = items.map(item => 
      this.enhanceItem(item, planImages)
    )

    const summary = {
      items_enhanced: enhancedItems.length,
      items_with_missing_info: enhancedItems.filter(i => 
        i.missing_estimate_info && i.missing_estimate_info.length > 0
      ).length,
      missing_material_specs: enhancedItems.reduce((sum, i) => 
        sum + (i.missing_estimate_info?.filter(m => m.category === 'material_specs').length || 0), 0
      ),
      missing_labor_info: enhancedItems.reduce((sum, i) => 
        sum + (i.missing_estimate_info?.filter(m => m.category === 'labor').length || 0), 0
      ),
      missing_waste_factors: enhancedItems.reduce((sum, i) => 
        sum + (i.missing_estimate_info?.filter(m => m.category === 'waste_factor').length || 0), 0
      ),
      missing_equipment_info: enhancedItems.reduce((sum, i) => 
        sum + (i.missing_estimate_info?.filter(m => m.category === 'equipment').length || 0), 0
      )
    }

    return {
      enhanced_items: enhancedItems,
      summary
    }
  }

  /**
   * Enhance a single item with estimate information
   */
  private enhanceItem(item: any, planImages: string[]): EstimateEnhancement {
    const missing: EstimateEnhancement['missing_estimate_info'] = []

    // Extract material specs if available
    const materialSpecs = this.extractMaterialSpecs(item)
    
    // Check for missing material specs
    if (materialSpecs && !materialSpecs.grade && !materialSpecs.type && !materialSpecs.size) {
      missing.push({
        category: 'material_specs',
        missing_data: 'Material specifications (grade, type, size)',
        why_needed: 'Cannot provide accurate material pricing without specifications',
        where_to_find: 'Check specifications section, details, or material schedules',
        impact: 'high'
      })
    }

    // Extract labor information
    const labor = this.extractLaborInfo(item)
    
    // Check for missing labor info
    if (labor && !labor.hours && !labor.rate) {
      missing.push({
        category: 'labor',
        missing_data: 'Labor hours and rates',
        why_needed: 'Cannot calculate labor costs without hours and rates',
        where_to_find: 'Use industry standards or consult with trades',
        impact: 'high'
      })
    }

    // Calculate waste factor
    const wasteFactor = this.calculateWasteFactor(item)
    
    // Check for missing waste factor
    if (!wasteFactor) {
      missing.push({
        category: 'waste_factor',
        missing_data: 'Waste factor',
        why_needed: 'Need waste factor to calculate actual material quantities needed',
        where_to_find: 'Use industry standard waste factors based on material type',
        impact: 'medium'
      })
    }

    // Identify equipment needs
    const equipmentNeeds = this.identifyEquipmentNeeds(item)
    
    // Check for missing equipment info
    if (this.requiresEquipment(item) && (!equipmentNeeds || equipmentNeeds.length === 0)) {
      missing.push({
        category: 'equipment',
        missing_data: 'Equipment requirements',
        why_needed: 'Some items require special equipment that affects costs',
        where_to_find: 'Check plan details or consult with trades',
        impact: 'medium'
      })
    }

    // Identify site conditions
    const siteConditions = this.identifySiteConditions(item)

    // Determine if subcontractor is required
    const subcontractorRequired = this.requiresSubcontractor(item)

    return {
      item_id: item.id,
      item_name: item.name || item.description,
      material_specs: materialSpecs && Object.keys(materialSpecs).length > 0 ? materialSpecs : undefined,
      labor: labor && Object.keys(labor).length > 0 ? labor : undefined,
      waste_factor: wasteFactor,
      equipment_needs: equipmentNeeds && equipmentNeeds.length > 0 ? equipmentNeeds : undefined,
      site_conditions: siteConditions && siteConditions.length > 0 ? siteConditions : undefined,
      subcontractor_required: subcontractorRequired,
      missing_estimate_info: missing.length > 0 ? missing : undefined
    }
  }

  /**
   * Extract material specifications from item
   */
  private extractMaterialSpecs(item: any): EstimateEnhancement['material_specs'] {
    // Check if already in item
    if (item.material_specs) {
      return item.material_specs
    }

    // Try to extract from description or notes
    const description = (item.description || item.name || '').toLowerCase()
    const notes = (item.notes || '').toLowerCase()

    const specs: EstimateEnhancement['material_specs'] = {}

    // Extract grade
    const gradeMatch = (description + ' ' + notes).match(/(grade\s+[a-z0-9]+|g[0-9]+|#[0-9]+)/i)
    if (gradeMatch) {
      specs.grade = gradeMatch[1]
    }

    // Extract type
    const typeMatch = (description + ' ' + notes).match(/(concrete|steel|wood|lumber|drywall|insulation|roofing|siding)/i)
    if (typeMatch) {
      specs.type = typeMatch[1]
    }

    // Extract size
    const sizeMatch = (description + ' ' + notes).match(/(\d+x\d+|\d+"|\d+'|\d+\/\d+)/i)
    if (sizeMatch) {
      specs.size = sizeMatch[1]
    }

    return specs
  }

  /**
   * Extract labor information
   */
  private extractLaborInfo(item: any): EstimateEnhancement['labor'] {
    // Check if already in item
    if (item.labor) {
      return item.labor
    }

    // Determine trade from category/subcategory
    const trade = this.determineTrade(item)

    // Estimate hours based on quantity and unit (rough estimates)
    const hours = this.estimateLaborHours(item, trade)

    return {
      trade,
      hours: hours > 0 ? hours : undefined,
      rate: undefined // Would need to look up from rate tables
    }
  }

  /**
   * Determine trade from item category
   */
  private determineTrade(item: any): string {
    if (item.subcontractor) {
      return item.subcontractor
    }

    switch (item.category?.toLowerCase()) {
      case 'structural':
        return 'Framing'
      case 'exterior':
        return 'Exterior'
      case 'interior':
        return 'Interior'
      case 'mep':
        if (item.subcategory?.toLowerCase().includes('electrical')) {
          return 'Electrical'
        }
        if (item.subcategory?.toLowerCase().includes('plumbing')) {
          return 'Plumbing'
        }
        if (item.subcategory?.toLowerCase().includes('hvac')) {
          return 'HVAC'
        }
        return 'MEP'
      case 'finishes':
        return 'Finishes'
      default:
        return 'General'
    }
  }

  /**
   * Estimate labor hours (rough estimates)
   */
  private estimateLaborHours(item: any, trade: string): number {
    if (!item.quantity || item.quantity === 0) {
      return 0
    }

    // Rough labor hour estimates per unit
    const laborRates: Record<string, Record<string, number>> = {
      'Framing': {
        'LF': 0.1, // 0.1 hours per linear foot
        'SF': 0.05, // 0.05 hours per square foot
        'EA': 0.5 // 0.5 hours per each
      },
      'Electrical': {
        'EA': 0.25, // 0.25 hours per outlet/fixture
        'LF': 0.05 // 0.05 hours per linear foot of wire
      },
      'Plumbing': {
        'EA': 0.5, // 0.5 hours per fixture
        'LF': 0.1 // 0.1 hours per linear foot
      },
      'HVAC': {
        'EA': 1.0, // 1 hour per unit
        'SF': 0.02 // 0.02 hours per square foot
      },
      'Finishes': {
        'SF': 0.1, // 0.1 hours per square foot
        'EA': 0.5 // 0.5 hours per each
      }
    }

    const rate = laborRates[trade]?.[item.unit] || 0.1
    return item.quantity * rate
  }

  /**
   * Calculate waste factor based on material type
   */
  private calculateWasteFactor(item: any): number | undefined {
    // Check if already specified
    if (item.waste_factor) {
      return item.waste_factor
    }

    // Standard waste factors by material type
    const description = (item.description || item.name || '').toLowerCase()
    
    if (description.includes('lumber') || description.includes('framing')) {
      return 0.10 // 10% waste for lumber
    }
    if (description.includes('drywall') || description.includes('sheetrock')) {
      return 0.15 // 15% waste for drywall
    }
    if (description.includes('concrete')) {
      return 0.05 // 5% waste for concrete
    }
    if (description.includes('roofing') || description.includes('shingle')) {
      return 0.10 // 10% waste for roofing
    }
    if (description.includes('siding')) {
      return 0.10 // 10% waste for siding
    }
    if (description.includes('insulation')) {
      return 0.05 // 5% waste for insulation
    }

    // Default waste factor
    return 0.10 // 10% default
  }

  /**
   * Identify equipment needs
   */
  private identifyEquipmentNeeds(item: any): string[] {
    const needs: string[] = []
    const description = (item.description || item.name || '').toLowerCase()

    if (description.includes('concrete') || description.includes('foundation')) {
      needs.push('Concrete mixer/pour equipment')
    }
    if (description.includes('roofing') || description.includes('roof')) {
      needs.push('Roofing equipment (safety harnesses, hoisting)')
    }
    if (description.includes('crane') || description.includes('lift')) {
      needs.push('Crane or lifting equipment')
    }
    if (description.includes('excavation') || description.includes('excavate')) {
      needs.push('Excavation equipment')
    }
    if (description.includes('scaffold')) {
      needs.push('Scaffolding')
    }

    return needs
  }

  /**
   * Check if item requires equipment
   */
  private requiresEquipment(item: any): boolean {
    const description = (item.description || item.name || '').toLowerCase()
    return description.includes('concrete') ||
           description.includes('roofing') ||
           description.includes('crane') ||
           description.includes('excavation') ||
           description.includes('scaffold')
  }

  /**
   * Identify site conditions
   */
  private identifySiteConditions(item: any): string[] {
    const conditions: string[] = []
    const description = (item.description || item.name || '').toLowerCase()
    const notes = (item.notes || '').toLowerCase()

    if (description.includes('exterior') || description.includes('outside')) {
      conditions.push('Exterior work - weather dependent')
    }
    if (description.includes('underground') || description.includes('below grade')) {
      conditions.push('Below grade - may require dewatering')
    }
    if (description.includes('height') || description.includes('elevated')) {
      conditions.push('Elevated work - may require fall protection')
    }

    return conditions
  }

  /**
   * Determine if subcontractor is required
   */
  private requiresSubcontractor(item: any): boolean {
    // Check if already specified
    if (item.subcontractor_required !== undefined) {
      return item.subcontractor_required
    }

    // MEP work typically requires licensed subcontractors
    if (item.category === 'mep') {
      return true
    }

    // Electrical and plumbing typically require licensed contractors
    if (item.subcategory?.toLowerCase().includes('electrical') ||
        item.subcategory?.toLowerCase().includes('plumbing')) {
      return true
    }

    return false
  }
}
