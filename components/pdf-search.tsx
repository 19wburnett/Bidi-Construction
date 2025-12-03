'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'

interface PDFSearchProps {
  onSearch: (query: string) => void
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
  matchCount: number
  currentMatch: number
  isOpen: boolean
}

export default function PDFSearch({
  onSearch,
  onNext,
  onPrevious,
  onClose,
  matchCount,
  currentMatch,
  isOpen
}: PDFSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when search opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    onSearch(query)
  }, [onSearch])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          onPrevious()
        } else {
          onNext()
        }
      } else if (e.key === 'F3') {
        if (e.shiftKey) {
          onPrevious()
        } else {
          onNext()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onNext, onPrevious, onClose])

  if (!isOpen) return null

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-white border border-gray-300 rounded-lg shadow-xl p-2 flex items-center gap-2 min-w-[400px]">
      <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <Input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={handleSearchChange}
        placeholder="Search in PDF..."
        className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-8"
      />
      {searchQuery && (
        <>
          <div className="flex items-center gap-1 text-sm text-gray-500 flex-shrink-0">
            <span>
              {matchCount > 0 ? `${currentMatch} / ${matchCount}` : '0 results'}
            </span>
          </div>
          <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevious}
              disabled={matchCount === 0}
              className="h-7 w-7"
              title="Previous (Shift+Enter)"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={matchCount === 0}
              className="h-7 w-7"
              title="Next (Enter)"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="h-7 w-7"
        title="Close (Esc)"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}



