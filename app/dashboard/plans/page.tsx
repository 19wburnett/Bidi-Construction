'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  FileText, 
  Plus, 
  Search,
  BarChart3,
  CheckCircle,
  Clock,
  Trash2,
  Download,
  Share2,
  Copy,
  CheckCheck
} from 'lucide-react'
import Link from 'next/link'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface Plan {
  id: string
  title: string | null
  file_name: string
  status: string
  created_at: string
  project_name: string | null
  project_location: string | null
  has_takeoff_analysis: boolean
  has_quality_analysis: boolean
  num_pages: number
  takeoff_analysis_status?: string | null
  takeoff_requested_at?: string | null
  quality_analysis_status?: string | null
  quality_requested_at?: string | null
}

export default function PlansPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  
  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [sharingPlanId, setSharingPlanId] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [expiresInDays, setExpiresInDays] = useState<number>(7)
  const [allowComments, setAllowComments] = useState(true)
  const [allowDrawings, setAllowDrawings] = useState(true)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    if (user) {
      loadPlans()
    }
  }, [user])

  async function loadPlans() {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setPlans(data || [])
    } catch (error) {
      console.error('Error loading plans:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeletePlan(planId: string) {
    if (!confirm('Are you sure you want to delete this plan?')) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId)

      if (error) throw error

      // Refresh plans
      setPlans(prev => prev.filter(p => p.id !== planId))
    } catch (error) {
      console.error('Error deleting plan:', error)
      alert('Failed to delete plan')
    }
  }

  async function handleSharePlan(planId: string) {
    setSharingPlanId(planId)
    setShareUrl('')
    setLinkCopied(false)
    setShareModalOpen(true)
  }

  async function generateShareLink() {
    if (!sharingPlanId) return

    setIsGeneratingLink(true)
    try {
      const response = await fetch('/api/plan/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: sharingPlanId,
          expiresInDays: expiresInDays > 0 ? expiresInDays : null,
          allowComments,
          allowDrawings
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate link')
      }

      setShareUrl(data.shareUrl)
    } catch (error) {
      console.error('Error generating share link:', error)
      alert('Failed to generate share link. Please try again.')
    } finally {
      setIsGeneratingLink(false)
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (error) {
      console.error('Error copying link:', error)
      alert('Failed to copy link')
    }
  }

  const filteredPlans = plans.filter(plan => {
    const query = searchQuery.toLowerCase()
    return (
      (plan.title?.toLowerCase().includes(query)) ||
      plan.file_name.toLowerCase().includes(query) ||
      (plan.project_name?.toLowerCase().includes(query)) ||
      (plan.project_location?.toLowerCase().includes(query))
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FallingBlocksLoader />
      </div>
    )
  }

  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Plans</h1>
            <p className="text-gray-600 dark:text-gray-300">Manage your construction plans and takeoffs</p>
          </div>
          <Link href="/dashboard/plans/new">
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Upload Plan
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Plans Grid */}
        {filteredPlans.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {searchQuery ? 'No plans found' : 'No plans yet'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {searchQuery ? 'Try adjusting your search' : 'Upload your first construction plan to get started'}
                </p>
                {!searchQuery && (
                  <Link href="/dashboard/plans/new">
                    <Button className="bg-orange-500 hover:bg-orange-600">
                      <Plus className="h-4 w-4 mr-2" />
                      Upload Plan
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlans.map(plan => (
              <Card key={plan.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 p-3 rounded-lg">
                      <FileText className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {plan.status}
                    </Badge>
                  </div>

                  <h3 className="font-semibold text-lg mb-2 truncate dark:text-white">
                    {plan.title || plan.file_name}
                  </h3>

                  {plan.project_name && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 truncate">
                      {plan.project_name}
                    </p>
                  )}

                  {plan.project_location && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 truncate">
                      {plan.project_location}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline" className="text-xs">
                      {plan.num_pages} {plan.num_pages === 1 ? 'page' : 'pages'}
                    </Badge>
                    
                    {/* Takeoff Status */}
                    {plan.takeoff_analysis_status === 'pending' ? (
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400">
                        <Clock className="h-3 w-3 mr-1 animate-pulse" />
                        Takeoff Pending
                      </Badge>
                    ) : plan.has_takeoff_analysis && (
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 dark:text-blue-400">
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Takeoff
                      </Badge>
                    )}
                    
                    {/* Quality Status */}
                    {plan.quality_analysis_status === 'pending' ? (
                      <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400">
                        <Clock className="h-3 w-3 mr-1 animate-pulse" />
                        Quality Pending
                      </Badge>
                    ) : plan.has_quality_analysis && (
                      <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700 dark:text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Quality
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 pt-4 border-t dark:border-gray-700">
                    <Link href={`/dashboard/plans/${plan.id}`} className="block">
                      <Button variant="default" className="w-full" size="sm">
                        Open Plan
                      </Button>
                    </Link>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSharePlan(plan.id)}
                        className="flex-1"
                      >
                        <Share2 className="h-4 w-4 mr-1" />
                        Share
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePlan(plan.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Uploaded {new Date(plan.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Share Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="p-4 sm:p-6 sm:max-w-md dark:bg-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>Share Plan</DialogTitle>
            <DialogDescription>
              Generate a shareable link that allows others to view and collaborate on this plan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!shareUrl ? (
              <>
                {/* Share settings */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="expires">Link Expiration</Label>
                    <Input
                      id="expires"
                      type="number"
                      min="0"
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Days until link expires (0 = never expires)
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allowComments"
                      checked={allowComments}
                      onChange={(e) => setAllowComments(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="allowComments" className="cursor-pointer">
                      Allow guests to add comments
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allowDrawings"
                      checked={allowDrawings}
                      onChange={(e) => setAllowDrawings(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="allowDrawings" className="cursor-pointer">
                      Allow guests to add drawings
                    </Label>
                  </div>
                </div>

                <Button
                  onClick={generateShareLink}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  disabled={isGeneratingLink}
                >
                  {isGeneratingLink ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Generating Link...
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4 mr-2" />
                      Generate Share Link
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* Share link display */}
                <div className="space-y-3">
                  <div>
                    <Label>Share Link</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={shareUrl}
                        readOnly
                        className="flex-1 font-mono text-sm"
                      />
                      <Button
                        onClick={copyShareLink}
                        variant="outline"
                        size="sm"
                      >
                        {linkCopied ? (
                          <>
                            <CheckCheck className="h-4 w-4 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Anyone with this link can view and collaborate on the plan
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Link Permissions:
                    </h4>
                    <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                      <li>✓ View plan files</li>
                      {allowComments && <li>✓ Add comments</li>}
                      {allowDrawings && <li>✓ Add drawings</li>}
                      {expiresInDays > 0 && (
                        <li>⏰ Expires in {expiresInDays} day{expiresInDays !== 1 ? 's' : ''}</li>
                      )}
                      {expiresInDays === 0 && <li>⏰ Never expires</li>}
                    </ul>
                  </div>

                  <Button
                    onClick={() => {
                      setShareUrl('')
                      setSharingPlanId(null)
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Generate Another Link
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


