# Ingestion & Chunking - Quick Start Guide

## Overview

This system ingests architectural plan PDFs (20-200+ pages), extracts text and images per-page, builds a comprehensive sheet index, and generates quality-preserving chunks optimized for multi-LLM analysis.

## Files Created

1. **`INGESTION_CHUNKING_ARCHITECTURE.md`** - Complete tech spec with all details
2. **`types/ingestion.ts`** - TypeScript type definitions
3. **`lib/ingestion-engine.ts`** - Main orchestration function (skeleton)

## Next Steps

### 1. Install Dependencies

```bash
npm install canvas sharp
npm install --save-dev @types/pdf2json
```

### 2. Create Database Tables

Run the SQL from the tech spec (Section: Implementation Notes → Database Schema)

### 3. Create Implementation Files

You'll need to create these files (code snippets provided in tech spec):

- `lib/ingestion/pdf-text-extractor.ts` - Extract text per page using pdf2json
- `lib/ingestion/pdf-image-extractor.ts` - Extract images using pdfjs-dist + canvas
- `lib/ingestion/sheet-index-builder.ts` - Build sheet index from text
- `lib/ingestion/chunking-engine.ts` - Generate chunks with overlap

### 4. Create API Routes

- `app/api/ingest/route.ts` - POST endpoint (skeleton provided in tech spec)
- `app/api/chunks/[jobId]/route.ts` - GET endpoint (skeleton provided in tech spec)

### 5. Test with Sample PDF

Use the synthetic 5-page PDF described in the Test Plan section.

## Key Features

- ✅ Server-side PDF processing from Supabase Storage
- ✅ Per-page text and image extraction
- ✅ Automatic sheet index building (sheet IDs, disciplines, scales)
- ✅ Smart chunking (2-4k tokens, 15-20% overlap)
- ✅ Deduplication safeguards
- ✅ Plan set grouping
- ✅ Retry/backoff for reliability

## Configuration

Default chunking settings (configurable via API):
- Target chunk size: 3000 tokens
- Overlap: 17.5%
- Max chunk size: 4000 tokens
- Min chunk size: 2000 tokens
- Image DPI: 300

## API Usage

### Ingest a Plan

```typescript
POST /api/ingest
{
  "planId": "uuid",
  "jobId": "uuid", // optional
  "options": {
    "target_chunk_size_tokens": 3000,
    "overlap_percentage": 17.5
  }
}
```

### Retrieve Chunks

```typescript
GET /api/chunks/[jobId]?planId=uuid&page=1&limit=50
```

## Important Notes

1. **Storage Bucket**: Uses `job-plans` bucket (existing)
2. **Memory Limits**: Max 500MB per PDF
3. **Processing Time**: Expect ~2 minutes for 50-page PDF
4. **Edge Cases**: Handles rotated sheets, scanned PDFs, missing scales

## Full Documentation

See `INGESTION_CHUNKING_ARCHITECTURE.md` for:
- Complete file flow diagram
- All TypeScript interfaces
- Library code snippets
- Test plan with edge cases
- Implementation checklist

