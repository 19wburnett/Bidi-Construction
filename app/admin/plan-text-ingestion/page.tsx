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
import { AlertCircle, CheckCircle2, Loader2, RefreshCcw, Sparkles } from 'lucide-react'

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
        <h1 className="text-3xl font-bold tracking-tight">Plan Text Ingestion</h1>
        <p className="text-muted-foreground">
          Trigger the PDF text extraction and embedding pipeline for a specific plan. Use this after
          running a migration or uploading new plan files to ensure Plan Chat has blueprint context.
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
              <Label htmlFor="plan-id">Plan ID</Label>
              <Input
                id="plan-id"
                placeholder="d783f3f6-474e-48e7-92de-697309012ded"
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-id">
                Job ID <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="job-id"
                placeholder="00d3c9de-b9ad-45ad-820f-ddd73a63cefb"
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                disabled={loading}
              />
            </div>

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
    </div>
  )
}

