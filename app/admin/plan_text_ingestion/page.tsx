'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle2, Loader2, RefreshCcw, Sparkles, Clock, Play, List, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface IngestionResponse {
  planId: string
  chunkCount: number
  pageCount: number
  warnings?: string[]
}

interface ResultEntry {
  timestamp: number
  request: {
    planId: string
    jobId?: string
  }
  status: 'success' | 'error'
  response?: IngestionResponse
  errorMessage?: string
  planTitle?: string | null
}

interface BackfillPlanResult {
  planId: string
  planTitle: string | null
  status: 'success' | 'error'
  chunkCount?: number
  pageCount?: number
  warnings?: string[]
  errorMessage?: string
}

interface BackfillResponse {
  processed: BackfillPlanResult[]
  hasMore: boolean
}

interface QueueJob {
  id: string
  plan_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  priority: number
  progress: number
  current_step: string | null
  error_message: string | null
  chunks_created: number | null
  pages_processed: number | null
  total_pages: number | null
  queued_at: string
  started_at: string | null
  completed_at: string | null
  plan?: {
    id: string
    title: string | null
    file_name: string
  }
}

interface QueueStatus {
  jobId?: string
  status?: string
  progress?: number
  currentStep?: string
  error?: string
}

interface PlanWithJob {
  id: string
  title: string | null
  file_name: string
  job_id: string
  job?: {
    id: string
    name: string | null
  }
}

