'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Lightbulb, 
  Package, 
  MapPin,
  MessageSquare
} from 'lucide-react'

interface BidNote {
  id: string
  note_type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
  category: string | null
  location: string | null
  content: string
  confidence_score: number
  created_at: string
}

interface BidNotesDisplayProps {
  notes: BidNote[]
  bidId: string
}

const noteTypeConfig = {
  requirement: {
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 border-green-200',
    label: 'Requirement'
  },
  concern: {
    icon: AlertTriangle,
    color: 'bg-red-100 text-red-800 border-red-200',
    label: 'Concern'
  },
  suggestion: {
    icon: Lightbulb,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    label: 'Suggestion'
  },
  timeline: {
    icon: Clock,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    label: 'Timeline'
  },
  material: {
    icon: Package,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    label: 'Material'
  },
  other: {
    icon: MessageSquare,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    label: 'Other'
  }
}

const categoryColors = {
  shower: 'bg-blue-50 text-blue-700',
  electrical: 'bg-yellow-50 text-yellow-700',
  plumbing: 'bg-blue-50 text-blue-700',
  flooring: 'bg-amber-50 text-amber-700',
  kitchen: 'bg-orange-50 text-orange-700',
  bathroom: 'bg-cyan-50 text-cyan-700',
  structural: 'bg-red-50 text-red-700',
  safety: 'bg-red-50 text-red-700',
  permit: 'bg-green-50 text-green-700',
  other: 'bg-gray-50 text-gray-700'
}

export default function BidNotesDisplay({ notes, bidId }: BidNotesDisplayProps) {
  if (!notes || notes.length === 0) {
    return null
  }

  // Group notes by type for better organization
  const notesByType = notes.reduce((acc, note) => {
    if (!acc[note.note_type]) {
      acc[note.note_type] = []
    }
    acc[note.note_type].push(note)
    return acc
  }, {} as Record<string, BidNote[]>)

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm mb-3 flex items-center">
        <MessageSquare className="h-4 w-4 mr-2" />
        Categorized Notes ({notes.length})
      </h4>
      
      {Object.entries(notesByType).map(([type, typeNotes]) => {
        const config = noteTypeConfig[type as keyof typeof noteTypeConfig]
        const Icon = config.icon
        
        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium text-gray-700">
                {config.label} ({typeNotes.length})
              </span>
            </div>
            
            <div className="space-y-2">
              {typeNotes.map((note) => (
                <Card key={note.id} className="border-l-4 border-l-gray-200">
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <p className="text-sm text-gray-800">{note.content}</p>
                      
                      <div className="flex flex-wrap gap-2">
                        {note.category && (
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${categoryColors[note.category as keyof typeof categoryColors] || categoryColors.other}`}
                          >
                            {note.category}
                          </Badge>
                        )}
                        
                        {note.location && (
                          <Badge variant="outline" className="text-xs flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {note.location.replace('_', ' ')}
                          </Badge>
                        )}
                        
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${config.color}`}
                        >
                          {Math.round(note.confidence_score * 100)}% confidence
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
