# Background Vectorization Jobs for Large PDFs

## Problem

Large PDFs (100+ pages) with lots of text take a long time to vectorize, and the current synchronous approach:
- Blocks the user from using the app while processing
- Times out if the user closes the page
- Doesn't provide progress feedback
- Can't handle very large PDFs efficiently

## Solution

Implemented a background job queue system that:
1. **Queues vectorization jobs** instead of running synchronously
2. **Processes in the background** - continues even if user closes the app
3. **Shows progress** - real-time updates on vectorization status
4. **Optimizes for large PDFs** - batches embeddings to avoid memory issues
5. **Auto-retries** - automatically retries the chat request once vectorization completes

## Architecture

### Database Schema

**`plan_vectorization_queue` table:**
- Tracks vectorization jobs with status, progress, and metadata
- Supports priority queuing
- Includes retry logic
- Stores warnings and error messages

### API Endpoints

1. **`POST /api/plan-vectorization/queue`**
   - Queues a plan for background vectorization
   - Returns immediately with job ID
   - User can close the app and come back later

2. **`GET /api/plan-vectorization/queue?planId=...`**
   - Gets the status of a vectorization job
   - Returns progress, current step, and status

3. **`POST /api/plan-vectorization/process`**
   - Processes a queued job
   - Called by the queue system or can be triggered manually
   - Updates progress as it processes

### Frontend Flow

1. User tries to chat with non-vectorized plan
2. System queues vectorization job (returns 202 Accepted)
3. Frontend shows "Processing plans for AI..." message
4. Frontend polls for progress every 3 seconds
5. Progress updates shown in real-time
6. Once complete, automatically retries the original chat request
7. User gets their answer

## Optimizations for Large PDFs

### Batch Processing
- Embeddings generated in batches of 50 chunks
- Prevents memory issues with very large PDFs
- Progress logged for PDFs with 100+ chunks

### Progress Tracking
- Real-time progress updates (0-100%)
- Current step displayed ("Downloading PDF...", "Extracting text...", etc.)
- Pages processed / total pages shown

### Background Processing
- Jobs run server-side, independent of user session
- User can close the app and return later
- Jobs continue processing even if no one is watching

## Usage

### Automatic Triggers

**1. When Plans Are Uploaded:**
- Automatically queues vectorization for all uploaded plans
- Runs in background - user can close the app
- Plans are ready for chat when vectorization completes
- Priority: 5 (medium priority)

**2. When User Tries to Chat:**
- If plan isn't vectorized, automatically queues the job
- Shows progress in the chat interface
- Retries the chat request once complete
- Priority: 10 (higher priority for user-initiated)

### Manual Queueing
```typescript
// Queue a plan for vectorization
const response = await fetch('/api/plan-vectorization/queue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    planId: '...',
    jobId: '...',
    priority: 10, // Optional, higher = more priority
  }),
})
```

### Check Status
```typescript
// Get vectorization job status
const response = await fetch(`/api/plan-vectorization/queue?planId=...&jobId=...`)
const job = await response.json()
// job.status: 'pending' | 'processing' | 'completed' | 'failed'
// job.progress: 0-100
// job.current_step: "Extracting text from PDF..."
```

## Benefits

1. **Non-blocking**: Users can continue using the app while vectorization runs
2. **Resilient**: Jobs continue even if user closes the app
3. **Transparent**: Real-time progress updates
4. **Scalable**: Handles very large PDFs (100+ pages) efficiently
5. **User-friendly**: Automatic retry once vectorization completes

## Future Improvements

- Add webhook notifications when vectorization completes
- Add email notifications for very long jobs
- Add admin dashboard to monitor queue
- Add ability to cancel jobs
- Add priority levels (user-initiated vs. background)
- Add retry logic with exponential backoff
