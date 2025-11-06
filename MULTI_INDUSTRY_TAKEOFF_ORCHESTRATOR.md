# Multi-Industry Takeoff Orchestrator

## Overview

The Multi-Industry Takeoff Orchestrator is a two-stage pipeline for automated construction plan takeoffs that processes plans by industry segments, ensuring comprehensive coverage across all trades.

## Architecture

### Two-Stage Pipeline

1. **SCOPING STAGE**: Analyzes sample pages to determine which industries and categories should be processed
2. **EXECUTION STAGE**: Processes each segment in batches across all PDFs, then merges and deduplicates results

### Output Format (Arrays-Only Mode)

The orchestrator returns **exactly 4 arrays** in this order:

```typescript
[
  TakeoffItem[],    // Element 1: Global TAKEOFF array (all items across all segments)
  AnalysisItem[],   // Element 2: Global ANALYSIS array (issues/RFIs/conflicts)
  SegmentResult[],  // Element 3: SEGMENTS array (per-segment structured results)
  RunLogEntry[]     // Element 4: RUN LOG array (processing notes/errors)
]
```

## API Usage

### Endpoint

```
POST /api/takeoff/multi-industry
```

### Request Body

```typescript
{
  "pdf_urls": string[],                    // Required: Array of PDF URLs
  "job_context": {                         // Required
    "project_name": string,
    "location": string,
    "building_type": "residential" | "commercial" | "industrial" | "institutional" | string,
    "notes": string                        // Optional
  },
  "ask_scoping_questions": boolean,        // Default: true
  "page_batch_size": number,              // Default: 5 (3-10 recommended)
  "max_parallel_batches": number,         // Default: 2
  "currency": string,                     // Default: "USD"
  "unit_cost_policy": "estimate" | "lookup" | "mixed",  // Default: "estimate"
  "prior_segments": [                      // Optional: Skip scoping if provided
    {
      "industry": string,
      "categories": string[]
    }
  ]
}
```

### Response

Returns a JSON array with exactly 4 elements:

```typescript
[
  // 1. TAKEOFF array
  [
    {
      "name": "Specific item name",
      "description": "Detailed description/specs",
      "quantity": 150.5,
      "unit": "LF|SF|CF|CY|EA|SQ",
      "unit_cost": 2.50,
      "unit_cost_source": "model_estimate|lookup_pending|provided",
      "unit_cost_notes": "string",
      "location": "e.g., North Wall, Sheet A1.2",
      "industry": "structural|mep|finishes|sitework|other|string",
      "category": "string",
      "subcategory": "string",
      "cost_code": "e.g., 03 30 00",
      "cost_code_description": "Cast-in-Place Concrete",
      "dimensions": "e.g., area/thickness/spec",
      "bounding_box": {
        "x": number,
        "y": number,
        "width": number,
        "height": number,
        "page": number
      },
      "page_refs": [
        {
          "pdf": string,
          "page": number
        }
      ],
      "confidence": number,  // 0-1
      "notes": "string"
    }
  ],
  
  // 2. ANALYSIS array
  [
    {
      "type": "code_issue|conflict|rfi",
      "title": "string",                    // for code_issue
      "question": "string",                 // for rfi
      "description": "string",
      "sheet": "string",
      "pages": [number],
      "bounding_box": {
        "x": number,
        "y": number,
        "width": number,
        "height": number,
        "page": number
      },
      "severity": "low|medium|high|critical",  // for code_issue/conflict
      "priority": "low|medium|high",            // for rfi
      "recommendation": "string",
      "confidence": number
    }
  ],
  
  // 3. SEGMENTS array
  [
    {
      "industry": "string",
      "categories": ["string", ...],
      "summary": {
        "totals_by_cost_code": [
          {
            "cost_code": "string",
            "description": "string",
            "quantity": number,
            "unit": "string",
            "est_cost": number
          }
        ],
        "top_risks": ["string", ...],
        "pages_processed": number,
        "pages_failed": number
      },
      "items_count": number,
      "analysis_count": number
    }
  ],
  
  // 4. RUN LOG array
  [
    {
      "type": "info|warn|error",
      "message": "string",
      "pdf": "string",              // Optional
      "page_batch": [start, end]    // Optional
    }
  ]
]
```

## Example Usage

### Basic Request

```typescript
const response = await fetch('/api/takeoff/multi-industry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pdf_urls: [
      'https://example.com/plans/architectural.pdf',
      'https://example.com/plans/structural.pdf'
    ],
    job_context: {
      project_name: 'Silver Creek Building',
      location: 'Denver, CO',
      building_type: 'commercial',
      notes: 'Focus on structural and MEP systems'
    },
    ask_scoping_questions: true,
    page_batch_size: 5,
    max_parallel_batches: 2,
    currency: 'USD',
    unit_cost_policy: 'estimate'
  })
})

const [takeoff, analysis, segments, runLog] = await response.json()

console.log(`Found ${takeoff.length} takeoff items`)
console.log(`Found ${analysis.length} analysis items`)
console.log(`Processed ${segments.length} segments`)
```

