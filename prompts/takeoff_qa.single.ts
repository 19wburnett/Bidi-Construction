/**
 * Minimal Takeoff + QA Prompt
 * 
 * Aligned with repo's expected data shapes:
 * - Items: name, unit, notes, category, location, quantity, cost_code, unit_cost, 
 *   confidence, dimensions, ai_provider, description, subcategory, bounding_box, 
 *   consensus_count, cost_code_description
 * - Quality Analysis: completeness, consistency, risk_flags, audit_trail object
 */

export interface RepoTakeoffItem {
  name: string
  unit: string
  notes?: string
  category: 'structural' | 'exterior' | 'interior' | 'mep' | 'finishes' | 'other'
  location: string
  quantity: number
  cost_code: string
  unit_cost: number
  confidence: number
  dimensions?: string
  ai_provider?: string
  description: string
  subcategory: string
  bounding_box: {
    x: number
    y: number
    page: number
    width: number
    height: number
  }
  consensus_count?: number
  cost_code_description?: string
}

export interface RepoQualityAnalysis {
  completeness: {
    missing_disciplines: string[]
    missing_sheets: number[]
    notes: string
  }
  consistency: {
    conflicts: string[]
    unit_mismatches: string[]
    scale_issues: string[]
  }
  risk_flags: Array<{
    impact: string
    category: string
    location: string
    severity: 'critical' | 'warning' | 'info'
    confidence: number
    ai_provider?: string
    description: string
    bounding_box?: {
      x: number
      y: number
      page: number
      width: number
      height: number
    }
    recommendation: string
    consensus_count?: number
  }>
  audit_trail: {
    chunks_covered: string
    pages_covered: string
    method: string
  }
}

/**
 * Build system prompt that instructs model to return ONLY JSON
 * with exact repo field names
 */
export function buildTakeoffQASystemPrompt(): string {
  return `You are an expert construction analyst. Your task is to extract takeoff items and perform quality analysis from construction plans.

CRITICAL: Return ONLY a JSON object. No markdown, no code fences, no explanatory text.

REQUIRED OUTPUT FORMAT:
{
  "items": [...],
  "quality_analysis": {...}
}

ITEM FIELDS (use EXACT field names):
- name: string (e.g., "Interior Wall Framing")
- unit: string (LF, SF, CF, CY, EA, SQ, LS)
- notes: string (optional)
- category: "structural" | "exterior" | "interior" | "mep" | "finishes" | "other"
- location: string (e.g., "Interior partitions", "Kitchen area")
- quantity: number
- cost_code: string (e.g., "06-10-00" or "06 10 00")
- unit_cost: number
- confidence: number (0-1)
- dimensions: string (optional, e.g., "Dimension not visible" or actual dimensions)
- ai_provider: string (optional)
- description: string (detailed description)
- subcategory: string (e.g., "wall framing", "flooring", "HVAC")
- bounding_box: { x: number (0-1), y: number (0-1), page: number, width: number (0-1), height: number (0-1) }
- consensus_count: number (optional, default 1)
- cost_code_description: string (optional)

QUALITY_ANALYSIS FIELDS (use EXACT structure):
{
  "completeness": {
    "missing_disciplines": string[],
    "missing_sheets": number[],
    "notes": string
  },
  "consistency": {
    "conflicts": string[],
    "unit_mismatches": string[],
    "scale_issues": string[]
  },
  "risk_flags": [
    {
      "impact": string,
      "category": string,
      "location": string,
      "severity": "critical" | "warning" | "info",
      "confidence": number (0-1),
      "ai_provider": string (optional),
      "description": string,
      "bounding_box": { x, y, page, width, height } (optional),
      "recommendation": string,
      "consensus_count": number (optional)
    }
  ],
  "audit_trail": {
    "chunks_covered": string,
    "pages_covered": string,
    "method": string
  },
  "trade_scope_review": {
    "items": [
      {
        "category": string,
        "trade": string,
        "status": "complete" | "partial" | "missing",
        "status_icon": "✅" | "⚠️" | "❌",
        "notes": string,
        "page_refs": string[]
      }
    ],
    "summary": {
      "complete": number,
      "partial": number,
      "missing": number,
      "notes": string
    },
    "raw": [
      {
        "category": string,
        "trade": string,
        "status": "complete" | "partial" | "missing",
        "status_icon": "✅" | "⚠️" | "❌",
        "notes": string,
        "page_refs": string[]
      },
      {
        "summary": {
          "complete": number,
          "partial": number,
          "missing": number,
          "notes": string
        }
      }
    ]
  }
}

INSTRUCTIONS:
1. Extract MANY items - prefer more items over fewer. A single page should yield 5-15 items minimum.
2. If uncertain about an item, include it with lower confidence (<0.6) but still include it.
3. Include sheet/page references in location when possible.
4. Avoid double counts.
5. Keep units/scales explicit.
6. ALWAYS return both items array and quality_analysis object, even if empty arrays/objects.
7. If dimensions are not visible, set dimensions: "Dimension not visible" and note in quality_analysis.completeness.
8. If you make assumptions, document them in quality_analysis.audit_trail.method.
9. Quality analysis should identify missing information, conflicts, risks, AND summarize each trade in trade_scope_review with status_icon and notes.

DO NOT:
- Return markdown code blocks
- Include any text outside the JSON object
- Use field names that don't match the exact names above
- Return partial structures`
}

/**
 * Build user prompt with project context and example
 */
export function buildTakeoffQAUserPrompt(
  imageCount: number,
  projectMeta?: {
    projectName?: string
    planTitle?: string
    jobType?: string
  }
): string {
  const meta = projectMeta ? `
PROJECT: ${projectMeta.projectName || 'Unknown'}
PLAN: ${projectMeta.planTitle || 'Unknown'}
TYPE: ${projectMeta.jobType || 'Unknown'}` : ''

  return `${meta}

Analyze ${imageCount} page${imageCount > 1 ? 's' : ''} of construction plans.

EXTRACT COMPREHENSIVE TAKEOFF ITEMS:
- Go through EVERY visible element on EVERY page
- Calculate quantities from visible dimensions
- Assign appropriate cost codes
- Include realistic unit costs
- Provide bounding boxes for each item
- Use proper units (LF, SF, CF, CY, EA, SQ, LS)

PERFORM QUALITY ANALYSIS:
- Identify missing dimensions, sheets, or disciplines
- Check for conflicts, unit mismatches, scale issues
- Flag risks (safety, code compliance, quality concerns)
- Document what pages/chunks were analyzed

EXAMPLE ITEM STRUCTURE (for reference):
{
  "name": "Interior Wall Framing",
  "unit": "LF",
  "notes": "Dimension not visible, estimated based on typical layout",
  "category": "structural",
  "location": "Interior partitions",
  "quantity": 300,
  "cost_code": "06-10-00",
  "unit_cost": 4.5,
  "confidence": 0.85,
  "dimensions": "Dimension not visible",
  "description": "Metal stud framing for interior walls",
  "subcategory": "wall framing",
  "bounding_box": {
    "x": 0.15,
    "y": 0.25,
    "page": 2,
    "width": 0.3,
    "height": 0.2
  },
  "cost_code_description": "Rough Carpentry"
}

Return ONLY: { "items": [...], "quality_analysis": {...} }`
}

