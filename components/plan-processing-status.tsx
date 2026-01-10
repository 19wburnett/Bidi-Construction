'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VectorizationJob {
  id: string
  plan_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  current_step: string | null
  error_message: string | null
  total_pages: number | null
  processed_pages: number | null
  queued_at: string
  started_at: string | null
  completed_at: string | null
}

interface PlanProcessingStatusProps {
  planId: string
  jobId?: string
  /** Polling interval in milliseconds (default: 3000) */
  pollInterval?: number
  /** Callback when processing completes */
  onComplete?: () => void
  /** Callback when processing fails */
  onError?: (error: string) => void
  /** Whether to auto-hide when completed */
  autoHideOnComplete?: boolean
  /** Delay before auto-hide in ms (default: 3000) */
  autoHideDelay?: number
  /** Compact mode - minimal display */
  compact?: boolean
  /** Show in a badge style */
  badge?: boolean
  /** Whether to hide when processing fails */
  hideOnFailed?: boolean
}

export function PlanProcessingStatus({
  planId,
  jobId,
  pollInterval = 3000,
  onComplete,
  onError,
  autoHideOnComplete = true,
  autoHideDelay = 3000,
  compact = false,
  badge = false,
  hideOnFailed = false,
}: PlanProcessingStatusProps) {
  const [job, setJob] = useState<VectorizationJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isHidden, setIsHidden] = useState(false)
  const [hasCalledComplete, setHasCalledComplete] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const params = new URLSearchParams({ planId })
      if (jobId) params.append('jobId', jobId)
      
      const response = await fetch(`/api/plan-vectorization/queue?${params}`)
      
      if (response.status === 404) {
        // No job found - might not have been queued yet or already processed
        setJob(null)
        return
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      setJob(data)
      setError(null)
      
      // Handle completion callback
      if (data.status === 'completed' && !hasCalledComplete) {
        setHasCalledComplete(true)
        onComplete?.()
        
        if (autoHideOnComplete) {
          setTimeout(() => setIsHidden(true), autoHideDelay)
        }
      }
      
      // Handle error callback
      if (data.status === 'failed' && data.error_message) {
        onError?.(data.error_message)
      }
    } catch (err) {
      console.error('[PlanProcessingStatus] Failed to fetch status:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    }
  }, [planId, jobId, onComplete, onError, autoHideOnComplete, autoHideDelay, hasCalledComplete])

  // Initial fetch and polling
  useEffect(() => {
    fetchStatus()
    
    const interval = setInterval(fetchStatus, pollInterval)
    
    return () => clearInterval(interval)
  }, [fetchStatus, pollInterval])

  // Don't render if hidden or no job
  if (isHidden) return null
  if (!job) return null
  
  // Don't render if already completed (unless we haven't shown it yet)
  if (job.status === 'completed' && hasCalledComplete && autoHideOnComplete) {
    return null
  }
  
  // Don't render if failed and hideOnFailed is true
  if (job.status === 'failed' && hideOnFailed) {
    return null
  }

  // Badge style for minimal inline display
  if (badge) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        job.status === 'pending' && "bg-amber-100 text-amber-800",
        job.status === 'processing' && "bg-blue-100 text-blue-800",
        job.status === 'completed' && "bg-green-100 text-green-800",
        job.status === 'failed' && "bg-red-100 text-red-800",
      )}>
        <StatusIcon status={job.status} className="h-3 w-3" />
        <span>
          {job.status === 'pending' && 'Queued'}
          {job.status === 'processing' && `${job.progress}%`}
          {job.status === 'completed' && 'Ready'}
          {job.status === 'failed' && 'Failed'}
        </span>
      </div>
    )
  }

  // Compact style for header integration
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <StatusIcon status={job.status} className="h-4 w-4" />
        <span className={cn(
          "font-medium",
          job.status === 'pending' && "text-amber-600",
          job.status === 'processing' && "text-blue-600",
          job.status === 'completed' && "text-green-600",
          job.status === 'failed' && "text-red-600",
        )}>
          {job.status === 'pending' && 'Queued for processing...'}
          {job.status === 'processing' && (job.current_step || `Processing ${job.progress}%`)}
          {job.status === 'completed' && 'Processing complete!'}
          {job.status === 'failed' && 'Processing failed'}
        </span>
        {job.status === 'processing' && (
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  // Full display (default)
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <StatusIcon status={job.status} className="h-5 w-5 mt-0.5 flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className={cn(
              "font-medium",
              job.status === 'pending' && "text-amber-800",
              job.status === 'processing' && "text-blue-800",
              job.status === 'completed' && "text-green-800",
              job.status === 'failed' && "text-red-800",
            )}>
              {job.status === 'pending' && 'Queued for Processing'}
              {job.status === 'processing' && 'Processing Plan...'}
              {job.status === 'completed' && 'Processing Complete'}
              {job.status === 'failed' && 'Processing Failed'}
            </h4>
            {job.status === 'processing' && (
              <span className="text-sm font-medium text-blue-600">{job.progress}%</span>
            )}
          </div>
          
          <p className="text-sm text-gray-600">
            {job.status === 'pending' && 'Your plan is in the queue and will be processed shortly.'}
            {job.status === 'processing' && (job.current_step || 'Extracting text and generating embeddings...')}
            {job.status === 'completed' && 'Plan is ready for AI chat and search.'}
            {job.status === 'failed' && (job.error_message || 'An error occurred during processing.')}
          </p>
          
          {/* Progress bar for processing */}
          {job.status === 'processing' && (
            <div className="mt-3">
              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              {job.total_pages && job.processed_pages !== null && (
                <p className="text-xs text-gray-500 mt-1">
                  {job.processed_pages} of {job.total_pages} pages processed
                </p>
              )}
            </div>
          )}
          
          {/* Error details for failed jobs */}
          {job.status === 'failed' && job.error_message && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {job.error_message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusIcon({ status, className }: { status: VectorizationJob['status']; className?: string }) {
  switch (status) {
    case 'pending':
      return <Clock className={cn("text-amber-500", className)} />
    case 'processing':
      return <Loader2 className={cn("text-blue-500 animate-spin", className)} />
    case 'completed':
      return <CheckCircle2 className={cn("text-green-500", className)} />
    case 'failed':
      return <XCircle className={cn("text-red-500", className)} />
    default:
      return <AlertCircle className={cn("text-gray-500", className)} />
  }
}

/**
 * Hook to get plan processing status
 * Useful for custom implementations
 */
export function usePlanProcessingStatus(planId: string, jobId?: string, pollInterval = 3000) {
  const [job, setJob] = useState<VectorizationJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    
    const fetchStatus = async () => {
      try {
        const params = new URLSearchParams({ planId })
        if (jobId) params.append('jobId', jobId)
        
        const response = await fetch(`/api/plan-vectorization/queue?${params}`)
        
        if (!mounted) return
        
        if (response.status === 404) {
          setJob(null)
          setLoading(false)
          return
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const data = await response.json()
        setJob(data)
        setError(null)
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch status')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, pollInterval)
    
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [planId, jobId, pollInterval])

  return {
    job,
    loading,
    error,
    status: job?.status || null,
    progress: job?.progress || 0,
    step: job?.current_step || null,
    isProcessing: job?.status === 'processing',
    isComplete: job?.status === 'completed',
    isFailed: job?.status === 'failed',
    isPending: job?.status === 'pending',
  }
}
