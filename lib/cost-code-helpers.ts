import * as AMEX from './cost-codes/amex'
import * as CSI16 from './cost-codes/csi-16'
import * as CSI50 from './cost-codes/csi-50'
import * as NAHB from './cost-codes/nahb'

export type CostCodeStandard = 'amex' | 'csi-16' | 'csi-50' | 'nahb'

export interface CostCode {
  division: string
  code: string
  description: string
  fullCode: string
}

const STANDARDS: Record<CostCodeStandard, { codes: CostCode[], prompt: string, name: string }> = {
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

export const AVAILABLE_STANDARDS: { id: CostCodeStandard, name: string }[] = Object.entries(STANDARDS).map(
  ([id, data]) => ({ id: id as CostCodeStandard, name: data.name })
)

/**
 * Get all cost codes for a specific standard
 */
export function getCostCodes(standard: CostCodeStandard = 'csi-16'): CostCode[] {
  return STANDARDS[standard]?.codes || STANDARDS['csi-16'].codes
}

/**
 * Get the prompt text for a specific standard to inject into the AI system prompt
 */
export function getRelevantCostCodesForPrompt(standard: CostCodeStandard = 'csi-16'): string {
  return STANDARDS[standard]?.prompt || STANDARDS['csi-16'].prompt
}

/**
 * Get the display name for a standard
 */
export function getStandardName(standard: CostCodeStandard): string {
  return STANDARDS[standard]?.name || STANDARDS['csi-16'].name
}

