'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Hand, 
  MessageSquare, 
  Ruler, 
  Square, 
  Move, 
  MousePointer2 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type DrawingTool = 'comment' | 'none' | 'measurement_line' | 'measurement_area' | 'measurement_edit'

interface FloatingToolDockProps {
  selectedTool: DrawingTool
  onSelectTool: (tool: DrawingTool) => void
  isDrawingMeasurement: boolean
  onFinalizeMeasurement: () => void
}

export function FloatingToolDock({
  selectedTool,
  onSelectTool,
  isDrawingMeasurement,
  onFinalizeMeasurement
}: FloatingToolDockProps) {
  const tools = [
    {
      id: 'none',
      icon: Hand,
      label: 'Pan',
      shortcut: 'Space'
    },
    // {
    //   id: 'select', 
    //   icon: MousePointer2,
    //   label: 'Select',
    //   shortcut: 'V'
    // }, // 'none' currently handles pan, we might want a separate select mode if needed later
    {
      id: 'comment',
      icon: MessageSquare,
      label: 'Comment',
      shortcut: 'C'
    },
    {
      id: 'measurement_line',
      icon: Ruler,
      label: 'Measure Line',
      shortcut: 'M'
    },
    {
      id: 'measurement_area',
      icon: Square,
      label: 'Measure Area',
      shortcut: 'A'
    },
    {
      id: 'measurement_edit',
      icon: Move,
      label: 'Adjust',
      shortcut: 'E'
    }
  ] as const

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/90 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 shadow-xl rounded-full px-4 py-2 flex items-center gap-2"
      >
        <TooltipProvider delayDuration={300}>
          {tools.map((tool) => {
            const isSelected = selectedTool === tool.id
            const Icon = tool.icon

            return (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={isSelected ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => {
                      if (isDrawingMeasurement && selectedTool !== tool.id) {
                        onFinalizeMeasurement()
                      }
                      onSelectTool(tool.id as DrawingTool)
                    }}
                    className={cn(
                      "rounded-full w-10 h-10 transition-all duration-200",
                      isSelected 
                        ? "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black" 
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="sr-only">{tool.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={10}>
                  <p>{tool.label} <span className="text-gray-400 ml-1">({tool.shortcut})</span></p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </TooltipProvider>
      </motion.div>
    </div>
  )
}

