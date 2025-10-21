'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { FileText, Search, Clock, CheckCircle, ArrowLeft, Filter, Users, UserPlus } from 'lucide-react'
import Link from 'next/link'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

interface PlanWithUser {
  id: string
  title: string | null
  file_name: string
  project_name: string | null
  project_location: string | null
  takeoff_analysis_status: string | null
  takeoff_requested_at: string | null
  quality_analysis_status: string | null
  quality_requested_at: string | null
  created_at: string
  users: {
    email: string
  }
}

export default function AdminAnalyzePlansPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [plans, setPlans] = useState<PlanWithUser[]>([])
  const [filteredPlans, setFilteredPlans] = useState<PlanWithUser[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (user) {
      checkAdminStatus()
      loadPlans()
    }
  }, [user])

  useEffect(() => {
    filterPlans()
  }, [searchQuery, statusFilter, plans])

  async function checkAdminStatus() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user?.id)
        .single()

      if (error || !data?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
    } catch (error) {
      console.error('Error checking admin status:', error)
      router.push('/dashboard')
    }
  }

  async function loadPlans() {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('plans')
        .select(`
          id,
          title,
          file_name,
          project_name,
          project_location,
          takeoff_analysis_status,
          takeoff_requested_at,
          quality_analysis_status,
          quality_requested_at,
          created_at,
          user_id,
          users!inner(email)
        `)
        .order('takeoff_requested_at', { ascending: true, nullsFirst: false })

      if (error) throw error

      setPlans(data || [])
    } catch (error) {
      console.error('Error loading plans:', error)
    } finally {
      setLoading(false)
    }
  }

  function filterPlans() {
    let filtered = [...plans]

    // Status filter
    if (statusFilter === 'pending') {
      filtered = filtered.filter(p => 
        p.takeoff_analysis_status === 'pending' || p.quality_analysis_status === 'pending'
      )
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(p => 
        p.takeoff_analysis_status === 'completed' || p.quality_analysis_status === 'completed'
      )
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        (p.title?.toLowerCase().includes(query)) ||
        p.file_name.toLowerCase().includes(query) ||
        (p.project_name?.toLowerCase().includes(query)) ||
        (p.users?.email?.toLowerCase().includes(query))
      )
    }

    setFilteredPlans(filtered)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FallingBlocksLoader />
      </div>
    )
  }

  if (!user || !isAdmin) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Analyze Plans
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Review and complete takeoff and quality analyses
        </p>
      </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search by plan name, project, or user email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="pending">Pending Only</SelectItem>
              <SelectItem value="completed">Completed Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Plans Table */}
        {filteredPlans.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchQuery || statusFilter !== 'all' ? 'No plans found' : 'No plans to analyze'}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Plans will appear here when users request analysis'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Takeoff Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Quality Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Requested
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {filteredPlans.map((plan) => (
                  <tr 
                    key={plan.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/analyze-plans/${plan.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {plan.title || plan.file_name}
                        </div>
                        {plan.project_name && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {plan.project_name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {plan.users?.email || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {plan.takeoff_analysis_status === 'pending' ? (
                        <Badge variant="outline" className="bg-blue-50 border-blue-300 text-blue-700">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      ) : plan.takeoff_analysis_status === 'completed' ? (
                        <Badge variant="outline" className="bg-green-50 border-green-300 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {plan.quality_analysis_status === 'pending' ? (
                        <Badge variant="outline" className="bg-orange-50 border-orange-300 text-orange-700">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      ) : plan.quality_analysis_status === 'completed' ? (
                        <Badge variant="outline" className="bg-green-50 border-green-300 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {plan.takeoff_requested_at || plan.quality_requested_at
                          ? new Date(plan.takeoff_requested_at || plan.quality_requested_at!).toLocaleString()
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/admin/analyze-plans/${plan.id}`)
                        }}
                      >
                        Analyze
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

