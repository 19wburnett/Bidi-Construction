/**
 * Shared trade types and utilities
 * Used by both takeoff-spreadsheet and bid-package-modal
 */

// Base trade categories (source of truth)
export const TRADE_CATEGORIES = [
  'Excavation',
  'Concrete',
  'Masonry',
  'Structural',
  'Structural Steel',
  'Framing',
  'Carpentry',
  'Roofing',
  'Windows & Doors',
  'Siding',
  'Drywall',
  'Insulation',
  'Flooring',
  'Painting',
  'Millwork & Casework',
  'HVAC',
  'Plumbing',
  'Electrical',
  'Fire Sprinkler'
] as const

/**
 * Normalize trade name for consistent comparison
 */
export function normalizeTrade(trade?: string | null): string {
  return (trade || '').trim().toLowerCase()
}

/**
 * Get all trades (base + custom from database)
 */
export async function getAllTrades(supabase: any): Promise<string[]> {
  try {
    const { data: customTrades, error } = await supabase
      .from('custom_trades')
      .select('name')
      .order('name')

    if (error) {
      console.error('Error loading custom trades:', error)
      return [...TRADE_CATEGORIES]
    }

    const customTradeNames = (customTrades || []).map((t: { name: string }) => t.name)
    const baseTradeSet = new Set(TRADE_CATEGORIES as readonly string[])
    
    // Merge base and custom, avoiding duplicates
    const allTrades = [...(TRADE_CATEGORIES as readonly string[])]
    for (const customTrade of customTradeNames) {
      if (!baseTradeSet.has(customTrade)) {
        allTrades.push(customTrade)
      }
    }

    return allTrades.sort()
  } catch (error) {
    console.error('Error in getAllTrades:', error)
    return [...TRADE_CATEGORIES]
  }
}

/**
 * Trade groups for UI organization
 */
export const TRADE_GROUPS = {
  'Structural': ['Excavation', 'Concrete', 'Masonry', 'Structural', 'Structural Steel', 'Framing'],
  'MEP': ['HVAC', 'Plumbing', 'Electrical', 'Fire Sprinkler'],
  'Finishes': ['Carpentry', 'Roofing', 'Windows & Doors', 'Siding', 'Drywall', 'Insulation', 'Flooring', 'Painting', 'Millwork & Casework']
} as const

