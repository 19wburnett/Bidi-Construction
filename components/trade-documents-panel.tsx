'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Plus,
  X,
  Loader2,
  FolderOpen
} from 'lucide-react'
import { TradeDocument } from '@/types/takeoff'
import { TRADE_CATEGORIES, getAllTrades } from '@/lib/trade-types'
import { createClient } from '@/lib/supabase'

interface TradeDocumentsPanelProps {
  jobId: string
  planId?: string | null
  tradeCategory?: string | null
  className?: string
}

const DOCUMENT_TYPES = [
  { value: 'sow', label: 'Statement of Work (SOW)' },
  { value: 'specification', label: 'Specification' },
  { value: 'addendum', label: 'Addendum' },
  { value: 'other', label: 'Other' }
] as const

export default function TradeDocumentsPanel({
  jobId,
  planId = null,
  tradeCategory = null,
  className = ''
}: TradeDocumentsPanelProps) {
  const [documents, setDocuments] = useState<TradeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<string>(tradeCategory || '')
  const [selectedDocType, setSelectedDocType] = useState<string>('sow')
  const [description, setDescription] = useState('')
  const [allTrades, setAllTrades] = useState<string[]>([...TRADE_CATEGORIES])
  const supabase = createClient()

  useEffect(() => {
    loadTrades()
    loadDocuments()
  }, [jobId, planId, tradeCategory])

  async function loadTrades() {
    try {
      const trades = await getAllTrades(supabase)
      setAllTrades(trades)
    } catch (error) {
      console.error('Error loading trades:', error)
    }
  }

  async function loadDocuments() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ job_id: jobId })
      if (planId) params.append('plan_id', planId)
      if (tradeCategory) params.append('trade_category', tradeCategory)

      const response = await fetch(`/api/trade-documents?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload() {
    if (!selectedFile || !selectedTrade || !selectedDocType) {
      alert('Please select a file, trade category, and document type')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('job_id', jobId)
      if (planId) formData.append('plan_id', planId)
      formData.append('trade_category', selectedTrade)
      formData.append('document_type', selectedDocType)
      if (description) formData.append('description', description)

      const response = await fetch('/api/trade-documents', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        await loadDocuments()
        setUploadDialogOpen(false)
        setSelectedFile(null)
        setDescription('')
        setSelectedDocType('sow')
      } else {
        throw new Error(data.error || 'Failed to upload document')
      }
    } catch (error: any) {
      console.error('Error uploading document:', error)
      alert(`Failed to upload document: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(documentId: string) {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      const response = await fetch(`/api/trade-documents/${documentId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await loadDocuments()
      } else {
        throw new Error(data.error || 'Failed to delete document')
      }
    } catch (error: any) {
      console.error('Error deleting document:', error)
      alert(`Failed to delete document: ${error.message}`)
    }
  }

  async function handleDownload(doc: TradeDocument) {
    try {
      const { data, error } = await supabase.storage
        .from('job-plans')
        .download(doc.file_path)

      if (error) throw error

      // Create a blob URL and trigger download
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error('Error downloading document:', error)
      alert(`Failed to download document: ${error.message}`)
    }
  }

  const documentsByTrade = useMemo(() => {
    const grouped: Record<string, TradeDocument[]> = {}
    documents.forEach(doc => {
      if (!grouped[doc.trade_category]) {
        grouped[doc.trade_category] = []
      }
      grouped[doc.trade_category].push(doc)
    })
    return grouped
  }, [documents])

  const filteredDocuments = useMemo(() => {
    if (tradeCategory) {
      return documents.filter(doc => doc.trade_category === tradeCategory)
    }
    return documents
  }, [documents, tradeCategory])

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Trade Documents
              </CardTitle>
              <CardDescription>
                {planId 
                  ? 'Documents linked to this plan'
                  : tradeCategory
                  ? `Documents for ${tradeCategory}`
                  : 'SOW and supporting documents by trade'}
              </CardDescription>
            </div>
            <Button
              onClick={() => setUploadDialogOpen(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Upload Document
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No documents uploaded yet</p>
              <Button
                onClick={() => setUploadDialogOpen(true)}
                variant="outline"
                size="sm"
                className="mt-4"
              >
                Upload Your First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(documentsByTrade).map(([trade, tradeDocs]) => (
                <div key={trade} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{trade}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {tradeDocs.length} document{tradeDocs.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {tradeDocs.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {doc.file_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type}
                              </Badge>
                              {doc.description && (
                                <span className="text-xs text-gray-500 truncate">
                                  {doc.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(doc.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Trade Document</DialogTitle>
            <DialogDescription>
              Upload a Statement of Work, specification, addendum, or other supporting document
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 px-4">
            <div>
              <Label htmlFor="file">File *</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="mt-1"
                accept=".pdf,.doc,.docx,.txt"
              />
            </div>
            <div>
              <Label htmlFor="trade">Trade Category *</Label>
              <Select
                value={selectedTrade}
                onValueChange={setSelectedTrade}
                disabled={!!tradeCategory}
              >
                <SelectTrigger id="trade" className="mt-1">
                  <SelectValue placeholder="Select trade category" />
                </SelectTrigger>
                <SelectContent>
                  {allTrades.map(trade => (
                    <SelectItem key={trade} value={trade}>
                      {trade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="docType">Document Type *</Label>
              <Select
                value={selectedDocType}
                onValueChange={setSelectedDocType}
              >
                <SelectTrigger id="docType" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for this document..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !selectedTrade}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
