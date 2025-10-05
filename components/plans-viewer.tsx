'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Download, Eye, Users, Building2, Edit } from 'lucide-react'
import PlanAnnotatorModal from './plan-annotator-modal'

interface BidNote {
  id: string
  note_type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
  category: string | null
  location: string | null
  content: string
  confidence_score: number
  created_at: string
}

interface Bid {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  subcontractor_name?: string | null
  subcontractor_email?: string
  bid_notes?: BidNote[]
}

interface PlansViewerProps {
  jobRequestId: string
  planFiles: string[]
  bids: Bid[]
}

export default function PlansViewer({ jobRequestId, planFiles, bids }: PlansViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [annotatorOpen, setAnnotatorOpen] = useState(false)
  const [annotatorPlanFile, setAnnotatorPlanFile] = useState<string>('')

  const handleFileSelect = (fileUrl: string) => {
    setSelectedFile(fileUrl)
  }

  const handleDownload = (fileUrl: string) => {
    // Create a temporary link to download the file
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileUrl.split('/').pop() || 'plan-file'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenAnnotator = (fileUrl: string) => {
    setAnnotatorPlanFile(fileUrl)
    setAnnotatorOpen(true)
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-orange-600" />
            <CardTitle>Project Plans</CardTitle>
          </div>
          <Badge variant="secondary">
            {planFiles.length} {planFiles.length === 1 ? 'Plan' : 'Plans'}
          </Badge>
        </div>
        <CardDescription>
          View and download project plans. Share with subcontractors for accurate bidding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Plan Files List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {planFiles.map((fileUrl, index) => (
              <div
                key={index}
                className="border rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleFileSelect(fileUrl)}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-orange-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Plan {index + 1}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {fileUrl.split('/').pop()}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenAnnotator(fileUrl)
                      }}
                      className="h-8 w-8 p-0"
                      title="Annotate with bidder notes"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFileSelect(fileUrl)
                      }}
                      className="h-8 w-8 p-0"
                      title="Quick view"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(fileUrl)
                      }}
                      className="h-8 w-8 p-0"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Selected File Viewer */}
          {selectedFile && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Viewing Plan</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  Close
                </Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {selectedFile.split('/').pop()}
                  </span>
                </div>
                <div className="bg-white rounded border p-4">
                  <iframe
                    src={selectedFile}
                    className="w-full h-96 border-0 rounded"
                    title="Plan Viewer"
                    onError={() => {
                      // Fallback for files that can't be displayed in iframe
                      console.log('File cannot be displayed in iframe, showing download link')
                    }}
                  />
                </div>
                <div className="flex justify-center">
                  <Button
                    onClick={() => handleDownload(selectedFile)}
                    className="flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Plan</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Plan Annotator Modal */}
      {annotatorPlanFile && (
        <PlanAnnotatorModal
          open={annotatorOpen}
          onOpenChange={setAnnotatorOpen}
          planFile={annotatorPlanFile}
          planFileName={annotatorPlanFile.split('/').pop() || 'Plan'}
          bids={bids.map(bid => ({
            id: bid.id,
            subcontractor_name: bid.subcontractor_name || bid.company_name,
            subcontractor_email: bid.subcontractor_email || bid.email,
            bid_notes: bid.bid_notes || []
          }))}
          jobRequestId={jobRequestId}
        />
      )}
    </Card>
  )
}
