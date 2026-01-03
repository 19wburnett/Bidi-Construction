/**
 * Prompts for Multi-AI Review Stage
 * 
 * These prompts are used by different AI reviewers to:
 * 1. Review existing takeoff items for completeness and accuracy
 * 2. Re-analyze plans to find missing items
 * 3. Validate quantities and cost codes
 */

import { getRelevantCostCodesForPrompt, CostCodeStandard, getStandardName } from '@/lib/cost-code-helpers'

/**
 * Build prompt for Reviewer 1: Review existing takeoff items
 */
export function buildReviewTakeoffPrompt(
  takeoffItems: any[],
  costCodeStandard: CostCodeStandard = 'csi-16'
): string {
  const standardName = getStandardName(costCodeStandard)
  const costCodeInstructions = getRelevantCostCodesForPrompt(costCodeStandard)
  
  const itemsSummary = takeoffItems.map((item, idx) => 
    `${idx + 1}. ${item.name || item.description} - ${item.quantity || 'N/A'} ${item.unit || ''} - ${item.category || 'unknown'} - Cost Code: ${item.cost_code || 'N/A'}`
  ).join('\n')

  return `You are an expert construction estimator reviewing a takeoff analysis performed by another AI model.

YOUR TASK: Review the following takeoff items and identify:
1. Items with missing or incomplete information
2. Items with missing measurements that prevent accurate quantity calculation
3. Items with missing quantities (counts not specified)
4. Items with incorrect or missing cost codes
5. Items that may be missing from the takeoff entirely
6. Items where quantities cannot be calculated due to missing dimensions

TAKEOFF ITEMS TO REVIEW:
${itemsSummary}

${costCodeInstructions}

REVIEW REQUIREMENTS:
- For each item, check if it has all necessary information for a complete estimate
- Identify what measurements are missing (length, width, height, area, etc.)
- Identify what quantities are missing (item counts, quantities)
- Verify cost code assignments are correct for ${standardName}
- Check if quantities can be calculated from available information
- Identify items that should be in the takeoff but are missing

RESPONSE FORMAT:
Return ONLY a valid JSON object with this structure:
{
  "reviewed_items": [
    {
      "item_index": 1,
      "item_name": "Item name from takeoff",
      "status": "complete|missing_measurements|missing_quantity|missing_specs|incorrect_cost_code",
      "missing_information": [
        {
          "category": "measurement|quantity|specification|detail|other",
          "missing_data": "What specific information is missing",
          "why_needed": "Why this information is needed for estimate",
          "where_to_find": "Where to find it (sheet numbers, schedules, etc.)",
          "impact": "critical|high|medium|low"
        }
      ],
      "cost_code_issues": "Any issues with cost code assignment",
      "quantity_calculable": true|false,
      "notes": "Additional review notes"
    }
  ],
  "missing_items": [
    {
      "item_name": "Item that should be in takeoff",
      "category": "structural|exterior|interior|mep|finishes|other",
      "reason": "Why this item should be included",
      "location": "Where in plans this item appears",
      "cost_code": "Suggested cost code",
      "impact": "critical|high|medium|low"
    }
  ],
  "summary": {
    "items_reviewed": 0,
    "items_with_issues": 0,
    "missing_items_found": 0,
    "critical_issues": 0,
    "notes": "Overall review summary"
  }
}

CRITICAL INSTRUCTIONS:
- Be thorough - identify ALL missing information
- Be specific about what's missing and why it's needed
- Provide actionable guidance on where to find missing information
- Assign appropriate impact levels
- If an item's quantity cannot be calculated, mark quantity_calculable as false and explain why
- Identify items that should be in the takeoff but are missing`
}

/**
 * Build prompt for Reviewer 2: Re-analyze plans for missing items
 */
