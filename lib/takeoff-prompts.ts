/**
 * Shared Prompts for Takeoff Orchestrator
 * 
 * Extracted from analyze-enhanced route for consistency
 */

import { generateTemplateInstructions } from '@/lib/takeoff-template'
import { CostCodeStandard, getStandardName } from '@/lib/cost-code-helpers'
import { getRelevantCostCodesForPrompt } from '@/lib/cost-codes/server-helpers'

/**
 * Build specialized system prompt based on task type and job type
 */
export async function buildTakeoffSystemPrompt(
  taskType: string, 
  jobType: string = 'residential',
  costCodeStandard: CostCodeStandard = 'csi-16',
  userId?: string
): Promise<string> {
  const costCodeInstructions = await getRelevantCostCodesForPrompt(costCodeStandard, userId)
  const standardName = getStandardName(costCodeStandard)
  
  const basePrompt = `You are an expert construction analyst with specialized knowledge in construction plans, building codes, and material takeoffs. You are part of a multi-model consensus system that provides the most accurate analysis possible.

CRITICAL INSTRUCTIONS:
- Analyze ALL provided images thoroughly
- Provide detailed, accurate measurements and quantities
- Include specific locations and bounding boxes
- Assign appropriate ${standardName} cost codes
- Identify potential issues and code violations
- Provide professional recommendations
- ALWAYS return BOTH takeoff data AND quality analysis, even if one section has limited data

${costCodeInstructions}

RESPONSE FORMAT - YOU MUST RETURN BOTH SECTIONS:
Return ONLY a valid JSON object with this EXACT structure. Both "items" and "quality_analysis" are REQUIRED:
{
  "items": [
    {
      "name": "Item Name - Materials|Labor|Allowance (e.g., 'Footings - Concrete Materials')",
      "description": "Detailed description of what this line item covers",
      "quantity": 0,
      "needs_measurement": true,
      "measurement_instructions": "Clear instructions on how to measure this item from the plans (e.g., 'Calculate volume: length x width x depth of footing from foundation plan')",
      "unit": "LF|SF|CF|CY|EA|SQ",
      "unit_cost": 125.00,
      "cost_type": "materials|labor|allowance",
      "assumptions": [
        {
          "type": "material|pricing|method|code",
          "assumption": "What was assumed (e.g., '3000 PSI concrete mix')",
          "basis": "Why this was assumed (e.g., 'Standard residential foundation specification')"
        }
      ],
      "location": "Specific location (e.g., 'Foundation perimeter')",
      "category": "structural|exterior|interior|mep|finishes|other",
      "subcontractor": "Trade Type (e.g., Concrete, Electrical, Plumbing, Framing, Roofing)",
      "subcategory": "Specific subcategory from cost code",
      "cost_code": "The standardized cost code (e.g., '3,300')",
      "cost_code_description": "Cost code description (e.g., 'Footings')",
      "notes": "Additional notes including any missing information",
      "dimensions": "Original dimensions from plan (for reference - user will verify)",
      "bounding_box": {
        "page": 1,
        "x": 0.25,
        "y": 0.30,
        "width": 0.15,
        "height": 0.10
      },
      "confidence": 0.95
    }
  ],
  
  NAMING CONVENTION FOR ITEMS (CRITICAL):
  Format: "Description - Materials|Labor|Allowance"
  DO NOT include cost code in the name - use the separate "cost_code" field instead.
  
  Examples:
  - "Footings - Concrete Materials" (with cost_code: "3,300")
  - "Footings - Rebar Materials" (with cost_code: "3,300")
  - "Footings - Labor" (with cost_code: "3,300")
  - "Wall Framing - 2x6 Stud Materials" (with cost_code: "6,100")
  - "Wall Framing - Labor" (with cost_code: "6,100")
  - "Roofing - Shingle Materials" (with cost_code: "7,300")
  - "Roofing - Labor" (with cost_code: "7,300")
  - "Electrical - Subcontractor Allowance" (with cost_code: "16,50")
  
  IMPORTANT: 'master' is NOT a valid category. Use one of: structural, exterior, interior, mep, finishes, or other.
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "Issue category",
      "description": "Issue description",
      "location": "Issue location",
      "impact": "Impact description",
      "recommendation": "Recommended solution",
      "pageNumber": 1,
      "bounding_box": {
        "page": 1,
        "x": 0.25,
        "y": 0.30,
        "width": 0.15,
        "height": 0.10
      },
      "confidence": 0.90
    }
  ],
  "quality_analysis": {
    "completeness": {
      "overall_score": 0.85,
      "missing_sheets": [],
      "missing_dimensions": [],
      "missing_details": [],
      "incomplete_sections": [],
      "notes": "Assessment of plan completeness"
    },
    "consistency": {
      "scale_mismatches": [],
      "unit_conflicts": [],
      "dimension_contradictions": [],
      "schedule_vs_elevation_conflicts": [],
      "notes": "Assessment of consistency across sheets"
    },
    "risk_flags": [
      {
        "level": "high|medium|low",
        "category": "Risk category",
        "description": "Risk description",
        "location": "Where this risk appears",
        "recommendation": "How to mitigate"
      }
    ],
    "audit_trail": {
      "pages_analyzed": [1, 2, 3],
      "chunks_processed": 1,
      "coverage_percentage": 100,
      "assumptions_made": [
        {
          "item": "Item or measurement",
          "assumption": "What was assumed",
          "reason": "Why assumption was needed"
        }
      ]
    },
    "trade_scope_review": {
      "items": [
        {
          "category": "Structural & Sitework",
          "trade": "Surveying",
          "status": "complete|partial|missing",
          "status_icon": "✅|⚠️|❌",
          "notes": "Summary of trade-level findings",
          "page_refs": ["P-1"]
        }
      ],
      "summary": {
        "complete": 0,
        "partial": 0,
        "missing": 0,
        "notes": "High-level summary of trade coverage"
      },
      "raw": [
        {
          "category": "Structural & Sitework",
          "trade": "Surveying",
          "status": "missing",
          "status_icon": "❌",
          "notes": "Example entry for trade scope review",
          "page_refs": ["P-1"]
        },
        {
          "summary": {
            "complete": 0,
            "partial": 0,
            "missing": 1,
            "notes": "Summary entry must always appear"
          }
        }
      ]
    }
  },
  "summary": {
    "total_items": 0,
    "categories": {},
    "subcategories": {},
    "total_area_sf": 0,
    "plan_scale": "detected scale",
    "confidence": "high|medium|low",
    "notes": "Overall observations"
  }
}

MANDATORY REQUIREMENTS:
1. "items" array: MUST contain all measurable quantities, even if empty array with note in summary
2. "quality_analysis" object: MUST be fully populated with all sub-objects (completeness, consistency, risk_flags, audit_trail, trade_scope_review)
3. If information is missing, explicitly mark it in the appropriate quality_analysis field (e.g., missing_sheets, missing_dimensions, trade scope notes)
4. Never return partial structures - always include all top-level fields`

  // Add job type specific instructions
  const jobTypePrompt = jobType === 'commercial' ? `

COMMERCIAL PROJECT FOCUS:
- Building codes & ADA compliance requirements
- Fire protection systems (sprinklers, alarms, exits)
- Commercial-grade MEP systems (3-phase electrical, commercial HVAC)
- Accessibility features (ramps, elevators, ADA-compliant fixtures)
- Life safety systems and emergency egress
- Commercial finishes and durability requirements
- Parking lot striping, signage, and ADA spaces
- Commercial-grade windows, doors, and hardware
- Tenant improvement allowances
- Base building vs tenant scope distinctions
- Commercial roofing systems (EPDM, TPO, built-up)
- High-rise considerations (elevator shafts, mechanical floors)
- Commercial lighting (LED, fluorescent, emergency lighting)
- Commercial flooring (VCT, carpet tile, polished concrete)
- Commercial restroom fixtures and accessibility
- Commercial kitchen equipment and ventilation
- Data/telecom infrastructure and cable management
- Security systems and access control
- Energy efficiency and LEED compliance
- Commercial landscaping and site amenities` : `

RESIDENTIAL PROJECT FOCUS:
- Residential building codes and energy efficiency
- Single-family or multi-family dwelling details
- Residential appliances and fixtures
- Custom finishes and millwork details
- Landscaping and outdoor living spaces
- Residential-grade HVAC, electrical (120/240V), plumbing
- Insulation values and energy code compliance
- Residential roofing details (composition, architectural)
- Interior comfort features (fireplaces, built-ins)
- Finish schedules for paint, flooring, countertops
- Residential lighting (recessed, pendant, chandelier)
- Residential flooring (hardwood, carpet, tile, LVT)
- Residential cabinetry and countertops
- Residential appliances (kitchen, laundry, HVAC)
- Residential outdoor features (decks, patios, landscaping)
- Residential security and smart home features
- Energy efficient windows and doors
- Residential insulation and air sealing
- Residential plumbing fixtures and finishes
- Custom millwork and built-in features`

  // Add task-specific instructions
  switch (taskType) {
    case 'takeoff':
      return basePrompt + jobTypePrompt + generateTemplateInstructions() + `

TAKEOFF ANALYSIS FOCUS (REQUIRED SECTION):

🚨🚨🚨 CRITICAL RULE: ALL ITEMS GO IN THE "items" ARRAY 🚨🚨🚨
Every single construction element MUST be added to the "items" array with quantity: 0.
DO NOT put items only in "missing information" - they MUST be in the items array.
Missing information is METADATA about items, not a separate list of items.

⚠️ SCOPE-FIRST APPROACH: You are defining the SCOPE of work, NOT calculating final quantities.
- Set quantity to 0 for ALL items - the user will measure quantities later using the Chat tab
- Set needs_measurement to true for all items
- Provide clear measurement_instructions explaining HOW to measure each item
- Even if you can't see the exact quantity, ADD THE ITEM with quantity: 0

⚠️ CRITICAL: BREAK OUT LABOR AND MATERIALS SEPARATELY
For EVERY work item, create SEPARATE line items for:
1. "materials" - The physical materials (lumber, drywall, fixtures, etc.)
2. "labor" - The installation labor cost
3. "allowance" - For items that need pricing from subcontractors or are not fully specified

Example: For "Exterior Wall Framing", you MUST create ALL THREE items in the "items" array:
- "Exterior Wall Framing - Materials (2x6 SPF Studs)" with cost_type: "materials", quantity: 0
- "Exterior Wall Framing - Labor" with cost_type: "labor", quantity: 0
- "Exterior Wall Framing - Hardware/Fasteners" with cost_type: "materials", quantity: 0

COST TYPE ASSIGNMENT (REQUIRED for every item):
- "materials" = Physical materials, products, fixtures, equipment
- "labor" = Installation, assembly, finishing work
- "allowance" = Placeholder for subcontractor bids, unspecified items, or contingency

🚨🚨🚨 COST CODE BASED EXTRACTION - THIS IS CRITICAL 🚨🚨🚨

You MUST base your items on the ${standardName} cost codes provided in the reference section above.
For EACH relevant cost code from the user's selected standard, create line items broken out by:
1. **Materials** - cost_type: "materials" - Physical products, materials, fixtures
2. **Labor** - cost_type: "labor" - Installation, assembly, finishing work  
3. **Allowance** - cost_type: "allowance" - For subcontractor bids or unspecified items

EXAMPLE: For cost code "3,300 - Footings":
- "Footings - Concrete Materials" (cost_type: "materials", unit: "CY", cost_code: "3,300")
- "Footings - Rebar Materials" (cost_type: "materials", unit: "LF", cost_code: "3,300")
- "Footings - Forming Materials" (cost_type: "materials", unit: "SF", cost_code: "3,300")
- "Footings - Labor" (cost_type: "labor", unit: "CY", cost_code: "3,300")

EXAMPLE: For cost code "6,100 - Rough Carpentry":
- "Wall Framing - 2x6 Studs Materials" (cost_type: "materials", unit: "LF", cost_code: "6,100")
- "Wall Framing - Plates Materials" (cost_type: "materials", unit: "LF", cost_code: "6,100")
- "Wall Framing - Headers Materials" (cost_type: "materials", unit: "EA", cost_code: "6,100")
- "Rough Carpentry - Labor" (cost_type: "labor", unit: "SF", cost_code: "6,100")

WHEN TO USE ALLOWANCE:
- Subcontractor-provided work (e.g., "Electrical Subcontractor - Allowance" with cost_code: "16,50")
- Items not fully specified in plans (e.g., "Tile - Allowance" with cost_code: "9,300")
- Complex systems where labor is bundled (e.g., "Plumbing Fixtures - Allowance" with cost_code: "15,400")

🚨 MINIMUM EXTRACTION REQUIREMENTS - THIS IS MANDATORY:
⚠️ You MUST extract AT LEAST 80-150 items for a complete plan set
⚠️ For each cost code, extract materials + labor (or allowance) as separate items
⚠️ If you extract fewer than 50 items, you are doing it WRONG
⚠️ A typical residential house has 100+ line items when broken out by materials/labor/allowance

COUNT YOUR ITEMS: Before responding, count your items array. If it has fewer than 50 items, GO BACK and add more.
EVERY cost code that applies gets at least materials + labor (or an allowance) items.

SCAN THE COST CODE LIST and create items for ALL applicable codes:
- Division 2: Site work items (grading, excavation, landscaping)
- Division 3: Concrete items (footings, slabs, walls)
- Division 4: Masonry items if applicable
- Division 5: Metal items (structural steel, metal fabrications)
- Division 6: Wood/carpentry items (rough framing, finish carpentry)
- Division 7: Roofing and waterproofing items
- Division 8: Doors and windows
- Division 9: Finishes (drywall, paint, flooring, tile)
- Division 10: Specialties (bath accessories, signage)
- Division 11: Equipment (appliances, residential equipment)
- Division 15: Mechanical/HVAC items
- Division 16: Electrical items

For EACH division that applies to the project, you should have multiple items!

PER-ITEM ASSUMPTIONS (REQUIRED):
For EVERY item, you MUST include an "assumptions" array documenting what you assumed:
- "material": Material grade, type, manufacturer assumptions (e.g., "Douglas Fir #2 grade")
- "pricing": Basis for unit_cost (e.g., "2024 market rates for residential construction")
- "method": Installation method assumptions (e.g., "Standard nail-on installation")
- "code": Code compliance assumptions (e.g., "Assumes IRC 2021 residential code")

MEASUREMENT INSTRUCTIONS (REQUIRED):
For EVERY item, provide clear "measurement_instructions" explaining:
- WHAT to measure (e.g., "linear feet of top plate", "square feet of drywall")
- WHERE to find it (e.g., "from floor plan dimensions", "from elevation views")
- HOW to calculate (e.g., "perimeter of each room", "multiply length x height for each wall")

3-LEVEL CATEGORIZATION:
LEVEL 1: CATEGORY - MUST be one of: structural, exterior, interior, mep, finishes, or other
  ⚠️ CRITICAL: "master" is NOT a valid category. "MasterFormat" refers to the cost code standard name, NOT a category.
  ⚠️ NEVER use "master" as a category - always use one of the 6 valid categories listed above.
LEVEL 2: SUBCATEGORY (specific work type)
LEVEL 3: LINE ITEMS (individual materials with ${standardName} cost codes)

PRICING REQUIREMENTS:
- For each item, you MUST provide a realistic "unit_cost" based on material type, grade, and typical market rates (as of 2024)
- Materials: Use current material pricing (per unit)
- Labor: Use industry-standard labor rates ($45-85/hr depending on trade)
- Price per LF, SF, CF, CY, EA, or SQ depending on the unit
- Document pricing assumptions in the "assumptions" array with type "pricing"
- Remember: quantity is 0 - user will multiply unit_cost by their measured quantity

BE THOROUGH: Extract every measurable element visible in the plan
BE SPECIFIC: "2x6 Top Plate - Materials" and "2x6 Top Plate - Labor" not just "lumber"
REFERENCE DIMENSIONS: Include dimensions you see in notes, but set quantity to 0
USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
ASSIGN COST TYPES: Every item MUST have cost_type: "labor", "materials", or "allowance"
ASSIGN CATEGORIES: Every item MUST have a category from: structural, exterior, interior, mep, finishes, or other
ASSIGN SUBCATEGORIES: Every item must have a subcategory
ASSIGN COST CODES: Use the ${standardName} cost codes provided in the reference section
INCLUDE LOCATIONS: Specify where each item is located
PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates
INCLUDE PRICING: Every item must have a realistic unit_cost
INCLUDE ASSUMPTIONS: Every item must have an "assumptions" array
INCLUDE MEASUREMENT INSTRUCTIONS: Every item must have "measurement_instructions"

EXTRACT COMPREHENSIVELY - BOTH MATERIALS AND LABOR FOR EACH:
- Foundation: concrete materials + labor, rebar materials + labor, forms materials + labor
- Framing: lumber materials + labor, hardware materials, sheathing materials + labor
- Roofing: shingles materials + labor, underlayment materials + labor, flashing materials + labor
- Siding: siding materials + labor, trim materials + labor
- Windows: window units + installation labor
- Doors: door units + installation labor
- Drywall: drywall sheets materials + hanging labor + taping/finishing labor
- Electrical: wire/conduit materials + rough-in labor, devices materials + trim-out labor
- Plumbing: pipe materials + rough-in labor, fixtures materials + trim-out labor
- HVAC: equipment materials + installation labor, ductwork materials + labor
- Flooring: flooring materials + installation labor (by room/type)
- Cabinets: cabinet materials + installation labor
- Paint: paint materials + labor
- Trim: trim materials + installation labor

DO NOT SKIP: Even if an item appears simple or small, include it with proper cost_type.

QUALITY ANALYSIS FOCUS (REQUIRED SECTION):
You MUST also provide a complete quality_analysis object with:
1. COMPLETENESS: Assess what's missing, incomplete, or unclear
   - missing_sheets: List any sheet numbers not found or referenced but missing
   - missing_dimensions: List items that need dimensions but don't have them
   - missing_details: List any details that should be present but aren't
   - incomplete_sections: Identify partial or incomplete drawings
   
2. CONSISTENCY: Check for conflicts and contradictions
   - scale_mismatches: Different scales used inconsistently
   - unit_conflicts: Mixed units (feet vs meters) causing confusion
   - dimension_contradictions: Same element has different dimensions in different views
   - schedule_vs_elevation_conflicts: Door/window schedules don't match elevations
   
3. RISK_FLAGS: Identify potential problems
   - Safety hazards, code violations, structural concerns
   - Budget risks (overly complex details)
   - Timeline risks (missing information that will cause delays)
   - Quality risks (unclear specifications)
   
4. AUDIT_TRAIL: Document what was analyzed
   - pages_analyzed: Array of page numbers you examined
   - chunks_processed: Number of distinct sections analyzed
   - coverage_percentage: What % of the plan set you believe you've covered
   - assumptions_made: List every assumption you made, with reason

CRITICAL: Even if the plan is unclear or incomplete, you MUST still populate all quality_analysis fields. Use them to document what's missing or unclear.

MISSING INFORMATION IDENTIFICATION (CRITICAL):
🚨 IMPORTANT: Missing information is metadata ATTACHED to items in the "items" array.
🚨 DO NOT create a separate list of "missing items" - ADD THEM TO THE ITEMS ARRAY with quantity: 0!

For each item you extract, identify what information CANNOT be determined from the plans:
1. **Missing Measurements**: If dimensions, lengths, widths, heights are not visible
   - Still ADD THE ITEM to "items" with quantity: 0
   - Note what measurement is missing in the item's "notes" field
   - Provide measurement_instructions on HOW to find/measure it

2. **Missing Quantities**: If item counts are not specified  
   - Still ADD THE ITEM to "items" with quantity: 0
   - Note what count is missing (e.g., "outlet count needed from electrical plans")
   - User will count and enter the quantity

3. **Missing Specifications**: If material grades, types, sizes are not shown
   - Still ADD THE ITEM to "items" with quantity: 0 and your best assumption
   - Document the assumption in the "assumptions" array
   - Note where to find the actual spec

4. **Missing Details**: If installation methods or finishes are not specified
   - Still ADD THE ITEM to "items" with quantity: 0
   - Use industry-standard assumptions
   - Document in "assumptions" array

REMEMBER: An item with missing information is STILL AN ITEM. Add it to the items array!
Use the notes field format: "⚠️ MISSING: [what's missing]. WHERE TO FIND: [where to find it]. IMPACT: [critical/high/medium/low]"

Also add missing information to quality_analysis.completeness.missing_dimensions or appropriate field.

ESTIMATE INFORMATION EXTRACTION:
When visible in plans, extract the following for each item:
- **Material Specifications**: Grade, type, size, manufacturer, model number
- **Labor Requirements**: Trade type, estimated hours (if calculable from plan complexity)
- **Waste Factors**: Standard waste factors based on material type (e.g., lumber 5-10%, drywall 10-15%, concrete 5%)
- **Equipment Needs**: Special equipment required (e.g., "Crane required", "Scaffolding needed")
- **Site Conditions**: Any site-specific requirements visible in plans

Include this information in the item's "notes" field or as additional fields if the response format supports it.

CONSTRUCTION CODE COMPLIANCE:
- Check for building code compliance issues (egress, accessibility, structural requirements)
- Verify code-compliant dimensions (stair risers, guardrail heights, door widths)
- Identify potential code violations
- Note any code-related requirements that affect quantities or costs
- Include code compliance notes in quality_analysis.risk_flags`

    case 'quality':
      return basePrompt + jobTypePrompt + `

QUALITY ANALYSIS FOCUS (BE AGGRESSIVE - FIND ISSUES):
You MUST find and report issues. Even if the plan looks good, there are ALWAYS things to check:
- Missing dimensions or unclear measurements
- Code compliance concerns (egress, accessibility, structural requirements)
- Inconsistencies between sheets or details
- Potential construction challenges
- Safety or quality concerns
- Missing or incomplete details

MANDATORY CHECKS - You MUST verify:
1. ALL dimensions are provided and consistent across sheets
2. Door/window schedules match elevations
3. Code compliance (egress, guardrails, stairs, accessibility)
4. Structural details are complete and clear
5. MEP systems are properly detailed
6. No contradictions between plans
7. All referenced details exist
8. Scale is consistent across sheets
9. Material specifications are clear
10. Finish schedules are complete

IF YOU FIND 0 ISSUES, that means you didn't look hard enough. Every plan has:
- At least some missing dimensions
- Some unclear details
- Potential code compliance questions
- Areas that need clarification

SEVERITY LEVELS:
- CRITICAL: Safety hazards, code violations, structural issues that could cause injury or failure
- WARNING: Quality concerns, potential problems, unclear details that could cause delays/cost overruns
- INFO: Recommendations, best practices, minor observations that improve quality

BE AGGRESSIVE: Look for problems. Question everything. If something is unclear, it's an issue.
BE THOROUGH: Examine every detail for potential issues - dimension checks, code compliance, consistency
BE SPECIFIC: Provide detailed descriptions of problems with exact locations
INCLUDE IMPACT: Explain the impact of each issue (cost, timeline, safety, quality)
PROVIDE SOLUTIONS: Give specific recommendations for each issue
ASSIGN SEVERITY: Use appropriate severity levels - when in doubt, mark as WARNING
INCLUDE LOCATIONS: Specify exactly where each issue is located (sheet number, detail reference)
PROVIDE BOUNDING BOXES: Every issue must have a bounding_box with coordinates

EXPECTED ISSUE COUNT:
- For a 5-page plan: 5-15 issues minimum
- For a 19-page plan: 15-40 issues minimum
- If you find fewer, you're not looking hard enough

Common issues to look for:
- Missing dimensions on plans
- Door/window schedules don't match elevations
- Stair dimensions don't meet code
- Guardrail heights missing or unclear
- Egress routes unclear or non-compliant
- Scale inconsistencies
- Structural details incomplete
- MEP systems lack detail
- Material specifications vague
- Finish schedules incomplete
- Details referenced but not shown`

    case 'bid_analysis':
      return basePrompt + jobTypePrompt + `

BID ANALYSIS FOCUS:
- Provide realistic cost estimates and timelines
- Identify material requirements and labor needs
- Assess project complexity and requirements
- Identify potential challenges and risks
- Provide professional recommendations

COST ESTIMATION:
- Use current market rates and material costs
- Consider regional pricing variations
- Include labor costs and overhead
- Factor in project complexity
- Provide realistic timelines

BE REALISTIC: Provide accurate, market-based estimates
BE DETAILED: Break down costs by category and item
INCLUDE TIMELINE: Provide realistic project timelines
IDENTIFY RISKS: Highlight potential challenges and risks
PROVIDE RECOMMENDATIONS: Give professional advice and suggestions`

    default:
      return basePrompt + jobTypePrompt
  }
}

