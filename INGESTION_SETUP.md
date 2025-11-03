# Ingestion System Setup Guide

## ✅ Step 1: Install Dependencies (DONE)

Dependencies have been installed:
- `sharp` - Image processing (Vercel-compatible)
- `pdf2json` - PDF text extraction
- `pdfjs-dist` - PDF processing

## ⚠️ Step 2: Run Database Migration (REQUIRED)

**You need to manually run this migration in Supabase:**

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of: `supabase/migrations/20250127_ingestion_chunking_system.sql`
4. Click **Run** to execute
5. Verify tables were created:
   ```sql
   SELECT * FROM plan_sheet_index LIMIT 1;
   SELECT * FROM plan_chunks LIMIT 1;
   ```

## ✅ Step 3: Environment Variables

Ensure these are set in your `.env.local`:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Optional (for image extraction)
PDF_CO_API_KEY=your_pdf_co_key
```

**Note:** Image extraction will be disabled if `PDF_CO_API_KEY` is not set, but text extraction and chunking will still work.

## 🧪 Step 4: Test the API

Once migration is run, you can test:

```bash
# Test ingestion endpoint
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "planId": "your-plan-uuid",
    "options": {
      "target_chunk_size_tokens": 3000,
      "overlap_percentage": 17.5
    }
  }'
```

## 📝 Migration SQL Location

The migration file is at:
`supabase/migrations/20250127_ingestion_chunking_system.sql`

Copy the entire contents and run in Supabase SQL Editor.

