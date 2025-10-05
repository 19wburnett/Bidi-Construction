'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Upload, FileText, CheckCircle, X as XIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface AcceptBidModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bid: {
    id: string
    subcontractor_name: string | null
    subcontractor_email: string
    bid_amount: number | null
  }
  jobRequestId: string
  onAcceptSuccess: () => void
}

interface Template {
  id: string
  template_type: string
  file_name: string
  file_url: string
}

interface UploadedFile {
  type: 'master_sub_agreement' | 'coi'
  fileName: string
  fileUrl: string
  file?: File
}

export default function AcceptBidModal({ 
  open, 
  onOpenChange, 
  bid, 
  jobRequestId,
  onAcceptSuccess 
}: AcceptBidModalProps) {
  const [step, setStep] = useState<'confirm' | 'documents'>('confirm')
  const [isLoading, setIsLoading] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [useTemplates, setUseTemplates] = useState(true)
  const supabase = createClient()

  // Fetch user templates when modal opens
  useEffect(() => {
    if (open) {
      fetchTemplates()
    }
  }, [open])

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')

    if (!error && data) {
      setTemplates(data)
      
      // If templates exist, pre-populate uploaded files
      if (data.length > 0 && useTemplates) {
        const templateFiles: UploadedFile[] = data.map(template => ({
          type: template.template_type as 'master_sub_agreement' | 'coi',
          fileName: template.file_name,
          fileUrl: template.file_url
        }))
        setUploadedFiles(templateFiles)
      }
    }
  }

  const handleFileChange = async (type: 'master_sub_agreement' | 'coi', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${jobRequestId}/${type}_${Date.now()}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('bid-documents')
        .upload(fileName, file)

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bid-documents')
        .getPublicUrl(fileName)

      // Update uploaded files
      setUploadedFiles(prev => {
        const filtered = prev.filter(f => f.type !== type)
        return [...filtered, {
          type,
          fileName: file.name,
          fileUrl: publicUrl,
          file
        }]
      })

    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const removeFile = (type: 'master_sub_agreement' | 'coi') => {
    setUploadedFiles(prev => prev.filter(f => f.type !== type))
  }

  const handleConfirm = () => {
    setStep('documents')
  }

  const handleAccept = async () => {
    setIsLoading(true)
    try {
      console.log('Sending accept bid request:', { bidId: bid.id, documentsCount: uploadedFiles.length })
      
      const response = await fetch('/api/bids/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bidId: bid.id,
          documents: uploadedFiles
        })
      })
      
      console.log('Response status:', response.status)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept bid')
      }

      onAcceptSuccess()
      onOpenChange(false)
      
      // Reset state
      setStep('confirm')
      setUploadedFiles([])
      
    } catch (error: any) {
      console.error('Error accepting bid:', error)
      alert(error.message || 'Failed to accept bid. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not specified'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const hasRequiredDocuments = uploadedFiles.some(f => f.type === 'master_sub_agreement') && 
                                uploadedFiles.some(f => f.type === 'coi')

  const masterSubFile = uploadedFiles.find(f => f.type === 'master_sub_agreement')
  const coiFile = uploadedFiles.find(f => f.type === 'coi')

  return (
    <Dialog open={open} onOpenChange={onOpenChange} >
      <DialogContent className="max-w-2xl">
        {step === 'confirm' ? (
          <>
            <DialogHeader className="border-b border-gray-200 p-4">
              <DialogTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span>Accept Bid?</span>
              </DialogTitle>
              <DialogDescription>
                This action will close the job request and decline all other bids.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <Label className="text-sm text-gray-600">Contractor</Label>
                  <p className="font-medium">{bid.subcontractor_name || bid.subcontractor_email}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Email</Label>
                  <p className="text-sm">{bid.subcontractor_email}</p>
                </div>
                {bid.bid_amount && (
                  <div>
                    <Label className="text-sm text-gray-600">Bid Amount</Label>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(bid.bid_amount)}</p>
                  </div>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">This will:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Accept this bid</li>
                      <li>Close the job request</li>
                      <li>Automatically decline all other pending bids</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-gray-200 p-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} className="bg-orange-600 hover:bg-orange-700">
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="border-b border-gray-200 p-4">
              <DialogTitle>Upload Required Documents</DialogTitle>
              <DialogDescription>
                Please upload the Master Subcontractor Agreement and Certificate of Insurance (COI) to complete the acceptance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 p-4">
              {templates.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">Templates Found!</p>
                      <p>Your saved templates will be used automatically.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Master Sub Agreement */}
              <div className="space-y-2">
                <Label htmlFor="master-sub" className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Master Subcontractor Agreement</span>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </Label>
                
                {masterSubFile ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-800">{masterSubFile.fileName}</span>
                    </div>
                    {!templates.some(t => t.template_type === 'master_sub_agreement') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile('master_sub_agreement')}
                        className="h-8 w-8 p-0"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Input
                      id="master-sub"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileChange('master_sub_agreement', e)}
                      disabled={isLoading}
                    />
                  </div>
                )}
              </div>

              {/* COI */}
              <div className="space-y-2">
                <Label htmlFor="coi" className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Certificate of Insurance (COI)</span>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </Label>
                
                {coiFile ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-800">{coiFile.fileName}</span>
                    </div>
                    {!templates.some(t => t.template_type === 'coi') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile('coi')}
                        className="h-8 w-8 p-0"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Input
                      id="coi"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileChange('coi', e)}
                      disabled={isLoading}
                    />
                  </div>
                )}
              </div>

              {!hasRequiredDocuments && (
                <p className="text-sm text-gray-600">
                  Both documents are required to accept the bid.
                </p>
              )}
            </div>

            <DialogFooter className="border-t border-gray-200 p-4">
              <Button variant="outline" onClick={() => setStep('confirm')} disabled={isLoading}>
                Back
              </Button>
              <Button 
                onClick={handleAccept} 
                disabled={!hasRequiredDocuments || isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? 'Processing...' : 'Accept Bid'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
