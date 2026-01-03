'use client'

import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface BidLineItem {
  id: string
  is_optional?: boolean | null
  option_group?: string | null
}

interface BidOptionsIndicatorProps {
  lineItems: BidLineItem[]
}

export default function BidOptionsIndicator({ lineItems }: BidOptionsIndicatorProps) {
  if (!lineItems || lineItems.length === 0) {
    return null
  }

  const optionalItems = lineItems.filter(item => item.is_optional)
  if (optionalItems.length === 0) {
    return null
  }

  // Group by option_group
  const optionGroups = optionalItems.reduce((acc, item) => {
    const group = item.option_group || 'Other Options'
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(item)
    return acc
  }, {} as Record<string, BidLineItem[]>)

  const groupNames = Object.keys(optionGroups)
  const totalOptions = optionalItems.length

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 border-orange-300 cursor-help"
          >
            <Info className="h-3 w-3 mr-1" />
            {totalOptions} {totalOptions === 1 ? 'Option' : 'Options'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold text-sm">Optional Items Available:</div>
            {groupNames.map((groupName) => (
              <div key={groupName} className="text-xs">
                <span className="font-medium">{groupName}:</span>{' '}
                {optionGroups[groupName].length} {optionGroups[groupName].length === 1 ? 'item' : 'items'}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
