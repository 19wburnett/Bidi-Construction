# Single-Model Takeoff + QA Analysis

## Overview

This is a **reliable single-model pipeline** for construction plan analysis that:

1. ✅ Uses whichever LLM provider currently works (Anthropic → OpenAI → xAI fallback)
2. ✅ **ALWAYS** returns BOTH:
   - Large, comprehensive takeoff items array (priority #1 = many items)
   - Complete quality_analysis object (priority #2 = accuracy)
3. ✅ Conforms to repo's expected data shapes
4. ✅ Survives malformed JSON (repair, extract, and return usable data)
5. ✅ Ships a real API endpoint with retries and thresholds
6. ✅ Neutralizes template/prompt issues that corrupt output format

## Architecture

### Files Created

- `lib/llm/providers.ts` - Provider probing with fallback (Anthropic → OpenAI → xAI)
- `prompts/takeoff_qa.single.ts` - Minimal, repo-aligned prompt (no rigid doctrine)
- `lib/json/repair.ts` - Bulletproof JSON repair & extraction
- `app/api/analyze/single/route.ts` - Single endpoint that does BOTH takeoff + QA
- `tests/analyze.single.e2e.ts` - E2E test with live provider call
- `scripts/run-analyze.ts` - CLI helper for testing

### Data Shapes

**Takeoff Items** (aligned with `plan_takeoff_analysis.items` JSONB column):
```typescript
{
  name: string
  unit: string
  notes?: string
  category: 'structural' | 'exterior' | 'interior' | 'mep' | 'finishes' | 'other'
  location: string
  quantity: number
  cost_code: string
  unit_cost: number
  confidence: number (0-1)
  dimensions?: string
  ai_provider?: string
  description: string
  subcategory: string
  bounding_box: {
    x: number (0-1)
    y: number (0-1)
    page: number
    width: number (0-1)
    height: number (0-1)
  }
  consensus_count?: number
  cost_code_description?: string
}
```

**Quality Analysis** (aligned with `plan_quality_analysis` structure):
```typescript
{
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
    confidence: number (0-1)
    ai_provider?: string
    description: string
    bounding_box?: { x, y, page, width, height }
    recommendation: string
    consensus_count?: number
  }>
  audit_trail: {
    chunks_covered: string
    pages_covered: string
    method: string
  }
}
```

## API Endpoint

### POST `/api/analyze/single`

**Request:**
```json
{
  "planId": "uuid",
  "images": ["data:image/png;base64,...", ...]
}
```

**Response:**
```json
{
  "success": true,
  "items": [...], // Array of takeoff items
  "quality_analysis": {...}, // Complete QA object
  "meta": {
    "provider": "anthropic|openai|xai",
    "attempts": 1,
    "repaired": false,
    "notes": "...",
    "reason": "...",
    "items_count": 42,
    "quality_analysis_keys": ["completeness", "consistency", "risk_flags", "audit_trail"],
    "takeoff_analysis_id": "uuid",
    "quality_analysis_id": "uuid"
  }
}
```

## Usage

### From Frontend

The endpoint accepts the same pattern as `/api/plan/analyze-enhanced`:

```typescript
const response = await fetch('/api/analyze/single', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    planId: planId,
    images: images // base64 data URLs
  })
})

const data = await response.json()
console.log(`Got ${data.items.length} items`)
console.log(`Quality analysis:`, data.quality_analysis)
```

### CLI Helper

```bash
tsx scripts/run-analyze.ts --plan <planId>
```

### E2E Test

```bash
# Set TEST_PLAN_ID in .env
tsx tests/analyze.single.e2e.ts
```

## Provider Fallback

The system automatically falls back through providers:

1. **Anthropic Claude** (claude-3-5-sonnet-20241022)
2. **OpenAI GPT** (gpt-4o)
3. **xAI Grok** (grok-beta)

If a provider is rate-limited or times out, it's marked as "degraded" for 30 minutes and the next provider is tried.

## JSON Repair

The system handles common JSON issues:

- ✅ Strips markdown code fences (```json ... ```)
- ✅ Removes leading/trailing prose
- ✅ Fixes trailing commas
- ✅ Fixes missing commas between objects
- ✅ Rebalances brackets/braces
- ✅ Extracts items array even from broken JSON
- ✅ Extracts quality_analysis even if partially broken
- ✅ Always returns valid structure (even if empty)

## Retries & Thresholds

- **Minimum Items Threshold**: `max(20, images.length * 4)` (at least 4 items per page, minimum 20)
- **Max Attempts**: 3
- **Strategy**: If below threshold, retry with enhanced prompt asking for more comprehensive coverage

## Environment Variables

Required (at least one):
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `XAI_API_KEY`

Optional:
- `NEXT_PUBLIC_APP_URL` (default: `http://localhost:3000`)

## Acceptance Criteria

- ✅ E2E test passes with live call: `items.length ≥ threshold` and `quality_analysis` present
- ✅ CLI run shows items count + provider used; repaired flag true/false
- ✅ Endpoint works when first provider is rate-limited (fallback verified)
- ✅ No "0 items" unless input truly has none; if 0, `meta.reason` explains attempts and failures

## Differences from Enhanced Multi-Model System

- **Single model** only (no consensus/adjudication)
- **Faster** (one model call vs. multiple)
- **Simpler** (no model orchestration)
- **Reliable** (focus on one working path vs. complex multi-model coordination)
- **Same data shapes** (compatible with existing frontend)

## Troubleshooting

### "No LLM providers available"
- Ensure at least one API key is set: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `XAI_API_KEY`

### "All LLM providers failed"
- Check API keys are valid
- Check rate limits (provider is marked degraded for 30 min after 429/timeout)
- Try again later or use a different provider

### "Only X items (below threshold)"
- The system will retry up to 3 times with enhanced prompts
- If still below threshold, returns best result with `meta.reason` explaining
- Consider: plan may be small/simple, or images may not contain enough detail

### Items/QA missing fields
- JSON repair should handle most cases
- Check `meta.repaired` and `meta.notes` for details
- If fields are truly missing, check LLM provider response format

