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
  Download
} from 'lucide-react'
import Link from 'next/link'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

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
}

export default function PlansPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])
  const [searchQuery, setSearchQuery] = useState('')

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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Plans</h1>
            <p className="text-gray-600">Manage your construction plans and takeoffs</p>
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
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery ? 'No plans found' : 'No plans yet'}
                </h3>
                <p className="text-gray-600 mb-6">
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
                    <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
                      <FileText className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {plan.status}
                    </Badge>
                  </div>

                  <h3 className="font-semibold text-lg mb-2 truncate">
                    {plan.title || plan.file_name}
                  </h3>

                  {plan.project_name && (
                    <p className="text-sm text-gray-600 mb-1 truncate">
                      {plan.project_name}
                    </p>
                  )}

                  {plan.project_location && (
                    <p className="text-sm text-gray-500 mb-3 truncate">
                      {plan.project_location}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline" className="text-xs">
                      {plan.num_pages} {plan.num_pages === 1 ? 'page' : 'pages'}
                    </Badge>
                    {plan.has_takeoff_analysis && (
                      <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300">
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Takeoff
                      </Badge>
                    )}
                    {plan.has_quality_analysis && (
                      <Badge variant="outline" className="text-xs bg-green-50 border-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Quality
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <Link href={`/dashboard/plans/${plan.id}`} className="flex-1">
                      <Button variant="default" className="w-full" size="sm">
                        Open Plan
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePlan(plan.id)}
                      className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500 mt-3">
                    Uploaded {new Date(plan.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


