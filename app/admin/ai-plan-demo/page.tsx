'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, CheckCircle2, Loader2, Sparkles, FileText, ArrowRight, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import logo from '../../../public/brand/Bidi Contracting Logo.svg'

type Step = 1 | 2 | 3

interface Trade {
  id: string
  name: string
  icon: string
}

interface AIAnalysisResult {
  trade: string
  bidAmount: string
  estimatedTimeline: string
  materials: string[]
  labor: string
  potentialIssues: string[]
  recommendations: string[]
  confidence: number
}

const AVAILABLE_TRADES: Trade[] = [
  { id: 'electrical', name: 'Electrical', icon: '⚡' },
  { id: 'plumbing', name: 'Plumbing', icon: '🔧' },
  { id: 'framing', name: 'Framing', icon: '🏗️' },
  { id: 'concrete', name: 'Concrete', icon: '🧱' },
  { id: 'drywall', name: 'Drywall', icon: '🔨' },
  { id: 'roofing', name: 'Roofing', icon: '🏠' },
  { id: 'hvac', name: 'HVAC', icon: '❄️' },
  { id: 'flooring', name: 'Flooring', icon: '📐' },
]


export default function AIPlanDemoPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedTrades, setSelectedTrades] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<AIAnalysisResult[]>([])
  const [extractedText, setExtractedText] = useState<string>('')
  const [visionEnabled, setVisionEnabled] = useState(false)
  const [imagesAnalyzed, setImagesAnalyzed] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    checkAdminStatus()
  }, [user, authLoading, router])

  const checkAdminStatus = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error checking admin status:', error)
        return
      }

      if (!data?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
    } catch (err) {
      console.error('Error checking admin status:', err)
    }
  }

  // Step 1: Handle File Upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file)
      simulateUpload()
    }
  }

  const simulateUpload = () => {
    setIsUploading(true)
    setUploadProgress(0)
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsUploading(false)
          return 100
        }
        return prev + 10
      })
    }, 150)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Step 2: Handle Trade Selection
  const toggleTrade = (tradeId: string) => {
    setSelectedTrades(prev => 
      prev.includes(tradeId) 
        ? prev.filter(id => id !== tradeId)
        : [...prev, tradeId]
    )
  }

  // Step 3: Handle AI Analysis
  const runAIAnalysis = async () => {
    if (!uploadedFile) {
      console.error('No file uploaded')
      return
    }

    setIsAnalyzing(true)
    
    try {
      // Create FormData with file and selected trades
      const formData = new FormData()
      formData.append('file', uploadedFile)
      
      // Map trade IDs to trade names for the API
      const tradeNames = selectedTrades.map(tradeId => {
        const trade = AVAILABLE_TRADES.find(t => t.id === tradeId)
        return trade?.name || tradeId
      })
      formData.append('trades', JSON.stringify(tradeNames))

      // Call the AI analysis API
      const response = await fetch('/api/ai-plan-analysis', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze plan')
      }

      const data = await response.json()
      
      if (data.success && data.analyses) {
        setAnalysisResults(data.analyses)
        // Store debug info for transparency
        if (data.debug) {
          setVisionEnabled(data.debug.visionEnabled || false)
          setImagesAnalyzed(data.debug.imagesAnalyzed || 0)
          setExtractedText(data.debug.imageUrlsPreview || data.debug.extractedTextPreview || '')
        }
      } else {
        throw new Error('Invalid response from analysis API')
      }
    } catch (error: any) {
      console.error('Error analyzing plan:', error)
      alert(`Analysis failed: ${error.message}. Please try again.`)
      setIsAnalyzing(false)
      // Don't proceed to step 3 if there's an error
      setCurrentStep(2)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Navigation
  const goToNextStep = () => {
    if (currentStep === 2) {
      runAIAnalysis()
    }
    setCurrentStep(prev => Math.min(3, prev + 1) as Step)
  }

  const goToPreviousStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1) as Step)
  }

  const resetDemo = () => {
    setCurrentStep(1)
    setUploadedFile(null)
    setUploadProgress(0)
    setSelectedTrades([])
    setAnalysisResults([])
  }

  const canProceedFromStep1 = uploadedFile && uploadProgress === 100
  const canProceedFromStep2 = selectedTrades.length > 0

  if (authLoading) {
    return null
  }
  if (!user) {
    return null
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">You need admin privileges to access this page.</p>
              <Link href="/dashboard">
                <Button>Return to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img src={logo.src} alt="Bidi" className="h-6 w-6 sm:h-8 sm:w-8 text-black" />    
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">AI Plan Analysis Demo</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/admin/demo-settings">
              <Button variant="outline" className="hidden sm:flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-orange-500" />
            <h1 className="text-4xl font-bold text-gray-900">AI Plan Analysis Demo</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Upload construction plans, select trades, and see AI-powered bid generation in action
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-around max-w-2xl mx-auto">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex flex-col items-center">
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl
                  transition-all duration-300
                  ${currentStep >= step 
                    ? 'bg-orange-500 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-500'}
                `}>
                  {currentStep > step ? <CheckCircle2 className="w-8 h-8" /> : step}
                </div>
                <span className={`text-sm font-medium mt-3 ${currentStep >= step ? 'text-orange-600' : 'text-gray-500'}`}>
                  {step === 1 ? 'Upload Plan' : step === 2 ? 'Select Trades' : 'AI Analysis'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Card */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">
              {currentStep === 1 && '📄 Step 1: Upload Construction Plan'}
              {currentStep === 2 && '🔧 Step 2: Select Trade Categories'}
              {currentStep === 3 && '🤖 Step 3: AI-Generated Analysis'}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Upload a PDF construction plan to begin the analysis'}
              {currentStep === 2 && 'Choose which trades you need bids for'}
              {currentStep === 3 && 'Review AI-generated bid estimates and recommendations'}
            </CardDescription>
          </CardHeader>

          <CardContent className="min-h-[400px]">
            {/* Step 1: Upload */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {!uploadedFile ? (
                  <div 
                    onClick={handleUploadClick}
                    className="border-4 border-dashed border-gray-300 rounded-xl p-16 text-center hover:border-orange-400 hover:bg-orange-50 transition-all cursor-pointer group"
                  >
                    <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                    <p className="text-xl font-semibold text-gray-700 mb-2">
                      Drop your PDF plan here or click to browse
                    </p>
                    <p className="text-gray-500">
                      Supported format: PDF (max 50MB)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6">
                      <div className="flex items-center gap-4">
                        <FileText className="w-12 h-12 text-green-600" />
                        <div className="flex-1">
                          <p className="font-semibold text-lg text-gray-900">{uploadedFile.name}</p>
                          <p className="text-gray-600">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        {uploadProgress === 100 && (
                          <CheckCircle2 className="w-8 h-8 text-green-600" />
                        )}
                      </div>
                      
                      {isUploading && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">Uploading...</span>
                            <span className="font-semibold text-gray-900">{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-orange-500 to-orange-600 h-3 transition-all duration-300 rounded-full"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Button 
                      onClick={handleUploadClick}
                      variant="outline"
                      className="w-full"
                    >
                      Upload Different File
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Trade Selection */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {AVAILABLE_TRADES.map(trade => (
                    <button
                      key={trade.id}
                      onClick={() => toggleTrade(trade.id)}
                      className={`
                        p-6 rounded-xl border-2 transition-all duration-200
                        ${selectedTrades.includes(trade.id)
                          ? 'border-orange-500 bg-orange-50 shadow-lg scale-105'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'}
                      `}
                    >
                      <div className="text-4xl mb-2">{trade.icon}</div>
                      <div className="font-semibold text-gray-900">{trade.name}</div>
                      {selectedTrades.includes(trade.id) && (
                        <CheckCircle2 className="w-5 h-5 text-orange-600 mt-2 mx-auto" />
                      )}
                    </button>
                  ))}
                </div>

                {selectedTrades.length > 0 && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      Selected Trades ({selectedTrades.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTrades.map(tradeId => {
                        const trade = AVAILABLE_TRADES.find(t => t.id === tradeId)
                        return (
                          <Badge key={tradeId} variant="orange">
                            {trade?.icon} {trade?.name}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: AI Analysis */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {isAnalyzing ? (
                  <div className="text-center py-16">
                    <Loader2 className="w-16 h-16 mx-auto mb-6 text-orange-500 animate-spin" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      AI Experts Analyzing Your Plans...
                    </h3>
                    <p className="text-gray-600 mb-8">
                      {selectedTrades.length > 1 
                        ? `${selectedTrades.length} specialized AI contractors are reviewing your plans`
                        : 'AI contractor is analyzing your construction plans'}
                    </p>
                    <div className="max-w-md mx-auto space-y-2 text-left">
                      {[
                        '📄 Extracting text and specifications from PDF',
                        '🔍 Analyzing plan details with trade-specific expertise',
                        '📊 Calculating material quantities and costs',
                        '👷 Determining labor requirements',
                        '⚠️ Identifying potential issues and code concerns',
                        '✅ Generating professional recommendations'
                      ].map((task, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm text-gray-700">
                          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: `${idx * 200}ms` }} />
                          {task}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-8">
                      This may take 30-60 seconds depending on plan complexity...
                    </p>
                  </div>
                ) : analysisResults.length > 0 ? (
                  <div className="space-y-6">
                    {/* Show hybrid analysis status */}
                    {visionEnabled ? (
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-400 rounded-xl p-4">
                        <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                          🔬 Hybrid Analysis Mode: Vision + Text
                        </h4>
                        <p className="text-sm text-green-800 mb-3">
                          ✅ <strong>ALL {imagesAnalyzed} pages</strong> converted to images and analyzed with GPT-4 Vision<br/>
                          ✅ <strong>Text extracted</strong> from PDF and cross-referenced with visual elements
                        </p>
                        <div className="bg-white/50 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-semibold text-gray-900">How Hybrid Analysis Works:</p>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                            <div>
                              <strong>👁️ Vision Analysis:</strong>
                              <ul className="ml-2 mt-1 space-y-0.5">
                                <li>• Counts symbols visually</li>
                                <li>• Sees floor layouts</li>
                                <li>• Reads diagrams</li>
                              </ul>
                            </div>
                            <div>
                              <strong>📄 Text Analysis:</strong>
                              <ul className="ml-2 mt-1 space-y-0.5">
                                <li>• Verifies specifications</li>
                                <li>• Reads dimensions</li>
                                <li>• Extracts schedules</li>
                              </ul>
                            </div>
                          </div>
                          <p className="text-xs text-green-800 font-medium mt-2 pt-2 border-t border-green-200">
                            ✨ Higher confidence when both sources agree!
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
                        <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                          ⚠️ Text-Only Analysis
                        </h4>
                        <p className="text-xs text-yellow-800">
                          Vision analysis is not configured. The AI extracted text from your PDF but cannot see drawings or count visual symbols.
                          Add PDF_CO_API_KEY to your .env file to enable hybrid vision+text analysis for maximum accuracy.
                        </p>
                      </div>
                    )}

                    {analysisResults.map((result, idx) => (
                      <div key={idx} className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 shadow-md">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-1">
                              {AVAILABLE_TRADES.find(t => t.name === result.trade)?.icon} {result.trade}
                            </h3>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">
                                Confidence: {result.confidence}%
                              </Badge>
                              {result.confidence < 70 && (
                                <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-300 text-yellow-900">
                                  ⚠️ Estimated (limited plan details)
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-orange-600">{result.bidAmount}</div>
                            <div className="text-sm text-gray-600">{result.estimatedTimeline}</div>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">📦 Materials Required</h4>
                            <ul className="space-y-1 text-sm text-gray-700">
                              {result.materials.map((material, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-orange-500">•</span>
                                  {material}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">👷 Labor Requirements</h4>
                            <p className="text-sm text-gray-700">{result.labor}</p>
                          </div>
                        </div>

                        {result.potentialIssues.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-red-900 mb-2">⚠️ Potential Issues</h4>
                            <ul className="space-y-1 text-sm text-gray-700 bg-red-50 rounded-lg p-3 border border-red-200">
                              {result.potentialIssues.map((issue, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-red-500">•</span>
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.recommendations.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-green-900 mb-2">✅ Recommendations</h4>
                            <ul className="space-y-1 text-sm text-gray-700 bg-green-50 rounded-lg p-3 border border-green-200">
                              {result.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-green-500">•</span>
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-xl p-6 text-center">
                      <Sparkles className="w-12 h-12 mx-auto mb-3 text-orange-600" />
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        Analysis Complete!
                      </h3>
                      <p className="text-gray-700 mb-4">
                        AI has generated comprehensive bid estimates for {analysisResults.length} trade{analysisResults.length !== 1 ? 's' : ''}.
                      </p>
                      <Button onClick={resetDemo} variant="orange" className="mx-auto">
                        Try Another Plan
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>

          {/* Navigation Footer */}
          {!isAnalyzing && analysisResults.length === 0 && (
            <div className="border-t-2 border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
              <Button
                onClick={goToPreviousStep}
                disabled={currentStep === 1}
                variant="outline"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>

              <div className="text-sm text-gray-600">
                Step {currentStep} of 3
              </div>

              <Button
                onClick={goToNextStep}
                disabled={
                  (currentStep === 1 && !canProceedFromStep1) ||
                  (currentStep === 2 && !canProceedFromStep2)
                }
                variant="orange"
                className="gap-2"
              >
                {currentStep === 2 ? 'Analyze Plan' : 'Next'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

