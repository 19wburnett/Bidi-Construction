# Plan Vectorization Check Implementation

## Problem

When users tried to use the blueprint chat to do a takeoff, they received a message saying the plan set needed to be uploaded first. The system wasn't checking if plans were vectorized (had `plan_text_chunks` with embeddings) before allowing chat, leading to confusing error messages.

## Solution

Added comprehensive vectorization status checking to ensure plans are properly vectorized before allowing chat functionality.

## Changes Made

### 1. Vectorization Status Checker (`lib/plan-vectorization-status.ts`)
- New utility module to check if a plan is vectorized
- `checkPlanVectorizationStatus()` - Returns detailed status including:
  - Whether plan has chunks
  - Whether chunks have embeddings
  - Count of chunks and embeddings
  - Helpful error messages
- `isPlanVectorized()` - Quick boolean check

### 2. Plan Chat Route Validation (`app/api/plan-chat/route.ts`)
- Added vectorization check before processing chat requests
- Returns clear error message if plan is not vectorized:
  - `PLAN_NOT_VECTORIZED` error code
  - Detailed status information
  - Helpful message explaining what needs to be done

### 3. Frontend Error Handling (`components/plan/plan-chat-panel.tsx`)
- Updated to handle `PLAN_NOT_VECTORIZED` error specifically
- Shows user-friendly error messages:
  - If no chunks: "This plan hasn't been vectorized yet..."
  - If chunks but no embeddings: "This plan has X chunks but none have embeddings..."
- Displays error details in the chat interface

### 4. Answer Engine Fallback (`lib/plan-chat-v3/answer-engine.ts`)
- Added fallback check in case vectorization check is bypassed
- Throws clear error if no chunks are available
- Provides helpful guidance on what to do next

### 5. API Endpoint (`app/api/plan-vectorization-status/route.ts`)
- New GET endpoint to check vectorization status
- Can be used by UI to proactively check before allowing chat
- Returns detailed status information

## How It Works

1. **When a plan is uploaded:**
   - System automatically triggers vectorization in background
   - Both `/api/ingest` and `/api/plan-text-chunks` are called
   - Vectorization happens asynchronously

2. **When user tries to chat:**
   - Plan chat route checks vectorization status first
   - If not vectorized, returns clear error message
   - If vectorized, proceeds with chat normally

3. **Error Messages:**
   - Clear, actionable messages explaining what's missing
   - Guidance on how to fix the issue
   - Status information (chunk count, embedding count)

## Usage

### Check Vectorization Status
```typescript
import { checkPlanVectorizationStatus } from '@/lib/plan-vectorization-status'

const status = await checkPlanVectorizationStatus(supabase, planId)
if (!status.isVectorized) {
  console.log(status.message) // Helpful error message
}
```

### API Endpoint
```
GET /api/plan-vectorization-status?planId=...&jobId=...
```

### Vectorize a Plan
```
POST /api/plan-text-chunks
{
  "planId": "..."
}
```

## Benefits

1. **Clear Error Messages:** Users know exactly what's wrong and how to fix it
2. **Proactive Checking:** System checks before processing, saving time
3. **Better UX:** No more confusing "couldn't pull the plans" messages
4. **Diagnostic Info:** Detailed status helps debug issues
5. **Graceful Degradation:** Multiple layers of checking ensure errors are caught

## Future Improvements

- Add UI indicator showing vectorization status
- Auto-retry vectorization if it failed
- Show progress indicator during vectorization
- Add button to manually trigger vectorization from UI
