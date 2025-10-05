'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Lightbulb, 
  Package, 
  MapPin,
  MessageSquare,
  Edit
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
  onAnnotatePlans?: () => void
  hasPlans?: boolean
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

export default function BidNotesDisplay({ notes, bidId, onAnnotatePlans, hasPlans }: BidNotesDisplayProps) {
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
      {/* Header with Annotate Button - Outside Accordion */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center">
          <MessageSquare className="h-4 w-4 mr-2" />
          <h4 className="font-medium text-sm">
            Bid Notes ({notes.length})
          </h4>
        </div>
        {hasPlans && onAnnotatePlans && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAnnotatePlans}
            className="h-8 text-orange-600 border-orange-600 hover:bg-orange-50"
          >
            <Edit className="h-3 w-3 mr-1" />
            Annotate Plans
          </Button>
        )}
      </div>

      {/* Parent Accordion for Categorized Notes */}
      <Accordion type="single" collapsible className="w-full" defaultValue="categorized-notes">
        <AccordionItem value="categorized-notes" className="border-none">
          <AccordionTrigger className="hover:no-underline py-2 text-sm text-gray-600">
            <span>View Notes by Category</span>
          </AccordionTrigger>
          <AccordionContent>
            {/* Nested Accordion for Note Types */}
            <Accordion type="multiple" className="w-full">
              {Object.entries(notesByType).map(([type, typeNotes]) => {
                const config = noteTypeConfig[type as keyof typeof noteTypeConfig]
                const Icon = config.icon
                
                return (
                  <AccordionItem key={type} value={type}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium text-gray-700">
                          {config.label} ({typeNotes.length})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
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
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
