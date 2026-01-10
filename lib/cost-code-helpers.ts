import * as AMEX from './cost-codes/amex'
import * as CSI16 from './cost-codes/csi-16'
import * as CSI50 from './cost-codes/csi-50'
import * as NAHB from './cost-codes/nahb'

export type CostCodeStandard = 'amex' | 'csi-16' | 'csi-50' | 'nahb' | 'custom'

export interface CostCode {
  division: string
  code: string
  description: string
  fullCode: string
}

const STANDARDS: Record<Exclude<CostCodeStandard, 'custom'>, { codes: CostCode[], prompt: string, name: string }> = {
  'amex': {
    codes: AMEX.COST_CODES,
    prompt: AMEX.PROMPT_TEXT,
    name: 'AMEX (Custom)'
  },
  'csi-16': {
    codes: CSI16.COST_CODES,
    prompt: CSI16.PROMPT_TEXT,
    name: 'CSI MasterFormat (16 Divisions)'
  },
  'csi-50': {
    codes: CSI50.COST_CODES,
    prompt: CSI50.PROMPT_TEXT,
    name: 'CSI MasterFormat (50 Divisions)'
  },
  'nahb': {
    codes: NAHB.COST_CODES,
    prompt: NAHB.PROMPT_TEXT,
    name: 'NAHB Residential'
  }
}

export const AVAILABLE_STANDARDS: { id: CostCodeStandard, name: string }[] = [
  ...Object.entries(STANDARDS).map(
    ([id, data]) => ({ id: id as CostCodeStandard, name: data.name })
  ),
  { id: 'custom', name: 'Custom Cost Codes' }
]

/**
 * Get all cost codes for a specific standard
 * Client-safe: only returns static standard codes
 */
export function getCostCodes(standard: CostCodeStandard = 'csi-16'): CostCode[] {
  if (standard === 'custom') {
    // Custom codes are fetched from database, not from static files
    return []
  }
  return STANDARDS[standard]?.codes || STANDARDS['csi-16'].codes
}

/**
 * Get the prompt text for a specific standard to inject into the AI system prompt
 * Client-safe: only returns static standard prompts
 * For custom codes with userId, use the server-side version in lib/cost-codes/server-helpers.ts
 */
export function getRelevantCostCodesForPrompt(standard: CostCodeStandard = 'csi-16'): string {
  // For standard codes, return static prompt
  if (standard === 'custom') {
    return 'Custom cost codes are not available. Please use a standard cost code set.'
  }

  return STANDARDS[standard]?.prompt || STANDARDS['csi-16'].prompt
}

/**
 * Get the display name for a standard
 */
export function getStandardName(standard: CostCodeStandard): string {
  if (standard === 'custom') {
    return 'Custom Cost Codes'
  }
  return STANDARDS[standard]?.name || STANDARDS['csi-16'].name
}

