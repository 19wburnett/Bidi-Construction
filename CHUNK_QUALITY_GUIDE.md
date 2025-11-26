# Plan Text Chunks - Quality Guide

## What a GOOD Chunk Record Looks Like

### Database Structure
```sql
SELECT * FROM plan_text_chunks WHERE plan_id = 'your-plan-id' LIMIT 1;
```

### Example Good Chunk:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "plan_id": "plan-uuid-here",
  "page_number": 3,
  "snippet_text": "SHEET A-3.1 FLOOR PLAN LEVEL 1\nScale: 1/8\" = 1'-0\"\nNorth arrow indicates orientation. All dimensions are to face of stud unless noted otherwise.\nWall types: Type A (exterior), Type B (interior bearing), Type C (interior non-bearing).\nRoom labels: BED-1 (Bedroom 1), BATH-1 (Bathroom 1), KIT (Kitchen).\nDoors: 3068 (3'-0\" x 6'-8\"), 2868 (2'-8\" x 6'-8\").\nWindows: W-1 (3'-0\" x 4'-0\"), W-2 (2'-0\" x 4'-0\").\nElectrical: Outlets per room per code. Switch locations as shown.\nPlumbing: Fixture locations per plan. Water lines 3/4\" supply, 1/2\" branch.",
  "metadata": {
    "chunk_page_index": 2,
    "total_pages": 25,
    "sheet_id": "A-3.1",
    "sheet_title": "FLOOR PLAN LEVEL 1",
    "sheet_discipline": "Architectural",
    "sheet_type": "Floor Plan",
    "chunk_index": 0,
    "character_count": 487
  },
  "embedding": [0.123, -0.456, 0.789, ...], // 1536 numbers
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Key Characteristics of a Good Chunk:

✅ **Text Content**:
- **Length**: 250-900 characters (optimal range)
- **Meaningful**: Contains actual blueprint information (notes, labels, dimensions, specifications)
- **Complete sentences**: Not just fragments or single words
- **Context**: Includes enough context to understand what it's about

✅ **Metadata**:
- **page_number**: Present and accurate
- **sheet_id**: Sheet identifier (e.g., "A-3.1", "S-2")
- **sheet_title**: Descriptive title (e.g., "FLOOR PLAN LEVEL 1")
- **sheet_discipline**: Type of sheet (e.g., "Architectural", "Structural", "MEP")
- **sheet_type**: Category (e.g., "Floor Plan", "Section", "Detail")
- **chunk_index**: Position within the page
- **character_count**: Length of text

✅ **Embedding**:
- **Present**: Must have a 1536-dimensional vector
- **Valid**: Not null, not empty array
- **Created**: Generated from the snippet_text using OpenAI

## What BAD Chunks Look Like

### ❌ Too Short (< 50 chars)
```json
{
  "snippet_text": "A-1",
  "metadata": {},
  "embedding": null
}
```
**Problem**: Not enough context for semantic search to work well.

### ❌ No Metadata
```json
{
  "snippet_text": "Some blueprint text here...",
  "metadata": null,
  "page_number": null
}
```
**Problem**: Missing context about which sheet/page this is from.

### ❌ No Embedding
```json
{
  "snippet_text": "Good text content...",
  "embedding": null
}
```
**Problem**: Won't be searchable via vector similarity.

### ❌ Too Long (> 1000 chars)
```json
{
  "snippet_text": "Very long text that exceeds optimal chunk size...",
  "character_count": 1500
}
```
**Problem**: May lose semantic meaning, harder to match precisely.

### ❌ Just Whitespace/Garbage
```json
{
  "snippet_text": "   \n\n   ",
  "character_count": 5
}
```
**Problem**: No useful information.

## How to Check Your Chunks

### Option 1: Use the Diagnostic API

```bash
GET /api/plan-text-chunks/diagnose?planId=your-plan-id
```

Returns:
- Total chunk count
- Chunks with/without embeddings
- Average chunk length
- Sample chunks with previews
- List of issues found

### Option 2: Direct SQL Query

```sql
-- Check chunk quality
SELECT 
  COUNT(*) as total_chunks,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings,
  COUNT(CASE WHEN embedding IS NULL THEN 1 END) as without_embeddings,
  AVG(LENGTH(snippet_text)) as avg_length,
  MIN(LENGTH(snippet_text)) as min_length,
  MAX(LENGTH(snippet_text)) as max_length,
  COUNT(CASE WHEN page_number IS NULL THEN 1 END) as missing_page_numbers,
  COUNT(CASE WHEN metadata IS NULL OR metadata = '{}' THEN 1 END) as missing_metadata
FROM plan_text_chunks
WHERE plan_id = 'your-plan-id';

-- See sample chunks
SELECT 
  id,
  page_number,
  LEFT(snippet_text, 100) as text_preview,
  LENGTH(snippet_text) as text_length,
  CASE WHEN embedding IS NOT NULL THEN 'Yes' ELSE 'No' END as has_embedding,
  metadata
FROM plan_text_chunks
WHERE plan_id = 'your-plan-id'
ORDER BY page_number, id
LIMIT 10;
```

### Option 3: Check What's Being Retrieved

```sql
-- Test the retrieval function
SELECT 
  id,
  page_number,
  LEFT(snippet_text, 150) as snippet_preview,
  similarity,
  metadata->>'sheet_title' as sheet_title
FROM match_plan_text_chunks(
  'your-plan-id'::uuid,
  -- You'd need to generate a query embedding first
  (SELECT embedding FROM plan_text_chunks WHERE plan_id = 'your-plan-id' LIMIT 1),
  6
);
```

## Common Issues & Solutions

### Issue: Chunks are too short
**Cause**: PDF has very sparse text (labels only, no notes)
**Solution**: 
- Check if OCR is running (for scanned PDFs)
- Verify text extraction is working
- May need to adjust chunking strategy

### Issue: No embeddings
**Cause**: Embedding generation failed or wasn't run
**Solution**:
- Check `OPENAI_API_KEY` is set
- Re-run ingestion: `POST /api/plan-text-chunks`
- Check logs for embedding errors

### Issue: Missing metadata
**Cause**: Sheet index not built or not linked
**Solution**:
- Run ingestion first: `POST /api/ingest`
- This builds `plan_sheet_index` table
- Then run text chunks: `POST /api/plan-text-chunks`

### Issue: Chunks don't match queries
**Cause**: Text quality, chunk size, or embedding issues
**Solution**:
- Check chunk length (should be 250-900 chars)
- Verify text is meaningful (not just "A-1" or whitespace)
- Check similarity scores in retrieval

## Optimal Chunk Characteristics

| Property | Good Range | Why |
|----------|-----------|-----|
| **Length** | 250-900 chars | Enough context, not too fragmented |
| **Has Embedding** | ✅ Yes | Required for vector search |
| **Has Page Number** | ✅ Yes | Needed for referencing |
| **Has Metadata** | ✅ Yes | Provides sheet context |
| **Text Quality** | Meaningful sentences | Not just labels or fragments |

## Testing Your Chunks

1. **Check if chunks exist**:
   ```sql
   SELECT COUNT(*) FROM plan_text_chunks WHERE plan_id = 'your-plan-id';
   ```

2. **Check chunk quality**:
   ```bash
   curl http://localhost:3000/api/plan-text-chunks/diagnose?planId=your-plan-id
   ```

3. **Test retrieval**:
   - Try asking a question in chat
   - Check what chunks are retrieved
   - Verify they're relevant to your question

4. **Compare with expected**:
   - Good chunks should have 250-900 chars
   - Should include sheet info in metadata
   - Should have embeddings
   - Should have page numbers


