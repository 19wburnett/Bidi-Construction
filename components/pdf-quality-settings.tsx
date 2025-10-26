'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Settings, 
  Zap, 
  Eye, 
  Monitor,
  ChevronDown
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export type QualityMode = 'performance' | 'balanced' | 'quality'

interface PdfQualitySettingsProps {
  qualityMode: QualityMode
  onQualityModeChange: (mode: QualityMode) => void
  onClearCache: () => void
  useSvgRendering?: boolean
  onSvgRenderingChange?: (useSvg: boolean) => void
}

const qualityModes = {
  performance: {
    label: 'Performance',
    description: 'Fast loading, lower resolution',
    icon: Zap,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  balanced: {
    label: 'Balanced',
    description: 'Good quality with reasonable performance',
    icon: Monitor,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  quality: {
    label: 'Quality',
    description: 'High resolution, slower loading',
    icon: Eye,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  }
}

export default function PdfQualitySettings({
  qualityMode,
  onQualityModeChange,
  onClearCache,
  useSvgRendering = true,
  onSvgRenderingChange
}: PdfQualitySettingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentMode = qualityModes[qualityMode]
  const IconComponent = currentMode.icon

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1"
      >
        <Settings className="h-4 w-4" />
        <span className="text-xs">Quality</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
          >
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">PDF Quality Settings</h3>
              
              <div className="space-y-2 mb-4">
                {Object.entries(qualityModes).map(([mode, config]) => {
                  const Icon = config.icon
                  const isSelected = mode === qualityMode
                  
                  return (
                    <button
                      key={mode}
                      onClick={() => {
                        onQualityModeChange(mode as QualityMode)
                        setIsOpen(false)
                      }}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        isSelected 
                          ? `${config.bgColor} ${config.borderColor} border-2` 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-4 w-4 ${isSelected ? config.color : 'text-gray-500'}`} />
                        <div>
                          <div className={`font-medium ${isSelected ? config.color : 'text-gray-900'}`}>
                            {config.label}
                          </div>
                          <div className="text-xs text-gray-600">
                            {config.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="border-t border-gray-200 pt-3">
                {/* SVG Rendering Toggle */}
                {onSvgRenderingChange && (
                  <div className="mb-3">
                    <label className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={useSvgRendering}
                        onChange={(e) => onSvgRenderingChange(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700">Vector Rendering (SVG)</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Perfect quality at any zoom level
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClearCache()
                    setIsOpen(false)
                  }}
                  className="w-full text-xs"
                >
                  Clear Cache
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Clear cached PDF pages to free memory
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
