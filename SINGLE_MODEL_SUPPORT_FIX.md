# Single Model Support - Critical Fix

## The Problem
The system was **rejecting single model results** even when Claude Sonnet successfully analyzed the plans. This was because the code required "at least 2 models" for consensus analysis.

**Example Issue:**
```
✅ claude-sonnet-4-20250514 succeeded: 11952 chars in 53977ms
❌ Only 1 models succeeded. Need at least 2 for consensus analysis.
```

## Root Cause
In `lib/enhanced-ai-providers.ts`, the `analyzeWithConsensus` function had a hard requirement:
```typescript
if (results.length < 2) {
  console.error(`Only ${results.length} models succeeded. Need at least 2 for consensus analysis.`)
  // Would create fallback structure with 0 items
}
```

This was blocking **all single model results**, even when they were successful.

## The Fix

### 1. Remove 2-model requirement
Changed the logic to only require **at least 1 model**:
```typescript
// Previously:
if (results.length < 2) {
  // Reject single model results
}

// Now:
if (results.length === 0) {
  throw new Error(`All models failed. Cannot perform analysis.`)
}
// Accept single model results!
```

### 2. Added single model handling
Created `buildSingleModelResult` method to properly format single model outputs:
```typescript
private buildSingleModelResult(
  result: { parsed: any; model: string; confidence?: number },
  taskType: TaskType
): ConsensusResult {
  return {
    items: result.parsed.items || [],
    issues: taskType === 'quality' ? (result.parsed.issues || []) : [],
    confidence: result.confidence || 0.7, // Single model gets lower confidence
    consensusCount: 1,
    disagreements: [],
    modelAgreements: [result.model],
    specializedInsights: result.parsed.specializedInsights || [],
    recommendations: result.parsed.recommendations || []
  }
}
```

### 3. Fixed code structure
Fixed syntax errors where the single model block wasn't properly closing, causing `parsedResults` to be declared outside scope.

## Impact

**BEFORE:** 
- ✅ Claude succeeds with 11,952 chars of analysis
- ❌ System rejects it because only 1 model worked
- Result: 0 items saved to DB

**AFTER:**
- ✅ Claude succeeds with 11,952 chars of analysis
- ✅ System accepts single model result
- ✅ Items extracted and saved to DB
- Confidence: 0.7 (vs 0.8+ for multi-model)

## Additional Fixes Applied

1. **Timeout increased**: 60s → 120s (gpt-4o was timing out at 60s but responding at ~98s)
2. **JSON repair improved**: Better handling of Claude's malformed JSON (`"name": "value"]` → `"name": "value",`)
3. **Model priority reordered**: gpt-4o → Claude Sonnet → o4-mini → gpt-4.1-nano

## Test Results

Expected behavior:
- Single model results are now accepted
- Claude Sonnet will work when other models fail
- Better JSON extraction from Claude's responses
- No more "0 items" in DB when models succeed

