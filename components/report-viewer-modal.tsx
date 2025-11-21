'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Download, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface ReportViewerModalProps {
  report: {
    id: string
    title: string | null
    file_name: string
    file_path: string
  } | null
  isOpen: boolean
  onClose: () => void
}

export default function ReportViewerModal({ report, isOpen, onClose }: ReportViewerModalProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && report) {
      loadReportUrl()
    } else {
      setUrl(null)
      setError(null)
    }
  }, [isOpen, report])

  async function loadReportUrl() {
    if (!report) return

    setLoading(true)
    setError(null)
    try {
      // Try to get a signed URL first (valid for 1 hour)
      const { data, error } = await supabase.storage
        .from('job-plans') // Using job-plans bucket as decided
        .createSignedUrl(report.file_path, 3600)

      if (error) throw error
      if (data?.signedUrl) {
        setUrl(data.signedUrl)
      }
    } catch (err) {
      console.error('Error loading report URL:', err)
      setError('Failed to load report file.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[85vw] h-[85vh] max-w-none flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-lg truncate flex-1 pr-4">
            {report?.title || report?.file_name || 'Report Viewer'}
          </DialogTitle>
          <div className="flex items-center gap-2">
            {url && (
              <Button variant="outline" size="sm" asChild>
                <a href={url} download={report?.file_name} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-gray-100 relative overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center text-red-500">
              {error}
            </div>
          ) : url ? (
            <iframe
              src={url}
              className="w-full h-full border-none"
              title={report?.file_name}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

