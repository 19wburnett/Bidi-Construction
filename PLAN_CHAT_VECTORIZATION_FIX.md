# Plan Chat Vectorization Fix

## Problem Summary

The chatbot was failing to retrieve plan data because:
1. **SQL function didn't filter NULL embeddings**: The `match_plan_text_chunks` function attempted vector similarity search on chunks with NULL embeddings, causing failures
2. **No validation after ingestion**: Chunks could be created without embeddings, making them unsearchable
3. **Poor error messages**: Users saw generic "couldn't pull the plans" messages without understanding why

## Fixes Implemented

### 1. Database Migration (`20250101_fix_plan_text_chunks_null_embeddings.sql`)
- ✅ Updated `match_plan_text_chunks` function to filter out NULL embeddings
- ✅ Added index to help identify plans with missing embeddings
- ✅ Added helpful comments

### 2. Retrieval Validation (`lib/plan-text-chunks.ts`)
- ✅ Added check for chunks with embeddings before attempting vector search
- ✅ Improved error logging with diagnostics
- ✅ Returns empty array gracefully when no embeddings exist

### 3. Ingestion Validation (`lib/plan-text-chunks.ts`)
- ✅ Validates embeddings were created after insertion
- ✅ Warns if chunks were created without embeddings
- ✅ Throws error if NO chunks have embeddings (critical failure)

### 4. Enhanced Error Handling (`lib/plan-chat-v3/retrieval-engine.ts`)
- ✅ Better diagnostics when semantic search returns no results
- ✅ Distinguishes between "no chunks" vs "no embeddings" vs "no matches"
- ✅ Improved logging for debugging

### 5. Better User Messages (`lib/plan-chat-v3/answer-engine.ts`, `lib/planChat/answerModel.ts`)
- ✅ More helpful error messages when no data is available
- ✅ Suggests re-running ingestion when embeddings are missing
- ✅ Clearer guidance on what to do next

## Vector Database Choice

**Supabase with pgvector is the right choice** - no changes needed. The issue was implementation, not the database:
- ✅ pgvector is production-ready and well-maintained
- ✅ Integrated directly with Supabase (no external service needed)
- ✅ Supports cosine similarity search efficiently
- ✅ Handles the scale needed for plan text chunks

## Next Steps

### 1. Run the Migration
```bash
# Apply the migration to fix the SQL function
supabase migration up
# Or apply manually in Supabase dashboard SQL editor
```

### 2. Check Existing Plans
Run this query to find plans with chunks missing embeddings:
```sql
SELECT 
  plan_id,
  COUNT(*) as total_chunks,
  COUNT(embedding) as chunks_with_embeddings,
  COUNT(*) - COUNT(embedding) as chunks_without_embeddings
FROM plan_text_chunks
GROUP BY plan_id
HAVING COUNT(*) - COUNT(embedding) > 0
ORDER BY chunks_without_embeddings DESC;
```

### 3. Re-ingest Plans with Missing Embeddings
For each plan with missing embeddings, trigger re-ingestion:
```bash
POST /api/plan-text-chunks
{
  "planId": "plan-uuid-here",
  "jobId": "job-uuid-here"
}
```

### 4. Monitor Logs
Watch for these log messages:
- `[Retrieval] Plan X has no chunks with embeddings` - needs ingestion
- `[Ingestion] WARNING: X chunks were inserted without embeddings` - embedding API issue
- `[RetrievalEngine] Plan X has Y chunks but none have embeddings` - needs re-ingestion

## Testing

After applying fixes, test:
1. **New plan ingestion**: Upload a plan and verify chunks are created with embeddings
2. **Chat retrieval**: Ask questions about plans and verify chunks are retrieved
3. **Error handling**: Test with plans that have no chunks or chunks without embeddings

## Troubleshooting

### If chunks still aren't being retrieved:
1. Check `AI_GATEWAY_API_KEY` is set correctly
2. Verify embedding model is available: `OPENAI_EMBEDDING_MODEL` (default: `text-embedding-3-small`)
3. Check Supabase logs for RPC function errors
4. Verify migration was applied successfully

### If ingestion creates chunks without embeddings:
1. Check AI Gateway API key and connectivity
2. Verify embedding model name is correct
3. Check for rate limiting or API errors in logs
4. Ensure text chunks aren't empty (minimum length validation)

## Related Files Modified

- `supabase/migrations/20250101_fix_plan_text_chunks_null_embeddings.sql` - SQL function fix
- `lib/plan-text-chunks.ts` - Retrieval and ingestion validation
- `lib/plan-chat-v3/retrieval-engine.ts` - Enhanced error handling
- `lib/plan-chat-v3/answer-engine.ts` - Better error messages
- `lib/planChat/answerModel.ts` - Improved fallback messages