export function buildReanalyzePlansPrompt(
  imageCount: number,
  costCodeStandard: CostCodeStandard = 'csi-16',
  existingItems?: any[]
): string {
  const standardName = getStandardName(costCodeStandard)
  const costCodeInstructions = getRelevantCostCodesForPrompt(costCodeStandard)
  
  const existingItemsNote = existingItems && existingItems.length > 0 
    ? `\n\nEXISTING TAKEOFF ITEMS (${existingItems.length} items already identified - focus on finding items NOT in this list):\n${existingItems.slice(0, 20).map((item, idx) => `${idx + 1}. ${item.name || item.description}`).join('\n')}${existingItems.length > 20 ? '\n... (and more)' : ''}`
    : ''

  return `You are an expert construction estimator re-analyzing construction plans to find items that may have been missed in the initial takeoff analysis.

YOUR TASK: 
1. Analyze the provided plan images thoroughly
2. Find items that should be in the takeoff but may be missing
3. Identify items visible in plans but missing measurements/quantities needed for takeoff
4. Focus on items NOT already identified in the existing takeoff

${costCodeInstructions}

IMAGES PROVIDED: ${imageCount} page${imageCount > 1 ? 's' : ''} of construction plans${existingItemsNote}

ANALYSIS FOCUS:
- Look for items that may have been overlooked
- Check all categories: structural, exterior, interior, mep, finishes, other
- Verify all doors, windows, fixtures, outlets, switches are accounted for
- Check for missing material layers (foundation, framing, insulation, finishes)
- Verify all MEP components are included
- Check for missing finishes, hardware, accessories

MISSING INFORMATION IDENTIFICATION:
For each item you find, identify:
- What measurements are missing (if any)
- What quantities are missing (if any)
- What specifications are missing (if any)
- Where to find the missing information

RESPONSE FORMAT:
Return ONLY a valid JSON object with this structure:
{
  "missing_items": [
    {
      "name": "Item name",
      "description": "Detailed description",
      "category": "structural|exterior|interior|mep|finishes|other",
      "subcategory": "Specific subcategory",
      "cost_code": "Suggested ${standardName} cost code",
      "cost_code_description": "Cost code description",
      "location": "Where in plans this item appears",
      "bounding_box": {
        "page": 1,
        "x": 0.25,
        "y": 0.30,
        "width": 0.15,
        "height": 0.10
      },
      "missing_information": [
        {
          "category": "measurement|quantity|specification|detail|other",
          "missing_data": "What specific information is missing",
          "why_needed": "Why this information is needed for estimate",
          "where_to_find": "Where to find it (sheet numbers, schedules, etc.)",
          "impact": "critical|high|medium|low"
        }
      ],
      "confidence": 0.85
    }
  ],
  "items_with_missing_data": [
    {
      "item_name": "Item visible in plans",
      "missing_measurements": ["What measurements are missing"],
      "missing_quantities": ["What quantities are missing"],
      "where_to_find": "Where to find missing information",
      "impact": "critical|high|medium|low"
    }
  ],
  "summary": {
    "missing_items_found": 0,
    "items_with_missing_data": 0,
    "critical_missing_info": 0,
    "notes": "Summary of findings"
  }
}

CRITICAL INSTRUCTIONS:
- Focus on finding items NOT in the existing takeoff
- Be thorough - check all plan pages
- Identify what information is missing for each item
- Provide specific guidance on where to find missing information
- Assign appropriate impact levels
- Use correct ${standardName} cost codes`
}

/**
 * Build prompt for Reviewer 3: Validate quantities and cost codes
 */
export function buildValidationPrompt(
  primaryTakeoff: any,
  reviewFindings?: any
): string {
  const items = primaryTakeoff.items || []
  const reviewItems = reviewFindings?.reviewed_items || []
  const missingItems = reviewFindings?.missing_items || []

  return `You are an expert construction estimator validating takeoff quantities and cost code assignments.

YOUR TASK:
1. Validate that quantities can be calculated from available measurements
2. Verify cost code assignments are correct
3. Check for discrepancies between primary takeoff and review findings
4. Flag items where calculations are impossible due to missing data

PRIMARY TAKEOFF ITEMS:
${items.map((item: any, idx: number) => 
  `${idx + 1}. ${item.name || item.description} - ${item.quantity || 'N/A'} ${item.unit || ''} - Cost Code: ${item.cost_code || 'N/A'} - Dimensions: ${item.dimensions || 'N/A'}`
).join('\n')}

${reviewItems.length > 0 ? `\nREVIEW FINDINGS:\n${reviewItems.map((item: any) => 
  `- ${item.item_name}: ${item.status} - ${item.quantity_calculable ? 'Quantity calculable' : 'Quantity NOT calculable'}`
).join('\n')}` : ''}

${missingItems.length > 0 ? `\nMISSING ITEMS IDENTIFIED:\n${missingItems.map((item: any) => 
  `- ${item.item_name}: ${item.reason}`
).join('\n')}` : ''}

VALIDATION REQUIREMENTS:
- For each item, verify if quantity can be calculated from available dimensions
- Check if cost codes match the work being performed
- Identify items where calculations are impossible
- Flag discrepancies between primary and review findings
- Validate that all required information is present for accurate estimates

RESPONSE FORMAT:
Return ONLY a valid JSON object with this structure:
{
  "validated_items": [
    {
      "item_index": 1,
      "item_name": "Item name",
      "quantity_valid": true|false,
      "quantity_validation_notes": "Why quantity is valid or invalid",
      "cost_code_valid": true|false,
      "cost_code_validation_notes": "Any cost code issues",
      "calculation_possible": true|false,
      "missing_for_calculation": ["What's missing to calculate quantity"],
      "discrepancies": ["Any discrepancies found"],
      "recommendation": "Recommendation for this item"
    }
  ],
  "impossible_calculations": [
    {
      "item_name": "Item name",
      "reason": "Why calculation is impossible",
      "missing_data": ["What data is missing"],
      "impact": "critical|high|medium|low"
    }
  ],
  "summary": {
    "items_validated": 0,
    "valid_quantities": 0,
    "invalid_quantities": 0,
    "impossible_calculations": 0,
    "cost_code_issues": 0,
    "notes": "Validation summary"
  }
}

CRITICAL INSTRUCTIONS:
- Be strict - flag items where calculations are impossible
- Verify cost codes are appropriate for the work
- Identify all missing data that prevents calculations
- Provide clear recommendations
- Assign appropriate impact levels`
}
