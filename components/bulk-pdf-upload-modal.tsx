'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Upload, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  X,
  FileText,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BulkPdfUploadModalProps {
  jobId: string
  isOpen: boolean
  onClose: () => void
  onBidsCreated: () => void
}

interface ParsedLineItem {
  description: string
  category: 'labor' | 'materials' | 'equipment' | 'permits' | 'other' | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  amount: number
  notes: string | null
}

interface ParsedInvoiceData {
  company: {
    name: string | null
    email: string | null
    phone: string | null
    address: string | null
  }
  jobReference: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  lineItems: ParsedLineItem[]
  subtotal: number | null
  tax: number | null
  total: number
  timeline: string | null
  notes: string | null
  paymentTerms: string | null
}

interface FileProcessingStatus {
  file: File
  status: 'pending' | 'uploading' | 'parsing' | 'success' | 'error'
  parsedData: ParsedInvoiceData | null
  error: string | null
  subcontractorId: string | null
  contactId: string | null
  createNewSub: boolean
  newSubName: string
  newSubEmail: string
  newSubTrade: string
}

interface Subcontractor {
  id: string
  name: string
  email: string
}

interface Contact {
  id: string
  name: string
  email: string
  trade_category: string
}

export default function BulkPdfUploadModal({ 
  jobId, 
  isOpen, 
  onClose, 
  onBidsCreated 
}: BulkPdfUploadModalProps) {
  const { user } = useAuth()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [processingFiles, setProcessingFiles] = useState<FileProcessingStatus[]>([])
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState(0)

  const loadSubcontractors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('id, name, email')
        .order('name', { ascending: true })

      if (error) throw error
      setSubcontractors(data || [])
    } catch (err) {
      console.error('Error loading subcontractors:', err)
    }
  }, [supabase])

  const loadContacts = useCallback(async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('gc_contacts')
        .select('id, name, email, trade_category')
        .eq('gc_id', user.id)
        .order('name', { ascending: true })

      if (error) throw error
      setContacts(data || [])
    } catch (err) {
      console.error('Error loading contacts:', err)
    }
  }, [supabase, user])

  // Load subcontractors and contacts when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadSubcontractors()
      loadContacts()
    }
  }, [isOpen, user, loadSubcontractors, loadContacts])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const pdfFiles = Array.from(e.dataTransfer.files).filter(
        file => file.type === 'application/pdf'
      )
      if (pdfFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...pdfFiles])
        setError(null)
      } else {
        setError('Please upload PDF files only')
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const pdfFiles = Array.from(e.target.files).filter(
        file => file.type === 'application/pdf'
      )
      if (pdfFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...pdfFiles])
        setError(null)
      } else {
        setError('Please upload PDF files only')
      }
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setProcessingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const processFiles = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one PDF file')
      return
    }

    setIsProcessing(true)
    setError(null)
    setSuccessCount(0)

    // Initialize processing status for all files
    const initialStatuses: FileProcessingStatus[] = selectedFiles.map(file => ({
      file,
      status: 'pending',
      parsedData: null,
      error: null,
      subcontractorId: null,
      contactId: null,
      createNewSub: false,
      newSubName: '',
      newSubEmail: '',
      newSubTrade: ''
    }))

    setProcessingFiles(initialStatuses)

    // Process files sequentially to avoid overwhelming the API
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      
      // Update status to uploading
      setProcessingFiles(prev => {
        const updated = [...prev]
        updated[i] = { ...updated[i], status: 'uploading' }
        return updated
      })

      try {
        // Parse the PDF
        setProcessingFiles(prev => {
          const updated = [...prev]
          updated[i] = { ...updated[i], status: 'parsing' }
          return updated
        })

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/parse-invoice', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to parse PDF')
        }

        const parsedData: ParsedInvoiceData = result.data

        // Try to match subcontractor or contact
        let subcontractorId: string | null = null
        let contactId: string | null = null
        let createNewSub = false
        let newSubName = ''
        let newSubEmail = ''

        if (parsedData.company?.name) {
          const matchedSub = subcontractors.find(sub => 
            sub.name.toLowerCase().includes(parsedData.company.name!.toLowerCase()) ||
            parsedData.company.name!.toLowerCase().includes(sub.name.toLowerCase())
          )
          
          if (matchedSub) {
            subcontractorId = matchedSub.id
          } else {
            const matchedContact = contacts.find(contact =>
              contact.name.toLowerCase().includes(parsedData.company.name!.toLowerCase()) ||
              parsedData.company.name!.toLowerCase().includes(contact.name.toLowerCase())
            )
            
            if (matchedContact) {
              contactId = matchedContact.id
            } else {
              createNewSub = true
              newSubName = parsedData.company.name
              newSubEmail = parsedData.company.email || ''
            }
          }
        }

        // Update status to success
        setProcessingFiles(prev => {
          const updated = [...prev]
          updated[i] = {
            ...updated[i],
            status: 'success',
            parsedData,
            subcontractorId,
            contactId,
            createNewSub,
            newSubName,
            newSubEmail,
            newSubTrade: ''
          }
          return updated
        })

        setSuccessCount(prev => prev + 1)
      } catch (err: any) {
        console.error(`Error processing file ${file.name}:`, err)
        setProcessingFiles(prev => {
          const updated = [...prev]
          updated[i] = {
            ...updated[i],
            status: 'error',
            error: err.message || 'Failed to parse PDF'
          }
          return updated
        })
      }
    }

    setIsProcessing(false)
  }

  const updateFileStatus = (index: number, updates: Partial<FileProcessingStatus>) => {
    setProcessingFiles(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], ...updates }
      return updated
    })
  }

  const saveAllBids = async () => {
    if (!user) return

    const filesToSave = processingFiles.filter(f => f.status === 'success' && f.parsedData)
    
    if (filesToSave.length === 0) {
      setError('No successfully parsed files to save')
      return
    }

    // Validate that each file has a subcontractor or contact selected, or is set to create new
    const invalidFiles = filesToSave.filter(f => 
      !f.subcontractorId && !f.contactId && (!f.createNewSub || !f.newSubName.trim())
    )

    if (invalidFiles.length > 0) {
      setError(`Please select or create a subcontractor for all ${invalidFiles.length} file${invalidFiles.length !== 1 ? 's' : ''}`)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      let savedCount = 0

      for (const fileStatus of filesToSave) {
        if (!fileStatus.parsedData) continue

        try {
          let subcontractorId = fileStatus.subcontractorId || null
          let contactId = fileStatus.contactId || null

          // Create new subcontractor if needed
          if (fileStatus.createNewSub && fileStatus.newSubName) {
            const { data: newSub, error: subError } = await supabase
              .from('subcontractors')
              .insert({
                name: fileStatus.newSubName,
                email: fileStatus.newSubEmail || null,
                trade_category: fileStatus.newSubTrade || 'General',
              })
              .select()
              .single()

            if (subError) throw subError
            subcontractorId = newSub.id
            // Refresh subcontractors list
            await loadSubcontractors()
          }

          // Create the bid
          const { data: bidData, error: bidError } = await supabase
            .from('bids')
            .insert({
              job_id: jobId,
              subcontractor_id: subcontractorId,
              contact_id: contactId,
              bid_amount: null, // Will be calculated from line items by trigger
              timeline: fileStatus.parsedData.timeline || null,
              notes: fileStatus.parsedData.notes || null,
              status: 'pending',
              raw_email: `Parsed from PDF: ${fileStatus.file.name}`,
            })
            .select()
            .single()

          if (bidError) throw bidError

          // Create line items
          const lineItemsToInsert = fileStatus.parsedData.lineItems
            .filter(item => item.description.trim() !== '')
            .map((item, index) => ({
              bid_id: bidData.id,
              item_number: index + 1,
              description: item.description,
              category: item.category || null,
              quantity: item.quantity || null,
              unit: item.unit || null,
              unit_price: item.unitPrice || null,
              amount: item.amount,
              notes: item.notes || null,
            }))

          if (lineItemsToInsert.length > 0) {
            const { error: lineItemsError } = await supabase
              .from('bid_line_items')
              .insert(lineItemsToInsert)

            if (lineItemsError) throw lineItemsError
          }

          // Upload the PDF as an attachment
          if (bidData.id && user) {
            const fileExt = fileStatus.file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = `${user.id}/${fileName}`

            const { error: uploadError } = await supabase.storage
              .from('bid-attachments')
              .upload(filePath, fileStatus.file)

            if (!uploadError) {
              await supabase
                .from('bid_attachments')
                .insert({
                  bid_id: bidData.id,
                  file_name: fileStatus.file.name,
                  file_path: filePath,
                  file_size: fileStatus.file.size,
                  file_type: fileStatus.file.type
                })
            }
          }

          savedCount++
        } catch (err: any) {
          console.error(`Error saving bid for ${fileStatus.file.name}:`, err)
          // Continue with other files even if one fails
        }
      }

      if (savedCount > 0) {
        onBidsCreated()
        handleClose()
      } else {
        setError('Failed to save all bids. Please try again.')
      }
    } catch (err: any) {
      console.error('Error saving bids:', err)
      setError(err.message || 'Failed to save bids')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setSelectedFiles([])
    setProcessingFiles([])
    setError(null)
    setSuccessCount(0)
    setIsProcessing(false)
    setIsSaving(false)
    onClose()
  }

  const allFilesProcessed = processingFiles.length > 0 && processingFiles.every(f => 
    f.status === 'success' || f.status === 'error'
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-6 relative">
        <DialogClose onClick={handleClose} className="absolute right-4 top-4" />
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-600" />
            Upload PDF Bids (Bulk)
          </DialogTitle>
          <DialogDescription>
            Upload multiple PDF invoices or bids. Each PDF will be parsed and created as a separate bid.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-1">
          {/* Upload Zone - Show when no files selected or before processing */}
          {selectedFiles.length === 0 && !isProcessing && (
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
                dragActive 
                  ? "border-orange-500 bg-orange-50" 
                  : "border-gray-300 hover:border-orange-400 hover:bg-gray-50"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Upload className={cn(
                "h-12 w-12 mx-auto mb-3",
                dragActive ? "text-orange-500" : "text-gray-400"
              )} />
              <p className="font-medium text-gray-700 mb-1">
                {dragActive ? 'Drop PDFs here' : 'Drop PDFs here or click to upload'}
              </p>
              <p className="text-sm text-gray-500">
                Select multiple PDF files to upload at once
              </p>
            </div>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && !isProcessing && processingFiles.length === 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({selectedFiles.length})</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button onClick={processFiles} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Parse {selectedFiles.length} PDF{selectedFiles.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}

          {/* Processing Status */}
          {isProcessing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Processing Files...</Label>
                <span className="text-sm text-gray-500">
                  {processingFiles.filter(f => f.status === 'success' || f.status === 'error').length} / {processingFiles.length}
                </span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                {processingFiles.map((fileStatus, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{fileStatus.file.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {fileStatus.status === 'uploading' || fileStatus.status === 'parsing' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                      ) : fileStatus.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : fileStatus.status === 'error' ? (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      ) : null}
                      {fileStatus.status === 'pending' && (
                        <span className="text-xs text-gray-500">Waiting...</span>
                      )}
                      {fileStatus.status === 'uploading' && (
                        <span className="text-xs text-gray-500">Uploading...</span>
                      )}
                      {fileStatus.status === 'parsing' && (
                        <span className="text-xs text-gray-500">Parsing...</span>
                      )}
                      {fileStatus.status === 'success' && (
                        <span className="text-xs text-green-600">Success</span>
                      )}
                      {fileStatus.status === 'error' && (
                        <span className="text-xs text-red-600" title={fileStatus.error || ''}>
                          Error
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processed Files - Edit and Save */}
          {allFilesProcessed && processingFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      {successCount} of {processingFiles.length} PDF{processingFiles.length !== 1 ? 's' : ''} parsed successfully
                    </p>
                    <p className="text-sm text-green-600">
                      Review and configure each bid before saving
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-3">
                {processingFiles.map((fileStatus, index) => {
                  if (fileStatus.status !== 'success' || !fileStatus.parsedData) return null

                  return (
                    <div key={index} className="p-4 border rounded-lg bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-sm">{fileStatus.file.name}</span>
                        </div>
                        {fileStatus.error && (
                          <span className="text-xs text-red-600">{fileStatus.error}</span>
                        )}
                      </div>

                      {fileStatus.parsedData.company?.name && (
                        <div className="text-sm">
                          <Label className="text-xs text-gray-500">Company</Label>
                          <p className="font-medium">{fileStatus.parsedData.company.name}</p>
                          {fileStatus.parsedData.company.email && (
                            <p className="text-gray-600">{fileStatus.parsedData.company.email}</p>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-xs">Subcontractor *</Label>
                        {fileStatus.createNewSub ? (
                          <div className="space-y-2">
                            <Input
                              value={fileStatus.newSubName}
                              onChange={(e) => updateFileStatus(index, { newSubName: e.target.value })}
                              placeholder="Subcontractor name"
                              className="text-sm"
                            />
                            <Input
                              value={fileStatus.newSubEmail}
                              onChange={(e) => updateFileStatus(index, { newSubEmail: e.target.value })}
                              placeholder="Email (optional)"
                              className="text-sm"
                            />
                            <Input
                              value={fileStatus.newSubTrade}
                              onChange={(e) => updateFileStatus(index, { newSubTrade: e.target.value })}
                              placeholder="Trade category (optional)"
                              className="text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateFileStatus(index, { createNewSub: false })}
                              className="w-full"
                            >
                              Select Existing Instead
                            </Button>
                          </div>
                        ) : (
                          <Select
                            value={fileStatus.subcontractorId || fileStatus.contactId || ''}
                            onValueChange={(value) => {
                              const isSub = subcontractors.some(s => s.id === value)
                              if (isSub) {
                                updateFileStatus(index, { subcontractorId: value, contactId: null })
                              } else {
                                updateFileStatus(index, { contactId: value, subcontractorId: null })
                              }
                            }}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Select subcontractor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {subcontractors.length > 0 && (
                                <>
                                  <SelectItem value="__header_subs" disabled className="font-semibold text-gray-500">
                                    Subcontractors
                                  </SelectItem>
                                  {subcontractors.map(sub => (
                                    <SelectItem key={sub.id} value={sub.id}>
                                      {sub.name} {sub.email && <span className="text-gray-400 text-xs">({sub.email})</span>}
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                              {contacts.length > 0 && (
                                <>
                                  <SelectItem value="__header_contacts" disabled className="font-semibold text-gray-500 mt-2">
                                    Your Contacts
                                  </SelectItem>
                                  {contacts.map(contact => (
                                    <SelectItem key={contact.id} value={contact.id}>
                                      {contact.name} {contact.email && <span className="text-gray-400 text-xs">({contact.email})</span>}
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                        {!fileStatus.createNewSub && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateFileStatus(index, { 
                              createNewSub: true,
                              newSubName: fileStatus.parsedData?.company?.name || '',
                              newSubEmail: fileStatus.parsedData?.company?.email || ''
                            })}
                            className="w-full"
                          >
                            Create New Subcontractor
                          </Button>
                        )}
                      </div>

                      <div className="text-sm">
                        <Label className="text-xs text-gray-500">Line Items</Label>
                        <p className="text-gray-600">{fileStatus.parsedData.lineItems.length} items</p>
                        {fileStatus.parsedData.total && (
                          <p className="font-medium text-green-600">
                            Total: ${fileStatus.parsedData.total.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {allFilesProcessed && successCount > 0 && (
            <Button onClick={saveAllBids} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                `Save ${successCount} Bid${successCount !== 1 ? 's' : ''}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