export default function PlanTextIngestionAdminPage() {
  const [planId, setPlanId] = useState('')
  const [jobId, setJobId] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ResultEntry[]>([])
  const [backfillRunning, setBackfillRunning] = useState(false)
  const [backfillSummary, setBackfillSummary] = useState<string | null>(null)
  const [backfillError, setBackfillError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()
  const router = useRouter()

  // Vectorization queue state
  const [queuePlanId, setQueuePlanId] = useState('')
  const [queueJobId, setQueueJobId] = useState('')
  const [queuePriority, setQueuePriority] = useState('5')
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([])
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [queueStatusPlanId, setQueueStatusPlanId] = useState('')
  
  // Plans list for selection
  const [plans, setPlans] = useState<PlanWithJob[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    checkAdminStatus()
  }, [user, authLoading, router])

  const checkAdminStatus = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Failed to verify admin status:', error)
        setAuthChecked(true)
        return
      }

      if (!data?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
    } catch (error) {
      console.error('Failed to verify admin status:', error)
    } finally {
      setAuthChecked(true)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!planId.trim()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/plan-text-chunks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: planId.trim(),
          jobId: jobId.trim() || undefined,
        }),
      })

      const timestamp = Date.now()

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const errorMessage =
          payload?.error ||
          'Plan text ingestion failed. Check the plan/job IDs and ensure the plan file is accessible.'

        setResults((prev) => [
          {
            timestamp,
            request: { planId: planId.trim(), jobId: jobId.trim() || undefined },
            status: 'error',
            errorMessage,
          },
          ...prev,
        ])
        return
      }

      const payload: IngestionResponse = await response.json()
      setResults((prev) => [
        {
          timestamp,
          request: { planId: planId.trim(), jobId: jobId.trim() || undefined },
          status: 'success',
          response: payload,
        },
        ...prev,
      ])
    } catch (error) {
      console.error('Plan text ingestion request failed:', error)
      const timestamp = Date.now()
      setResults((prev) => [
        {
          timestamp,
          request: { planId: planId.trim(), jobId: jobId.trim() || undefined },
          status: 'error',
          errorMessage: 'Request failed before reaching the server. Check console for details.',
        },
        ...prev,
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleBackfillAll = async () => {
    if (backfillRunning) return
    setBackfillRunning(true)
    setBackfillSummary(null)
    setBackfillError(null)

    const aggregatedEntries: ResultEntry[] = []
    let totalProcessed = 0
    let totalErrors = 0
    const MAX_BATCHES = 12
    const BATCH_LIMIT = 2

    try {
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const response = await fetch('/api/plan-text-chunks/backfill', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ limit: BATCH_LIMIT }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error || 'Backfill request failed')
        }

        const payload: BackfillResponse = await response.json()
        if (!Array.isArray(payload.processed) || payload.processed.length === 0) {
          if (totalProcessed === 0) {
            setBackfillSummary('No remaining plans needed ingestion.')
          }
          break
        }

        payload.processed.forEach((planResult) => {
          const entryTimestamp = Date.now() + aggregatedEntries.length + Math.random()
          if (planResult.status === 'success') {
            aggregatedEntries.push({
              timestamp: entryTimestamp,
              request: { planId: planResult.planId },
              status: 'success',
              response: {
                planId: planResult.planId,
                chunkCount: planResult.chunkCount ?? 0,
                pageCount: planResult.pageCount ?? 0,
                warnings: planResult.warnings,
              },
              planTitle: planResult.planTitle,
            })
          } else {
            aggregatedEntries.push({
              timestamp: entryTimestamp,
              request: { planId: planResult.planId },
              status: 'error',
              errorMessage: planResult.errorMessage || 'Unknown ingestion error',
              planTitle: planResult.planTitle,
            })
            totalErrors += 1
          }
        })

        totalProcessed += payload.processed.length

        if (!payload.hasMore) {
          break
        }
      }

      if (aggregatedEntries.length > 0) {
        setResults((prev) => [...aggregatedEntries, ...prev])
      }

      const summaryPieces = []
      if (totalProcessed > 0) {
        summaryPieces.push(`${totalProcessed} plan${totalProcessed === 1 ? '' : 's'} processed`)
      }
      if (totalErrors > 0) {
        summaryPieces.push(`${totalErrors} error${totalErrors === 1 ? '' : 's'}`)
      }
      if (summaryPieces.length > 0) {
        setBackfillSummary(summaryPieces.join(' · '))
      } else if (totalProcessed === 0) {
        setBackfillSummary((prev) => prev ?? 'No remaining plans needed ingestion.')
      } else {
        setBackfillSummary('Backfill completed.')
      }
    } catch (error) {
      console.error('Backfill request failed:', error)
      setBackfillError(error instanceof Error ? error.message : 'Backfill failed')
    } finally {
      setBackfillRunning(false)
    }
  }

  const resetForm = () => {
    setPlanId('')
    setJobId('')
  }

  // Vectorization queue functions
  const handleQueuePlan = async () => {
    if (!queuePlanId.trim()) return

    setQueueLoading(true)
    setQueueStatus(null)

    try {
      const response = await fetch('/api/plan-vectorization/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: queuePlanId.trim(),
          jobId: queueJobId.trim() || null,
          priority: parseInt(queuePriority) || 5,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setQueueStatus({
          error: data.error || 'Failed to queue vectorization',
        })
        return
      }

      setQueueStatus({
        jobId: data.jobId,
        status: 'pending',
        progress: 0,
      })

      // Refresh queue list
      loadQueueJobs()
    } catch (error) {
      setQueueStatus({
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setQueueLoading(false)
    }
  }

  const checkQueueStatus = async () => {
    if (!queueStatusPlanId.trim()) return

    setLoadingQueue(true)
    setQueueStatus(null)

    try {
      const response = await fetch(
        `/api/plan-vectorization/queue?planId=${queueStatusPlanId.trim()}`
      )

      if (!response.ok) {
        const data = await response.json()
        setQueueStatus({
          error: data.error || 'Failed to check queue status',
        })
        return
      }

      const data = await response.json()
      setQueueStatus({
        jobId: data.id,
        status: data.status,
        progress: data.progress,
        currentStep: data.current_step,
        error: data.error_message,
      })
    } catch (error) {
      setQueueStatus({
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setLoadingQueue(false)
    }
  }

  const loadQueueJobs = async () => {
    setLoadingQueue(true)
    try {
      const { data, error } = await supabase
        .from('plan_vectorization_queue')
        .select(`
          *,
          plans!inner(id, title, file_name)
        `)
        .order('queued_at', { ascending: false })
        .limit(20)

      if (error) throw error

      // Transform the data
      const transformed = (data || []).map((job: any) => ({
        ...job,
        plan: Array.isArray(job.plans) ? job.plans[0] : job.plans,
      }))

      setQueueJobs(transformed)
    } catch (error) {
      console.error('Failed to load queue jobs:', error)
    } finally {
      setLoadingQueue(false)
    }
  }

  const loadPlans = async () => {
    setLoadingPlans(true)
    try {
      const { data, error } = await supabase
        .from('plans')
        .select(`
          id,
          title,
          file_name,
          job_id,
          jobs!inner(id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(1000) // Limit to most recent 1000 plans

      if (error) throw error

      // Transform the data
      const transformed = (data || []).map((plan: any) => ({
        ...plan,
        job: Array.isArray(plan.jobs) ? plan.jobs[0] : plan.jobs,
      }))

      setPlans(transformed)
    } catch (error) {
      console.error('Failed to load plans:', error)
    } finally {
      setLoadingPlans(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadQueueJobs()
      loadPlans()
    }
  }, [isAdmin])

  // Update jobId when plan is selected (for queue)
  useEffect(() => {
    if (queuePlanId) {
      const selectedPlan = plans.find(p => p.id === queuePlanId)
      if (selectedPlan?.job_id) {
        setQueueJobId(selectedPlan.job_id)
      }
    }
  }, [queuePlanId, plans])

  // Update jobId when plan is selected (for ingestion)
  useEffect(() => {
    if (planId) {
      const selectedPlan = plans.find(p => p.id === planId)
      if (selectedPlan?.job_id) {
        setJobId(selectedPlan.job_id)
      }
    }
  }, [planId, plans])

  if (authLoading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Plan Text Ingestion & Vectorization</h1>
        <p className="text-muted-foreground">
          Manage plan text extraction, embedding, and vectorization. Queue plans for background processing
          or trigger immediate ingestion. Use this after running migrations or uploading new plan files.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ingestion Request</CardTitle>
          <CardDescription>
            Provide the plan and job identifiers. The job ID helps with access checks but is optional
            if the plan already references a job. Or use the backfill action to ingest every plan
            that is still missing snippets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">Backfill missing plans</p>
                <p className="text-xs text-blue-800/80">
                  Run ingestion automatically for every plan that does not yet have blueprint text.
                  This may take several minutes depending on file sizes.
                </p>
              </div>
              <Button
                type="button"
                className="gap-2"
                onClick={handleBackfillAll}
                disabled={backfillRunning}
              >
                {backfillRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {backfillRunning ? 'Backfilling…' : 'Backfill all missing plans'}
              </Button>
            </div>
            {(backfillSummary || backfillError) && (
              <p
                className={`mt-3 text-xs ${
                  backfillError ? 'text-red-700' : 'text-blue-900'
                }`}
              >
                {backfillError || backfillSummary}
              </p>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="plan-id">Select Plan</Label>
              <Select
                value={planId}
                onValueChange={setPlanId}
                disabled={loading || loadingPlans}
                required
              >
                <SelectTrigger id="plan-id">
                  <SelectValue placeholder={loadingPlans ? "Loading plans..." : "Select a plan..."} />
                </SelectTrigger>
                <SelectContent>
                  {loadingPlans ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading plans...</div>
                  ) : plans.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No plans available</div>
                  ) : (
                    plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.title || plan.file_name} • {plan.job?.name || 'Unknown Job'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {planId && (
                <p className="text-xs text-muted-foreground">
                  Plan ID: <span className="font-mono">{planId}</span>
                </p>
              )}
            </div>

            {jobId && (
              <div className="space-y-2">
                <Label htmlFor="job-id">
                  Job ID <span className="text-muted-foreground">(auto-filled)</span>
                </Label>
                <Input
                  id="job-id"
                  value={jobId}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={loading || !planId.trim()} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {loading ? 'Starting ingestion…' : 'Run ingestion'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} disabled={loading} className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
          <CardDescription>
            View the outcome of the most recent ingestion requests. The latest run appears first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
              <AlertCircle className="h-6 w-6" />
              <p className="text-sm">No ingestion runs yet. Submit a plan ID to process blueprint text.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result) => (
                <div
                  key={result.timestamp}
                  className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{new Date(result.timestamp).toLocaleString()}</span>
                    <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground/80">
                      Plan {result.request.planId}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                  {result.planTitle && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Title:</span>{' '}
                      <span>{result.planTitle}</span>
                    </p>
                  )}
                    {result.request.jobId && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Job ID:</span>{' '}
                        <span className="font-mono">{result.request.jobId}</span>
                      </p>
                    )}

                    {result.status === 'success' && result.response ? (
                      <div className="space-y-1">
                        <p className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Ingestion succeeded.
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Chunks:</span>{' '}
                          {result.response.chunkCount.toLocaleString()}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Pages processed:</span>{' '}
                          {result.response.pageCount.toLocaleString()}
                        </p>
                        {result.response.warnings && result.response.warnings.length > 0 && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                            <p className="font-medium">Warnings</p>
                            <ul className="mt-1 space-y-1 text-xs">
                              {result.response.warnings.map((warning, index) => (
                                <li key={index} className="leading-relaxed">
                                  • {warning}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
                        <p className="flex items-center gap-2 font-medium">
                          <AlertCircle className="h-4 w-4" />
                          Ingestion failed.
                        </p>
                        <p className="mt-1 text-xs leading-relaxed">
                          {result.errorMessage || 'Unknown error. Check server logs for details.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Need to inspect the raw plan text chunks? Query the `plan_text_chunks` table filtered by the plan
            ID in Supabase to verify the stored snippets and embeddings.
          </p>
        </CardFooter>
      </Card>

      {/* Vectorization Queue Management */}
      <Card>
        <CardHeader>
          <CardTitle>Vectorization Queue</CardTitle>
          <CardDescription>
            Queue plans for background vectorization. This is the recommended method for
            processing multiple plans as it runs in the background without blocking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Queue a plan */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="queue-plan-id">Select Plan</Label>
              <Select
                value={queuePlanId}
                onValueChange={setQueuePlanId}
                disabled={queueLoading || loadingPlans}
              >
                <SelectTrigger id="queue-plan-id">
                  <SelectValue placeholder={loadingPlans ? "Loading plans..." : "Select a plan..."} />
                </SelectTrigger>
                <SelectContent>
                  {loadingPlans ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading plans...</div>
                  ) : plans.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No plans available</div>
                  ) : (
                    plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.title || plan.file_name} • {plan.job?.name || 'Unknown Job'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {queuePlanId && (
                <p className="text-xs text-muted-foreground">
                  Plan ID: <span className="font-mono">{queuePlanId}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="queue-priority">Priority (higher = more priority)</Label>
              <Input
                id="queue-priority"
                type="number"
                min="0"
                max="10"
                value={queuePriority}
                onChange={(e) => setQueuePriority(e.target.value)}
                disabled={queueLoading}
              />
            </div>
            {queueJobId && (
              <p className="text-xs text-muted-foreground">
                Job ID: <span className="font-mono">{queueJobId}</span> (auto-filled from selected plan)
              </p>
            )}

            <Button
              onClick={handleQueuePlan}
              disabled={queueLoading || !queuePlanId.trim()}
              className="gap-2"
            >
              {queueLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {queueLoading ? 'Queueing...' : 'Queue for Vectorization'}
            </Button>

            {queueStatus && (
              <div
                className={`rounded-lg border p-4 ${
                  queueStatus.error
                    ? 'border-destructive/40 bg-destructive/10'
                    : 'border-emerald-200 bg-emerald-50/10'
                }`}
              >
                {queueStatus.error ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{queueStatus.error}</span>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Plan queued successfully!
                    </p>
                    <p>
                      <span className="font-medium">Queue Job ID:</span>{' '}
                      <span className="font-mono text-xs">{queueStatus.jobId}</span>
                    </p>
                    <p>
                      <span className="font-medium">Status:</span> {queueStatus.status}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Check queue status */}
          <div className="border-t pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="check-queue-plan-id">Check Queue Status for Plan</Label>
              <div className="flex gap-2">
                <Select
                  value={queueStatusPlanId}
                  onValueChange={setQueueStatusPlanId}
                  disabled={loadingQueue || loadingPlans}
                >
                  <SelectTrigger id="check-queue-plan-id" className="flex-1">
                    <SelectValue placeholder={loadingPlans ? "Loading plans..." : "Select a plan to check status..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingPlans ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading plans...</div>
                    ) : plans.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No plans available</div>
                    ) : (
                      plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.title || plan.file_name} • {plan.job?.name || 'Unknown Job'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={checkQueueStatus}
                  disabled={loadingQueue || !queueStatusPlanId.trim()}
                  variant="outline"
                  className="gap-2"
                >
                  {loadingQueue ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <List className="h-4 w-4" />
                  )}
                  Check
                </Button>
              </div>
            </div>

            {queueStatus && queueStatusPlanId && (
              <div className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-3">
                {queueStatus.error ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm">{queueStatus.error}</span>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Status:</span>
                      <Badge
                        variant={
                          queueStatus.status === 'completed'
                            ? 'default'
                            : queueStatus.status === 'failed'
                            ? 'destructive'
                            : queueStatus.status === 'processing'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {queueStatus.status}
                      </Badge>
                    </div>
                    {queueStatus.progress !== undefined && (
                      <div>
                        <span className="font-medium">Progress:</span> {queueStatus.progress}%
                        <div className="mt-1 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all"
                            style={{ width: `${queueStatus.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {queueStatus.currentStep && (
                      <p>
                        <span className="font-medium">Current Step:</span> {queueStatus.currentStep}
                      </p>
                    )}
                    {queueStatus.jobId && (
                      <p>
                        <span className="font-medium">Job ID:</span>{' '}
                        <span className="font-mono text-xs">{queueStatus.jobId}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Queue Jobs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Queue Jobs</CardTitle>
              <CardDescription>
                View recent vectorization queue jobs and their status
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadQueueJobs}
              disabled={loadingQueue}
              className="gap-2"
            >
              <RefreshCcw className={`h-4 w-4 ${loadingQueue ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingQueue ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : queueJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
              <List className="h-6 w-6" />
              <p className="text-sm">No queue jobs found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {queueJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {job.plan?.title || job.plan?.file_name || 'Unknown Plan'}
                        </span>
                        <Badge
                          variant={
                            job.status === 'completed'
                              ? 'default'
                              : job.status === 'failed'
                              ? 'destructive'
                              : job.status === 'processing'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {job.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Plan: {job.plan_id} • Job: {job.id}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {new Date(job.queued_at).toLocaleString()}
                    </div>
                  </div>

                  {job.status === 'processing' && job.progress !== undefined && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Progress: {job.progress}%</span>
                        {job.current_step && <span>{job.current_step}</span>}
                      </div>
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {job.status === 'completed' && (
                    <div className="text-xs space-y-1">
                      <p>
                        <span className="font-medium">Chunks created:</span>{' '}
                        {job.chunks_created?.toLocaleString() || 0}
                      </p>
                      <p>
                        <span className="font-medium">Pages processed:</span>{' '}
                        {job.pages_processed || 0} / {job.total_pages || 0}
                      </p>
                      {job.completed_at && (
                        <p className="text-muted-foreground">
                          Completed: {new Date(job.completed_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  {job.status === 'failed' && job.error_message && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-xs">
                      <p className="font-medium">Error:</p>
                      <p className="mt-1">{job.error_message}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

