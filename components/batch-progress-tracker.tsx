'use client'

import React from 'react'

interface BatchProgressTrackerProps {
  totalBatches: number
  completedBatches: number
  currentBatch: number
  isProcessing: boolean
  processingTime?: number
}

export function BatchProgressTracker({
  totalBatches,
  completedBatches,
  currentBatch,
  isProcessing,
  processingTime
}: BatchProgressTrackerProps) {
  const progressPercentage = totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Enhanced AI Analysis Progress
        </h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">
            {isProcessing ? 'Processing...' : 'Complete'}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Batch {completedBatches} of {totalBatches}</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Batch Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{completedBatches}</div>
          <div className="text-sm text-gray-600">Batches Complete</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{totalBatches - completedBatches}</div>
          <div className="text-sm text-gray-600">Batches Remaining</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {processingTime ? `${Math.round(processingTime / 1000)}s` : '--'}
          </div>
          <div className="text-sm text-gray-600">Processing Time</div>
        </div>
      </div>

      {/* Current Batch Status */}
      {isProcessing && currentBatch > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-blue-800">
              Currently processing batch {currentBatch} of {totalBatches}
            </span>
          </div>
        </div>
      )}

      {/* Completion Message */}
      {!isProcessing && completedBatches === totalBatches && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-green-800">
              All batches processed successfully! Merging results...
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

interface BatchProgressModalProps {
  isOpen: boolean
  onClose: () => void
  totalBatches: number
  completedBatches: number
  currentBatch: number
  isProcessing: boolean
  processingTime?: number
}

export function BatchProgressModal({
  isOpen,
  onClose,
  totalBatches,
  completedBatches,
  currentBatch,
  isProcessing,
  processingTime
}: BatchProgressModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Enhanced AI Analysis
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isProcessing}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <BatchProgressTracker
            totalBatches={totalBatches}
            completedBatches={completedBatches}
            currentBatch={currentBatch}
            isProcessing={isProcessing}
            processingTime={processingTime}
          />

          {!isProcessing && completedBatches === totalBatches && (
            <div className="mt-4">
              <button
                onClick={onClose}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Results
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