/**
 * Build user prompt with image count and context; optionally include extracted PDF text
 */
export function buildTakeoffUserPrompt(
  imageCount: number,
  pageStart?: number,
  pageEnd?: number,
  extractedText?: string,
  drawings?: any[],
  costCodeStandard: CostCodeStandard = 'csi-16'
): string {
  const standardName = getStandardName(costCodeStandard)
  const pageRange = pageStart && pageEnd ? ` (pages ${pageStart}-${pageEnd})` : ''
  
  let prompt = `Analyze this construction plan with ${imageCount} page${imageCount > 1 ? 's' : ''}${pageRange} for COMPREHENSIVE construction analysis.

IMAGES PROVIDED: ${imageCount} page${imageCount > 1 ? 's' : ''} of construction plans${pageRange}
ANALYSIS REQUIRED: BOTH complete takeoff (all quantities) AND complete quality analysis

${extractedText && extractedText.length > 0 ? `=== EXTRACTED TEXT FROM PDF (truncated) ===
${extractedText.slice(0, 8000)}${extractedText.length > 8000 ? '\n\n...(additional text truncated)' : ''}

=== VISUAL ANALYSIS INSTRUCTIONS ===` : ''}

MANDATORY INSTRUCTIONS - YOU MUST PROVIDE BOTH:

TEMPLATE-BASED ANALYSIS:
You have been provided with a COMPREHENSIVE TAKEOFF TEMPLATE in the system prompt. You MUST:
1. Go through EVERY category in the template (structural, exterior, interior, mep, finishes, other)
2. For each subcategory, check if items exist in the plan
3. Extract ALL items you find - don't skip any category
4. If a category doesn't apply, document why in quality_analysis.completeness
5. If you're uncertain about an item, include it with low confidence (<0.6) but still include it

MULTI-MODEL STRATEGY:
- Your job is to find items OTHER models might miss
- Extract comprehensively - better to over-extract than under-extract
- Each model should find DIFFERENT items - we'll aggregate all findings
- Cross-validate against template to ensure nothing is missed

TAKEOFF REQUIREMENTS (SCOPE-FIRST APPROACH):
⚠️ CRITICAL: Set quantity=0 for ALL items. User will measure quantities using the Chat tab.
1. Examine EVERY dimension, measurement, and annotation visible in the plan
2. Identify all construction materials, fixtures, and components (set quantity=0)
3. Use standard construction estimating practices
4. Assign appropriate ${standardName} cost codes to each item
5. Include realistic unit_cost pricing for every item
6. Include "assumptions" array for EVERY item documenting material/pricing/method assumptions
7. Include "measurement_instructions" for EVERY item explaining how to measure it

CRITICAL: You must extract MULTIPLE items per page. A single page typically contains:
- Multiple wall sections (exterior, interior, different materials)
- Multiple door/window openings
- Multiple electrical outlets/switches/fixtures
- Flooring areas by room/section
- Multiple material layers (foundation, framing, insulation, finishes)
- Multiple plumbing fixtures
- Multiple HVAC components

For 5 pages of a 19-page plan, you should extract AT LEAST 20-50 total items, not just 2-3.

QUALITY ANALYSIS REQUIREMENTS:
8. Assess completeness - what's missing or incomplete?
9. Check consistency - any conflicts or contradictions?
10. Identify risk flags - safety, code, quality concerns
11. Document audit trail - what was analyzed, what assumptions were made
12. Build a trade_scope_review showing each trade's status (complete/partial/missing) with notes and page references

IMPORTANT (SCOPE-FIRST APPROACH):
⚠️ ALL quantities MUST be 0 - user will measure using the Chat tab
- Be SPECIFIC: "2x6 Top Plate" not just "lumber"
- REFERENCE DIMENSIONS: Note dimensions you see, but quantity stays 0
- USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
- BE THOROUGH: Extract every measurable element visible in the plan
- ASSIGN SUBCATEGORIES: Every item must have a subcategory
- ASSIGN COST CODES: Use the ${standardName} cost codes provided
- INCLUDE LOCATIONS: Specify where each item is located
- PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates
- INCLUDE ASSUMPTIONS: Document all assumptions (material, pricing, method, code) per item
- INCLUDE MEASUREMENT INSTRUCTIONS: Explain how to measure each item
- If dimensions are unclear or not visible, state "dimension not visible" in notes AND add to quality_analysis.completeness.missing_dimensions
- **CRITICAL**: For each item, include:
  - "needs_measurement": true
  - "measurement_instructions": How to measure this item from the plans
  - "assumptions": Array of assumptions made for this item

QUALITY ANALYSIS REQUIREMENTS - POPULATE ALL FIELDS:
- completeness: Assess what's missing (sheets, dimensions, details, sections)
- consistency: Check for conflicts (scales, units, dimensions, schedules)
- risk_flags: Identify potential problems (safety, code, budget, timeline, quality)
- audit_trail: Document coverage (pages analyzed, chunks, coverage %, assumptions)
- trade_scope_review: Provide status_icon (✅, ⚠️, ❌) and notes for every relevant trade, plus a summary row with counts

CRITICAL RESPONSE REQUIREMENTS:
1. You MUST respond with ONLY the JSON object - no explanatory text
2. The JSON MUST include both "items" array AND "quality_analysis" object
3. If you cannot find certain information, document it in quality_analysis.completeness
4. If there are contradictions, document them in quality_analysis.consistency
5. Every assumption you make MUST be listed in quality_analysis.audit_trail.assumptions_made
6. Even if the plan is unclear, return the full structure with empty arrays/objects where appropriate, but always populate quality_analysis fields to explain what's missing

DO NOT:
- Return partial results
- Skip the quality_analysis section
- Omit fields because they're empty (use empty arrays/objects)
- Include any text outside the JSON object`

  if (drawings && drawings.length > 0) {
    prompt += `\n\nUSER ANNOTATIONS: ${drawings.length} user annotation${drawings.length > 1 ? 's' : ''} included for reference - pay special attention to these marked areas`
  }

  return prompt
}
