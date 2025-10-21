'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Building2, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  ArrowLeft, 
  Search,
  Mail,
  MapPin,
  Briefcase,
  Save,
  X
} from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

const TRADE_CATEGORIES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Roofing',
  'Flooring',
  'Painting',
  'Drywall',
  'Carpentry',
  'Concrete',
  'Landscaping',
  'Excavation',
  'Insulation',
  'Windows & Doors',
  'Siding',
  'General Construction',
  'Renovation',
  'Other'
]

interface Subcontractor {
  id: string
  email: string
  name: string
  trade_category: string
  location: string
  created_at: string
}

export default function ManageSubcontractorsPage() {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTrade, setFilterTrade] = useState('')
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    trade_category: '',
    location: ''
  })

  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    checkAdminStatus()
    fetchSubcontractors()
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
        console.error('Error checking admin status:', error)
        return
      }

      if (!data?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
    } catch (err) {
      console.error('Error checking admin status:', err)
    }
  }

  const fetchSubcontractors = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('subcontractors')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setError('Failed to fetch subcontractors')
        return
      }

      setSubcontractors(data || [])
    } catch (err) {
      setError('Failed to fetch subcontractors')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      trade_category: '',
      location: ''
    })
    setShowAddForm(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validate required fields
    if (!formData.email || !formData.name || !formData.trade_category || !formData.location) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      if (editingId) {
        // Update existing subcontractor
        const { error } = await supabase
          .from('subcontractors')
          .update({
            email: formData.email,
            name: formData.name,
            trade_category: formData.trade_category,
            location: formData.location
          })
          .eq('id', editingId)

        if (error) {
          setError('Failed to update subcontractor')
          return
        }

        setSuccess('Subcontractor updated successfully!')
      } else {
        // Add new subcontractor
        const { error } = await supabase
          .from('subcontractors')
          .insert([{
            email: formData.email,
            name: formData.name,
            trade_category: formData.trade_category,
            location: formData.location
          }])

        if (error) {
          if (error.code === '23505') {
            setError('A subcontractor with this email already exists.')
          } else {
            setError('Failed to add subcontractor')
          }
          return
        }

        setSuccess('Subcontractor added successfully!')
      }

      resetForm()
      fetchSubcontractors()
    } catch (err) {
      setError('An unexpected error occurred')
    }
  }

  const handleEdit = (subcontractor: Subcontractor) => {
    setFormData({
      email: subcontractor.email,
      name: subcontractor.name,
      trade_category: subcontractor.trade_category,
      location: subcontractor.location
    })
    setEditingId(subcontractor.id)
    setShowAddForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subcontractor?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('subcontractors')
        .delete()
        .eq('id', id)

      if (error) {
        setError('Failed to delete subcontractor')
        return
      }

      setSuccess('Subcontractor deleted successfully!')
      fetchSubcontractors()
    } catch (err) {
      setError('An unexpected error occurred')
    }
  }

  const filteredSubcontractors = subcontractors.filter(sub => {
    const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sub.location.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTrade = !filterTrade || filterTrade === 'all' || sub.trade_category === filterTrade
    return matchesSearch && matchesTrade
  })

  if (authLoading) {
    return null
  }

  if (!user) {
    return null
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">You need admin privileges to access this page.</p>
              <Link href="/dashboard">
                <Button>Return to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Manage Subcontractors</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/admin/demo-settings">
              <Button variant="outline" className="hidden sm:flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Subcontractors</p>
                  <p className="text-2xl font-bold text-foreground">{subcontractors.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Briefcase className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Trade Categories</p>
                  <p className="text-2xl font-bold text-foreground">
                    {new Set(subcontractors.map(s => s.trade_category)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <MapPin className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Locations</p>
                  <p className="text-2xl font-bold text-foreground">
                    {new Set(subcontractors.map(s => s.location)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Subcontractor Form */}
        {showAddForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                {editingId ? <Edit className="h-5 w-5 mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
                {editingId ? 'Edit Subcontractor' : 'Add New Subcontractor'}
              </CardTitle>
              <CardDescription>
                {editingId ? 'Update subcontractor information' : 'Add a new subcontractor to the database'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Company/Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="ABC Electrical Services"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="contact@abcelectrical.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="trade_category">Trade Category *</Label>
                    <Select value={formData.trade_category} onValueChange={(value) => handleSelectChange('trade_category', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trade category" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRADE_CATEGORIES.map((trade) => (
                          <SelectItem key={trade} value={trade}>
                            {trade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      name="location"
                      type="text"
                      required
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="City, State (e.g., Austin, TX)"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Save className="h-4 w-4 mr-2" />
                    {editingId ? 'Update' : 'Add'} Subcontractor
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={() => setShowAddForm(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Subcontractor
            </Button>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search subcontractors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            <Select value={filterTrade} onValueChange={setFilterTrade}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by trade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trades</SelectItem>
                {TRADE_CATEGORIES.map((trade) => (
                  <SelectItem key={trade} value={trade}>
                    {trade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Subcontractors Table */}
        <Card>
          <CardHeader>
            <CardTitle>Subcontractors ({filteredSubcontractors.length})</CardTitle>
            <CardDescription>
              Manage your subcontractor database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <FallingBlocksLoader text="" size="sm" />
                <p className="text-gray-600 mt-2">Loading subcontractors...</p>
              </div>
            ) : filteredSubcontractors.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No subcontractors found</p>
                {searchTerm || filterTrade ? (
                  <p className="text-sm text-muted-foreground mt-2">Try adjusting your search or filter</p>
                ) : (
                  <Button onClick={() => setShowAddForm(true)} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Subcontractor
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-foreground">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Trade</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Location</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Added</th>
                      <th className="text-right py-3 px-4 font-medium text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubcontractors.map((subcontractor) => (
                      <tr key={subcontractor.id} className="border-b hover:bg-muted">
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{subcontractor.name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center text-muted-foreground">
                            <Mail className="h-4 w-4 mr-2" />
                            {subcontractor.email}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {subcontractor.trade_category}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center text-muted-foreground">
                            <MapPin className="h-4 w-4 mr-2" />
                            {subcontractor.location}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(subcontractor.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(subcontractor)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(subcontractor.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
