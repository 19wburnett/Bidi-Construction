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
  X,
  Upload,
  Download,
  FileText
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

interface Contact {
  id: string
  gc_id: string
  email: string
  name: string
  company: string | null
  phone: string | null
  trade_category: string
  location: string
  notes: string | null
  created_at: string
  updated_at: string
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTrade, setFilterTrade] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: '',
    phone: '',
    trade_category: '',
    location: '',
    notes: ''
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

    fetchContacts()
  }, [user, authLoading, router])

  const fetchContacts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterTrade) params.append('trade_category', filterTrade)
      if (filterLocation) params.append('location', filterLocation)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/contacts?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch contacts')
        return
      }

      setContacts(data.contacts || [])
    } catch (err) {
      setError('Failed to fetch contacts')
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
      company: '',
      phone: '',
      trade_category: '',
      location: '',
      notes: ''
    })
    setEditingId(null)
    setShowAddForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.email || !formData.name || !formData.trade_category || !formData.location) {
      setError('Please fill in all required fields')
      return
    }

    try {
      const url = editingId ? '/api/contacts' : '/api/contacts'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId ? { id: editingId, ...formData } : formData

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to save contact')
        return
      }

      setSuccess(editingId ? 'Contact updated successfully!' : 'Contact added successfully!')
      resetForm()
      fetchContacts()
    } catch (err) {
      setError('An unexpected error occurred')
    }
  }

  const handleEdit = (contact: Contact) => {
    setFormData({
      email: contact.email,
      name: contact.name,
      company: contact.company || '',
      phone: contact.phone || '',
      trade_category: contact.trade_category,
      location: contact.location,
      notes: contact.notes || ''
    })
    setEditingId(contact.id)
    setShowAddForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) {
      return
    }

    try {
      const response = await fetch(`/api/contacts?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to delete contact')
        return
      }

      setSuccess('Contact deleted successfully!')
      fetchContacts()
    } catch (err) {
      setError('An unexpected error occurred')
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      setError('Please select a file to import')
      return
    }

    setImporting(true)
    setError('')
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', importFile)

      const response = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to import contacts')
        if (data.details) {
          setError(data.error + ': ' + data.details.join(', '))
        }
        return
      }

      setImportResult(data)
      setSuccess(data.message)
      setShowImportModal(false)
      setImportFile(null)
      fetchContacts()
    } catch (err) {
      setError('An unexpected error occurred during import')
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = 'email,name,company,phone,trade_category,location,notes\nexample@email.com,John Doe,ABC Construction,555-1234,Electrical,San Francisco CA,Great electrician'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'contacts_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = !searchTerm || 
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.company && contact.company.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesTrade = !filterTrade || contact.trade_category === filterTrade
    const matchesLocation = !filterLocation || contact.location.toLowerCase().includes(filterLocation.toLowerCase())
    
    return matchesSearch && matchesTrade && matchesLocation
  })

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FallingBlocksLoader text="Loading..." size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">
                  Import completed: {importResult.imported_count} contacts imported, {importResult.skipped_count} skipped
                </p>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-blue-700">Errors:</p>
                    <ul className="text-sm text-blue-600 list-disc list-inside">
                      {importResult.errors.map((error: string, index: number) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <Button onClick={() => setShowAddForm(true)} className="flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowImportModal(true)}
            className="flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Contacts
          </Button>
          <Button 
            variant="outline" 
            onClick={downloadTemplate}
            className="flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>
              <div>
                <Label htmlFor="trade-filter">Trade Category</Label>
                <Select value={filterTrade || 'all'} onValueChange={(v) => setFilterTrade(v === 'all' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All trades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All trades</SelectItem>
                    {TRADE_CATEGORIES.map(trade => (
                      <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="location-filter">Location</Label>
                <Input
                  id="location-filter"
                  placeholder="Filter by location..."
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Form */}
        {showAddForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {editingId ? 'Edit Contact' : 'Add New Contact'}
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="trade_category">Trade Category *</Label>
                    <Select 
                      value={formData.trade_category} 
                      onValueChange={(value) => handleSelectChange('trade_category', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trade category" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRADE_CATEGORIES.map(trade => (
                          <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Save className="h-4 w-4 mr-2" />
                    {editingId ? 'Update' : 'Add'} Contact
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Import Contacts
                  <Button variant="ghost" size="sm" onClick={() => setShowImportModal(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Upload a CSV or Excel file with your contacts. Download the template for the correct format.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="import-file">Select File</Label>
                    <Input
                      id="import-file"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowImportModal(false)}
                      disabled={importing}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleImport}
                      disabled={!importFile || importing}
                    >
                      {importing ? 'Importing...' : 'Import'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contacts List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Contacts ({filteredContacts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <FallingBlocksLoader text="Loading contacts..." size="md" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No contacts found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {contacts.length === 0 
                    ? 'Add your first contact or import from a file'
                    : 'Try adjusting your filters'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredContacts.map((contact) => (
                  <div key={contact.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{contact.name}</h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {contact.trade_category}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
                          <div className="flex items-center break-all">
                            <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span className="break-all">{contact.email}</span>
                          </div>
                          {contact.phone && (
                            <div className="flex items-center">
                              <Briefcase className="h-4 w-4 mr-2 flex-shrink-0" />
                              {contact.phone}
                            </div>
                          )}
                          {contact.company && (
                            <div className="flex items-center">
                              <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
                              {contact.company}
                            </div>
                          )}
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                            {contact.location}
                          </div>
                        </div>
                        {contact.notes && (
                          <p className="text-sm text-gray-600 mt-2">{contact.notes}</p>
                        )}
                      </div>
                      <div className="flex sm:flex-col items-center gap-2 sm:ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(contact)}
                          className="flex-1 sm:flex-none w-full sm:w-auto"
                        >
                          <Edit className="h-4 w-4 sm:mr-0" />
                          <span className="ml-2 sm:hidden">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(contact.id)}
                          className="text-red-600 hover:text-red-700 flex-1 sm:flex-none w-full sm:w-auto"
                        >
                          <Trash2 className="h-4 w-4 sm:mr-0" />
                          <span className="ml-2 sm:hidden">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
