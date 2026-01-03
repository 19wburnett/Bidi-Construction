/**
 * Helper function to queue a plan for background vectorization
 * Can be called from anywhere in the app (frontend or backend)
 */

/**
 * Queue a plan for background vectorization
 * @param planId - The plan ID to vectorize
 * @param jobId - Optional job ID
 * @param priority - Priority level (higher = more priority, default: 5)
 * @returns Promise with queue job info or error
 */
export async function queuePlanVectorization(
  planId: string,
  jobId?: string | null,
  priority: number = 5
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    console.log(`[QueueVectorization] Queuing vectorization for plan ${planId}, job ${jobId}, priority ${priority}`)
    
    const response = await fetch('/api/plan-vectorization/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        jobId: jobId || null,
        priority,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error(`[QueueVectorization] API error (${response.status}):`, error)
      return {
        success: false,
        error: error.error || `Failed to queue vectorization (HTTP ${response.status})`,
      }
    }

    const data = await response.json()
    console.log(`[QueueVectorization] Successfully queued: job ${data.jobId}`)
    return {
      success: true,
      jobId: data.jobId,
    }
  } catch (error) {
    console.error('[QueueVectorization] Failed to queue:', error)
    // Don't throw - return error so caller can handle it
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
