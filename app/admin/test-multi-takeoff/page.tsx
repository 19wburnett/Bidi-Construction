'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { AlertCircle, CheckCircle2, Loader2, PlayCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'

type PipelineArrays = [any[], any[], any[], any[]]

interface PipelineResult {
  takeoff: any[]
  analysis: any[]
  segments: any[]
  runLog: any[]
}

interface PlanSummary {
  planId: string
  title: string | null
  projectName: string | null
  projectLocation: string | null
  createdAt: string
  jobId: string | null
}

export default function TestMultiTakeoffPage() {
  const [planId, setPlanId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [location, setLocation] = useState('')
  const [buildingType, setBuildingType] = useState('')
  const [notes, setNotes] = useState('')
  const [askScoping, setAskScoping] = useState(true)
  const [pageBatchSize, setPageBatchSize] = useState<number | ''>(5)
  const [maxParallel, setMaxParallel] = useState<number | ''>(2)
  const [unitCostPolicy, setUnitCostPolicy] = useState<'estimate' | 'lookup' | 'mixed'>('estimate')
  const [additionalPdfUrls, setAdditionalPdfUrls] = useState('')

  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [rawResponse, setRawResponse] = useState<PipelineArrays | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [plansError, setPlansError] = useState<string | null>(null)

  const parsedAdditionalUrls = useMemo(() => {
    return additionalPdfUrls
      .split(/\n|,/)
      .map((url) => url.trim())
      .filter(Boolean)
  }, [additionalPdfUrls])

  useEffect(() => {
    const loadPlans = async () => {
      try {
        setPlansLoading(true)
        setPlansError(null)

        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          setPlansError('Authentication required to load plans.')
          setPlans([])
          return
        }

        const { data, error } = await supabase
          .from('plans')
          .select('id, title, project_name, project_location, created_at, job_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) {
          setPlansError(error.message)
          setPlans([])
          return
        }

        const summaries: PlanSummary[] = (data || []).map((plan) => ({
          planId: plan.id,
          title: plan.title,
          projectName: plan.project_name,
          projectLocation: plan.project_location,
          createdAt: plan.created_at,
          jobId: plan.job_id ?? null
        }))

        setPlans(summaries)

        if (summaries.length > 0 && !planId) {
          setPlanId(summaries[0].planId)
          if (!projectName && summaries[0].projectName) {
            setProjectName(summaries[0].projectName)
          }
          if (!location && summaries[0].projectLocation) {
            setLocation(summaries[0].projectLocation)
          }
        }
      } catch (err) {
        setPlansError(err instanceof Error ? err.message : 'Failed to load plans.')
        setPlans([])
      } finally {
        setPlansLoading(false)
      }
    }

    loadPlans()
  }, [])

  const handlePlanSelect = (selectedId: string) => {
    setPlanId(selectedId)

    const selectedPlan = plans.find((plan) => plan.planId === selectedId)
    if (selectedPlan) {
      if (selectedPlan.projectName) {
        setProjectName(selectedPlan.projectName)
      }
      if (selectedPlan.projectLocation) {
        setLocation(selectedPlan.projectLocation)
      }
    }
  }

  const summary = useMemo(() => {
    if (!result) return null
    return {
      takeoffCount: result.takeoff.length,
      analysisCount: result.analysis.length,
      segmentCount: result.segments.length,
      runLogCount: result.runLog.length
    }
  }, [result])

  const handleRunPipeline = async () => {
    setIsRunning(true)
    setError(null)
    setResult(null)
    setRawResponse(null)

    try {
      if (!planId.trim()) {
        throw new Error('Please provide a plan ID.')
      }

      const payload: any = {
        plan_id: planId.trim(),
        ask_scoping_questions: askScoping,
        currency: 'USD',
        unit_cost_policy: unitCostPolicy
      }

      const jobContextOverrides: Record<string, string> = {}
      if (projectName.trim()) jobContextOverrides.project_name = projectName.trim()
      if (location.trim()) jobContextOverrides.location = location.trim()
      if (buildingType.trim()) jobContextOverrides.building_type = buildingType.trim()
      if (notes.trim()) jobContextOverrides.notes = notes.trim()

      if (Object.keys(jobContextOverrides).length > 0) {
        payload.job_context = jobContextOverrides
      }

      const batchSizeNumber = typeof pageBatchSize === 'number' ? pageBatchSize : parseInt(String(pageBatchSize || 0), 10)
      if (!Number.isNaN(batchSizeNumber) && batchSizeNumber > 0) {
        payload.page_batch_size = batchSizeNumber
      }

      const maxParallelNumber = typeof maxParallel === 'number' ? maxParallel : parseInt(String(maxParallel || 0), 10)
      if (!Number.isNaN(maxParallelNumber) && maxParallelNumber > 0) {
        payload.max_parallel_batches = maxParallelNumber
      }

      if (parsedAdditionalUrls.length > 0) {
        payload.additional_pdf_urls = parsedAdditionalUrls
      }

      const response = await fetch('/api/takeoff/multi-industry/by-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const rawText = await response.text()
      let parsed: any = null

      try {
        parsed = JSON.parse(rawText)
      } catch (parseError) {
        const preview = rawText?.slice(0, 200) || 'No response body'
        const fallbackRunLog = [
          {
            type: 'error' as const,
            message: `Pipeline returned non-JSON response (status ${response.status}). Preview: ${preview}`
          }
        ]
        setResult({ takeoff: [], analysis: [], segments: [], runLog: fallbackRunLog })
        setRawResponse(null)
        setError('Pipeline response was not valid JSON. See run log preview for details.')
        return
      }

      if (!Array.isArray(parsed) || parsed.length !== 4) {
        setResult({ takeoff: [], analysis: [], segments: [], runLog: [] })
        setRawResponse(parsed)
        setError('Unexpected response format. Expected an array with four elements.')
        return
      }

      const [takeoff, analysis, segments, runLog] = parsed as PipelineArrays
      setResult({ takeoff, analysis, segments, runLog })
      setRawResponse(parsed)

      if (!response.ok) {
        setError('Pipeline returned an error. Check the run log for details.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run pipeline.'
      setError(message)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Multi-Industry Takeoff Tester</h1>
          <p className="text-muted-foreground mt-2">
            Provide a plan ID to launch the same multi-industry pipeline the background job will use. Optional overrides let you tweak batch settings and job context.
          </p>
        </div>
        <Button onClick={handleRunPipeline} disabled={isRunning} className="flex items-center gap-2">
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              Run Pipeline
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Configuration</CardTitle>
          <CardDescription>
            Enter the plan ID and any optional overrides below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="planSelector">Select a Plan</Label>
              <Select value={planId} onValueChange={handlePlanSelect} disabled={plansLoading || plans.length === 0}>
                <SelectTrigger id="planSelector">
                  <SelectValue placeholder={plansLoading ? 'Loading plans…' : 'Choose a plan'} />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => {
                    const label = plan.title || plan.projectName || plan.planId
                    return (
                      <SelectItem key={plan.planId} value={plan.planId}>
                        <div className="flex flex-col text-left">
                          <span className="font-medium truncate">{label}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {plan.projectLocation ? `${plan.projectLocation} • ` : ''}
                            {new Date(plan.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {plansError && (
                <p className="text-xs text-red-500">{plansError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="planId">Plan ID (override)</Label>
              <Input
                id="planId"
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
                placeholder="e.g. 2f9b2dcd-..."
              />
              <p className="text-xs text-muted-foreground">
                The ID is visible in the URL when viewing a plan (e.g. <code>/dashboard/plans/[planId]</code>).
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalUrls">Additional PDF URLs (optional)</Label>
            <Textarea
              id="additionalUrls"
              value={additionalPdfUrls}
              onChange={(event) => setAdditionalPdfUrls(event.target.value)}
              placeholder="https://example.com/appendix.pdf"
            />
            <p className="text-xs text-muted-foreground">
              Optional. Comma or newline separated list to append to the plan&apos;s signed URL.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buildingType">Building Type</Label>
              <Input
                id="buildingType"
                value={buildingType}
                onChange={(event) => setBuildingType(event.target.value)}
                placeholder="e.g. commercial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pageBatchSize">Page Batch Size</Label>
              <Input
                id="pageBatchSize"
                type="number"
                min={1}
                value={pageBatchSize}
                onChange={(event) => setPageBatchSize(event.target.value ? Number(event.target.value) : '')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxParallel">Max Parallel Batches</Label>
              <Input
                id="maxParallel"
                type="number"
                min={1}
                value={maxParallel}
                onChange={(event) => setMaxParallel(event.target.value ? Number(event.target.value) : '')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Unit Cost Policy</Label>
              <Select value={unitCostPolicy} onValueChange={(value) => setUnitCostPolicy(value as typeof unitCostPolicy)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select policy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="estimate">Estimate (model supplies costs)</SelectItem>
                  <SelectItem value="lookup">Lookup (mark for pricing follow-up)</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-center md:items-start gap-3 pt-5">
              <Switch id="askScoping" checked={askScoping} onCheckedChange={setAskScoping} />
              <div>
                <Label htmlFor="askScoping">Ask Scoping Questions</Label>
                <p className="text-xs text-muted-foreground">Enable to auto-generate segments from sample pages.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Job Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-red-600 dark:text-red-400">Pipeline Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Takeoff Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{summary.takeoffCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Analysis Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{summary.analysisCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold flex items-center gap-2">
                {summary.segmentCount}
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Run Log Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{summary.runLogCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Segment Results</CardTitle>
              <CardDescription>
                Review per-segment totals and coverage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.segments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No segments returned.</p>
              ) : (
                result.segments.map((segment, index) => (
                  <div key={`${segment.industry}-${index}`} className="rounded-lg border p-4 space-y-2 bg-white dark:bg-gray-950">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-lg capitalize">{segment.industry}</h3>
                        <p className="text-sm text-muted-foreground">Categories: {segment.categories?.join(', ') || 'n/a'}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Pages processed: {segment.summary?.pages_processed ?? 0} &bull; Failed: {segment.summary?.pages_failed ?? 0}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <strong>Top risks:</strong> {segment.summary?.top_risks?.length ? segment.summary.top_risks.join('; ') : 'None reported'}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-2 pr-4">Cost Code</th>
                            <th className="py-2 pr-4">Description</th>
                            <th className="py-2 pr-4">Quantity</th>
                            <th className="py-2 pr-4">Unit</th>
                            <th className="py-2 pr-4">Est. Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(segment.summary?.totals_by_cost_code ?? []).map((row: any, rowIndex: number) => (
                            <tr key={`${row.cost_code}-${rowIndex}`} className="border-t">
                              <td className="py-2 pr-4 font-mono text-xs">{row.cost_code || '—'}</td>
                              <td className="py-2 pr-4">{row.description || '—'}</td>
                              <td className="py-2 pr-4">{row.quantity ?? '—'}</td>
                              <td className="py-2 pr-4">{row.unit || '—'}</td>
                              <td className="py-2 pr-4">{row.est_cost != null ? `$${row.est_cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Run Log</CardTitle>
              <CardDescription>Captured info/warnings/errors during pipeline execution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.runLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No log entries recorded.</p>
              ) : (
                <div className="rounded-lg border bg-background p-4 text-sm">
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(result.runLog, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Raw Response</CardTitle>
              <CardDescription>Arrays-only payload returned by the orchestrator.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-background p-4 text-sm">
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
