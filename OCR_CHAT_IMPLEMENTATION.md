# OCR Chat Implementation for Scanned Blueprints

## Overview

Added OCR (Optical Character Recognition) support to enable chat functionality with scanned blueprints. The system now automatically detects when a PDF has no text layer and uses OCR to extract text for embeddings.

## What Was Implemented

### 1. OCR Text Extractor (`lib/ingestion/pdf-ocr-extractor.ts`)
- Uses PDF.co OCR API to extract text from scanned PDF pages
- Automatically handles different response formats
- Includes fallback to alternative OCR endpoints
- Optional GPT-4 Vision OCR fallback (more expensive but more accurate)

### 2. Enhanced Plan Text Chunks Ingestion (`lib/plan-text-chunks.ts`)
- **Smart Detection**: Automatically detects scanned PDFs (< 50 chars/page average)
- **Hybrid Approach**: Tries regular text extraction first, then OCR if needed
- **Combined Results**: Merges OCR text with any existing native text
- **Automatic Fallback**: Uses OCR when PDF_CO_API_KEY is available

## How It Works

### Flow:
```
1. Upload Blueprint
   ↓
2. Try Regular Text Extraction (pdf2json)
   ↓
3. Check Text Quality
   - If avg < 50 chars/page → Likely scanned PDF
   ↓
4. If Scanned: Run OCR (PDF.co API)
   ↓
5. Combine Text Sources
   ↓
6. Create Embeddings
   ↓
7. Store in plan_text_chunks table
```

### Detection Logic:
- **Native PDF**: Text extraction works → Use that
- **Scanned PDF**: < 50 chars/page → Trigger OCR
- **Hybrid PDF**: Some pages have text, some don't → Combine both

## Requirements

### Environment Variable:
```env
PDF_CO_API_KEY=your_pdf_co_api_key
```

**Note**: OCR only runs if `PDF_CO_API_KEY` is set. Without it, the system falls back to regular text extraction only.

## Benefits

### Before (Text-Only):
- ❌ Scanned blueprints → No text → No embeddings → Chat doesn't work
- ❌ Image-only PDFs → Chat has nothing to search

### After (With OCR):
- ✅ Scanned blueprints → OCR extracts text → Embeddings created → Chat works!
- ✅ Hybrid PDFs → Both native text + OCR text → Better coverage
- ✅ Automatic detection → No manual configuration needed

## Usage

### Automatic (Recommended):
OCR runs automatically when you upload a blueprint. No changes needed to your workflow.

### Manual Trigger:
If you want to re-process an existing plan with OCR:

```bash
POST /api/plan-text-chunks
{
  "planId": "your-plan-id"
}
```

The system will:
1. Check if text exists
2. If sparse, automatically run OCR
3. Create new embeddings with OCR text

## Testing

### Test with Scanned Blueprint:
1. Upload a scanned PDF blueprint (image-only, no text layer)
2. System should automatically detect and use OCR
3. Check logs for: `"Low text content detected - using OCR for scanned blueprint"`
4. Verify embeddings were created: Check `plan_text_chunks` table
5. Try chatting about the blueprint - it should now work!

### Verify OCR Worked:
```sql
-- Check if OCR text was extracted
SELECT 
  COUNT(*) as total_chunks,
  COUNT(CASE WHEN snippet_text LIKE '%OCR%' OR LENGTH(snippet_text) > 100 THEN 1 END) as likely_ocr_chunks
FROM plan_text_chunks
WHERE plan_id = 'your-plan-id';
```

## Cost Considerations

### PDF.co OCR:
- ~$0.01 per page
- Very fast (seconds)
- Works on Vercel serverless

### GPT-4 Vision OCR (Fallback):
- More expensive (~$0.01-0.03 per page)
- More accurate for complex layouts
- Currently not enabled by default (can be added if needed)

## Limitations

1. **PDF.co API Required**: OCR only works if `PDF_CO_API_KEY` is set
2. **OCR Quality**: Depends on scan quality - poor scans = poor OCR
3. **Page Detection**: May struggle with multi-page OCR results (splits by estimated page breaks)
4. **Cost**: Each OCR run costs money (~$0.01/page)

## Future Improvements

- [ ] Add GPT-4 Vision OCR as automatic fallback
- [ ] Improve page break detection in OCR results
- [ ] Add OCR confidence scores to metadata
- [ ] Cache OCR results to avoid re-processing
- [ ] Support for multiple languages

## Files Changed

1. **New**: `lib/ingestion/pdf-ocr-extractor.ts` - OCR extraction logic
2. **Modified**: `lib/plan-text-chunks.ts` - Added OCR integration
3. **New**: `OCR_CHAT_IMPLEMENTATION.md` - This documentation

## Summary

✅ **OCR is now integrated** - Scanned blueprints can be chatted with!
✅ **Automatic detection** - No manual configuration needed
✅ **Hybrid approach** - Works with both native and scanned PDFs
✅ **Backward compatible** - Existing functionality unchanged

The chat feature should now work much better with scanned blueprints! 🎉



