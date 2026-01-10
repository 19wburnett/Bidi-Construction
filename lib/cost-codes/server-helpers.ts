/**
 * Server-side cost code helpers
 * These functions require server-side Supabase client and cannot be used in client components
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CostCode, CostCodeStandard } from '@/lib/cost-code-helpers'

/**
 * Get custom cost codes for a user from database
 */
export async function getCustomCostCodes(userId: string): Promise<CostCode[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('custom_cost_codes')
      .select('cost_codes')
      .eq('user_id', userId)
      .eq('is_default', true)
      .eq('extraction_status', 'completed')
      .single()

    if (error || !data) {
      return []
    }

    return (data.cost_codes as CostCode[]) || []
  } catch (error) {
    console.error('[Cost Code Server Helpers] Error fetching custom cost codes:', error)
    return []
  }
}

/**
 * Format cost codes for AI prompt
 */
function formatCostCodesForPrompt(costCodes: CostCode[]): string {
  if (costCodes.length === 0) {
    return 'No cost codes available.'
  }

  // Group by division for better organization
  const byDivision = new Map<string, CostCode[]>()
  costCodes.forEach(code => {
    const div = code.division || 'OTHER'
    if (!byDivision.has(div)) {
      byDivision.set(div, [])
    }
    byDivision.get(div)!.push(code)
  })

  let prompt = 'CUSTOM COST CODE REFERENCE:\n'
  prompt += 'Use these user-defined cost codes for categorization:\n\n'

  // Sort divisions
  const sortedDivisions = Array.from(byDivision.keys()).sort()
  
  for (const division of sortedDivisions) {
    const codes = byDivision.get(division)!
    prompt += `Division ${division}:\n`
    codes.forEach(code => {
      prompt += `- ${code.fullCode || `${code.division}-${code.code}`}: ${code.description}\n`
    })
    prompt += '\n'
  }

  return prompt
}

/**
 * Get the prompt text for a specific standard to inject into the AI system prompt
 * This is the server-side version that can fetch custom cost codes
 */
export async function getRelevantCostCodesForPrompt(
  standard: CostCodeStandard,
  userId?: string
): Promise<string> {
  // Import client-side helpers for standard codes
  const { getRelevantCostCodesForPrompt: getStandardPrompt } = await import('@/lib/cost-code-helpers')
  
  // If custom and userId provided, fetch custom codes
  if (standard === 'custom' && userId) {
    const customCodes = await getCustomCostCodes(userId)
    return formatCostCodesForPrompt(customCodes)
  }

  // For standard codes or custom without userId, use client-side function
  if (standard === 'custom') {
    return 'Custom cost codes are not available. Please use a standard cost code set.'
  }

  return getStandardPrompt(standard)
}
