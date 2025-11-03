# Quality Analysis Fix

## Problem

Multi-model analysis was working great for takeoff items, but quality analysis was missing from the results!

**Root cause:** The `buildConsensus` and `buildSingleModelResult` methods in `lib/enhanced-ai-providers.ts` were not including `quality_analysis` in their return values, even though models were generating it.

## Solution

### 1. Added `quality_analysis` to Single Model Results
```typescript
private buildSingleModelResult(...) {
  return {
    items: ...,
    issues: ...,
    quality_analysis: result.parsed.quality_analysis, // ✅ Now included
    confidence: ...,
    ...
  }
}
```

### 2. Added `quality_analysis` to Multi-Model Consensus
```typescript
private buildConsensus(...) {
  // Merge quality_analysis from all models
  const qualityAnalysis = this.mergeQualityAnalysis(results.map(r => r.parsed))
  
  return {
    items: ...,
    issues: ...,
    quality_analysis: qualityAnalysis, // ✅ Now included
    confidence: ...,
    ...
  }
}
```

### 3. Implemented Quality Analysis Merging
Created `mergeQualityAnalysis` method that:
- Scores each model's quality_analysis based on:
  - Completeness overall score
  - Audit trail coverage percentage
  - Number of risk flags found
  - Number of missing dimensions detected
- Selects the **most comprehensive** quality_analysis
- Returns a default structure if no models provided quality_analysis

## How It Works Now

### Single Model
- Uses that model's quality_analysis directly

### Multiple Models
- Each model generates its own quality_analysis
- System scores and picks the most comprehensive one
- Other models' quality analyses are discarded (we pick the best, not merge all)

## Why Not Merge All Quality Analyses?

Unlike takeoff items (which can be deduplicated and merged), quality analysis is more subjective:
- Multiple "incomplete" analyses don't create a "complete" one
- Risk flags from one model don't add value if another model already found them better
- The **best** quality analysis is more valuable than an **averaged** one

## Testing

After the fix, quality analysis should now appear in:
- API responses (`quality_analysis` field)
- Database saves (quality_analysis table)
- Frontend quality tab displays

## Files Changed

- `lib/enhanced-ai-providers.ts`: Added quality_analysis to both consensus methods + mergeQualityAnalysis implementation