### With Prior Segments (Skip Scoping)

```typescript
const response = await fetch('/api/takeoff/multi-industry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pdf_urls: ['https://example.com/plans.pdf'],
    job_context: {
      project_name: 'Project Name',
      location: 'Location',
      building_type: 'residential'
    },
    ask_scoping_questions: false,
    prior_segments: [
      {
        industry: 'structural',
        categories: ['foundation', 'framing']
      },
      {
        industry: 'mep',
        categories: ['electrical', 'plumbing']
      }
    ]
  })
})
```

## Key Features

### 1. Intelligent Scoping

- Analyzes sample pages from PDFs to determine project scope
- Suggests industry segments (structural, MEP, finishes, sitework, etc.)
- Can be skipped by providing `prior_segments`

### 2. Segment-Based Processing

- Processes each industry segment separately with specialized prompts
- Maintains segment context throughout processing
- Generates per-segment summaries and rollups

### 3. Batch Processing

- Processes PDFs in configurable batches (default: 5 pages)
- Supports parallel batch processing (default: 2 concurrent)
- Handles large PDFs efficiently without memory issues

### 4. Enhanced Deduplication

- Deduplicates items based on name, location, cost code, and dimensions
- Keeps separate entries if confidence delta > 0.2
- Keeps separate entries if dimensions materially differ (>10% difference)
- Merges quantities for truly duplicate items

### 5. Multi-PDF Support

- Processes multiple PDFs in a single job
- Tracks page references per PDF
- Aggregates results across all PDFs

### 6. Robust Error Handling

- Continues processing on partial failures
- Records errors in RUN LOG
- Returns partial results if some segments fail

## Performance Considerations

### Batch Size

- **Small PDFs (< 20 pages)**: Use batch_size = 3-5
- **Medium PDFs (20-100 pages)**: Use batch_size = 5-7
- **Large PDFs (100+ pages)**: Use batch_size = 7-10

### Parallelism

- **Default**: max_parallel_batches = 2 (safe for most cases)
- **High throughput**: max_parallel_batches = 3-4 (if you have rate limit headroom)
- **Conservative**: max_parallel_batches = 1 (if hitting rate limits)

### Unit Cost Policy

- **estimate**: AI provides unit costs directly (faster, less accurate)
- **lookup**: Marks items for external cost lookup (slower, more accurate)
- **mixed**: AI estimates + flags items needing lookup

## Industries and Categories

### Available Industries

- **structural**: Foundation, slab on grade, framing, concrete, steel
- **mep**: Electrical, plumbing, HVAC, fire protection
- **finishes**: Interior finishes, exterior finishes, paint, flooring
- **sitework**: Earthwork, utilities, paving, landscaping
- **roofing**: Roofing systems, waterproofing, insulation
- **glazing**: Windows, doors, curtain walls
- **other**: Specialty items, equipment, etc.

## Cost Codes

The orchestrator uses Procore/CSI-style cost codes (e.g., "03 30 00" for Cast-in-Place Concrete). Each item includes:
- Cost code (e.g., "03 30 00")
- Cost code description (e.g., "Cast-in-Place Concrete")
- Unit cost (based on currency and unit_cost_policy)
- Unit cost source (model_estimate, lookup_pending, or provided)

## Error Handling

The orchestrator is designed to be resilient:

1. **Partial Failures**: If a batch fails, processing continues with other batches
2. **Segment Failures**: If a segment fails, other segments continue processing
3. **PDF Failures**: If a PDF can't be loaded, other PDFs continue processing
4. **All errors are logged** in the RUN_LOG array for debugging

## Integration with Existing System

The Multi-Industry Takeoff Orchestrator is separate from the existing `TakeoffOrchestrator`:

- **Existing**: `/api/takeoff/start` - Single PDF, single pass
- **New**: `/api/takeoff/multi-industry` - Multiple PDFs, segment-based

Both can coexist and serve different use cases.

## Testing

### Health Check

```bash
curl http://localhost:3000/api/takeoff/multi-industry
```

Returns API documentation and usage information.

### Example Request

```bash
curl -X POST http://localhost:3000/api/takeoff/multi-industry \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_urls": ["https://example.com/plan.pdf"],
    "job_context": {
      "project_name": "Test Project",
      "location": "Test Location",
      "building_type": "residential"
    }
  }'
```

## Future Enhancements

Potential improvements:

1. **Interactive Scoping**: Return questions to user, wait for response
2. **Resumable Jobs**: Save state, resume from checkpoint
3. **Progress Tracking**: WebSocket updates for long-running jobs
4. **Cost Code Validation**: Validate against standard cost code libraries
5. **Custom Industries**: Allow user-defined industry segments

