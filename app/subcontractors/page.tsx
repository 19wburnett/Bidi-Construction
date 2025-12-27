'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PublicLayout from '@/components/public-layout'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { BackgroundPattern } from '@/components/ui/background-pattern'
import { 
  Mail, 
  Users, 
  FileText, 
  Star, 
  CheckCircle, 
  ArrowRight, 
  Clock,
  DollarSign,
  MapPin,
  Briefcase,
  Shield,
  Upload,
  Sparkles,
  Download,
  Loader2
} from 'lucide-react'

// Quote Demo Animation Component
function QuoteDemoAnimation() {
  const [currentStep, setCurrentStep] = useState(-1) // -1 = not started
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  const startDemo = async () => {
    setIsRunning(true)
    setCurrentStep(0)
    setUploadProgress(0)
    setIsProcessing(false)
    setIsComplete(false)

    // Step 1: Upload animation
    for (let i = 0; i <= 100; i += 10) {
      setUploadProgress(i)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    await new Promise(resolve => setTimeout(resolve, 500))

    // Step 2: AI Processing
    setCurrentStep(1)
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 2500))
    setIsProcessing(false)

    // Step 3: Complete
    setCurrentStep(2)
    setIsComplete(true)
    setIsRunning(false)
  }

  const resetDemo = () => {
    setCurrentStep(-1)
    setUploadProgress(0)
    setIsProcessing(false)
    setIsComplete(false)
    setIsRunning(false)
  }

  return (
    <div className="relative">
      {/* Start Button */}
      <div className="text-center mb-8">
        {currentStep === -1 ? (
          <Button
            onClick={startDemo}
            size="lg"
            variant="orange"
            className="text-lg px-8 py-6 font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Watch Demo
          </Button>
        ) : (
          <Button
            onClick={resetDemo}
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6 font-bold"
            disabled={isRunning}
          >
            <ArrowRight className="h-5 w-5 mr-2 rotate-180" />
            Reset Demo
          </Button>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex items-center justify-center gap-4 lg:gap-8">
        {/* Step 1: Upload Plans */}
        <div className={`relative transition-all duration-500 ${
          currentStep === 0 ? 'scale-105' : currentStep > 0 ? 'opacity-60 scale-95' : currentStep === -1 ? 'opacity-40' : 'opacity-40'
        }`}>
          <Card className={`border-2 transition-all duration-500 ${
            currentStep === 0 
              ? 'border-orange-500 shadow-lg shadow-orange-500/20' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            <CardContent className="p-6 text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-500 ${
                currentStep === 0 
                  ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 scale-110' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                {currentStep === 0 && uploadProgress < 100 ? (
                  <Upload className="h-8 w-8 animate-bounce" />
                ) : (
                  <FileText className="h-8 w-8" />
                )}
              </div>
              {currentStep === 0 && uploadProgress < 100 && (
                <div className="mb-2">
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{uploadProgress}%</div>
                </div>
              )}
              <h3 className="font-semibold text-lg mb-2 dark:text-white">1. Upload Plans</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload your construction plans
              </p>
              {currentStep === 0 && uploadProgress < 100 && (
                <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-orange-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Arrow 1 */}
        <div className={`transition-all duration-500 ${
          currentStep >= 1 ? 'opacity-100 translate-x-0' : 'opacity-30 -translate-x-4'
        }`}>
          <ArrowRight className="h-8 w-8 text-orange-500" />
        </div>

        {/* Step 2: AI Processing */}
        <div className={`relative transition-all duration-500 ${
          currentStep === 1 ? 'scale-105' : currentStep > 1 ? 'opacity-60 scale-95' : currentStep < 1 ? 'opacity-40' : currentStep === -1 ? 'opacity-40' : ''
        }`}>
          <Card className={`border-2 transition-all duration-500 ${
            currentStep === 1 
              ? 'border-orange-500 shadow-lg shadow-orange-500/20' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            <CardContent className="p-6 text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-500 ${
                currentStep === 1 
                  ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 scale-110' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                {isProcessing ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Sparkles className="h-8 w-8" />
                )}
              </div>
              <h3 className="font-semibold text-lg mb-2 dark:text-white">2. AI Creates Quote</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Our AI analyzes and generates your quote
              </p>
              {isProcessing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-orange-600 dark:text-orange-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs font-medium">Processing...</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Arrow 2 */}
        <div className={`transition-all duration-500 ${
          currentStep >= 2 ? 'opacity-100 translate-x-0' : 'opacity-30 -translate-x-4'
        }`}>
          <ArrowRight className="h-8 w-8 text-orange-500" />
        </div>

        {/* Step 3: Receive Quote */}
        <div className={`relative transition-all duration-500 ${
          currentStep === 2 ? 'scale-105' : currentStep < 2 ? 'opacity-40' : currentStep === -1 ? 'opacity-40' : ''
        }`}>
          <Card className={`border-2 transition-all duration-500 ${
            currentStep === 2 
              ? 'border-green-500 shadow-lg shadow-green-500/20' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            <CardContent className="p-6 text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-500 ${
                currentStep === 2 
                  ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 scale-110 animate-pulse' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                {isComplete ? (
                  <div className="relative">
                    <FileText className="h-8 w-8" />
                    <CheckCircle className="h-5 w-5 absolute -top-1 -right-1 text-green-600 bg-white dark:bg-gray-950 rounded-full" />
                  </div>
                ) : (
                  <Download className="h-8 w-8" />
                )}
              </div>
              <h3 className="font-semibold text-lg mb-2 dark:text-white">3. Get Your Quote</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Download your professional PDF quote
              </p>
              {isComplete && (
                <div className="mt-4 flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Ready!</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden space-y-6">
        {/* Step 1: Upload Plans */}
        <div className={`relative transition-all duration-500 ${
          currentStep === 0 ? 'scale-105' : currentStep > 0 ? 'opacity-60 scale-95' : currentStep === -1 ? 'opacity-40' : 'opacity-40'
        }`}>
          <Card className={`border-2 transition-all duration-500 ${
            currentStep === 0 
              ? 'border-orange-500 shadow-lg shadow-orange-500/20' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            <CardContent className="p-6 text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-500 ${
                currentStep === 0 
                  ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 scale-110' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                {currentStep === 0 && uploadProgress < 100 ? (
                  <Upload className="h-8 w-8 animate-bounce" />
                ) : (
                  <FileText className="h-8 w-8" />
                )}
              </div>
              {currentStep === 0 && uploadProgress < 100 && (
                <div className="mb-2">
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{uploadProgress}%</div>
                </div>
              )}
              <h3 className="font-semibold text-lg mb-2 dark:text-white">1. Upload Plans</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload your construction plans
              </p>
              {currentStep === 0 && uploadProgress < 100 && (
                <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-orange-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className={`flex justify-center transition-all duration-500 ${
          currentStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-30 -translate-y-4'
        }`}>
          <ArrowRight className="h-6 w-6 text-orange-500 rotate-90" />
        </div>

        {/* Step 2: AI Processing */}
        <div className={`relative transition-all duration-500 ${
          currentStep === 1 ? 'scale-105' : currentStep > 1 ? 'opacity-60 scale-95' : currentStep < 1 ? 'opacity-40' : currentStep === -1 ? 'opacity-40' : ''
        }`}>
          <Card className={`border-2 transition-all duration-500 ${
            currentStep === 1 
              ? 'border-orange-500 shadow-lg shadow-orange-500/20' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            <CardContent className="p-6 text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-500 ${
                currentStep === 1 
                  ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 scale-110' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                {isProcessing ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Sparkles className="h-8 w-8" />
                )}
              </div>
              <h3 className="font-semibold text-lg mb-2 dark:text-white">2. AI Creates Quote</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Our AI analyzes and generates your quote
              </p>
              {isProcessing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-orange-600 dark:text-orange-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs font-medium">Processing...</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className={`flex justify-center transition-all duration-500 ${
          currentStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-30 -translate-y-4'
        }`}>
          <ArrowRight className="h-6 w-6 text-orange-500 rotate-90" />
        </div>

        {/* Step 3: Receive Quote */}
        <div className={`relative transition-all duration-500 ${
          currentStep === 2 ? 'scale-105' : currentStep < 2 ? 'opacity-40' : currentStep === -1 ? 'opacity-40' : ''
        }`}>
          <Card className={`border-2 transition-all duration-500 ${
            currentStep === 2 
              ? 'border-green-500 shadow-lg shadow-green-500/20' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            <CardContent className="p-6 text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-500 ${
                currentStep === 2 
                  ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 scale-110 animate-pulse' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                {isComplete ? (
                  <div className="relative">
                    <FileText className="h-8 w-8" />
                    <CheckCircle className="h-5 w-5 absolute -top-1 -right-1 text-green-600 bg-white dark:bg-gray-950 rounded-full" />
                  </div>
                ) : (
                  <Download className="h-8 w-8" />
                )}
              </div>
              <h3 className="font-semibold text-lg mb-2 dark:text-white">3. Get Your Quote</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Download your professional PDF quote
              </p>
              {isComplete && (
                <div className="mt-4 flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Ready!</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function SubcontractorsPage() {
  const [isVisible, setIsVisible] = useState(false)
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    trade: '',
    location: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    setIsVisible(true)

    // Intersection Observer for scroll-triggered animations
    const observerOptions = {
      threshold: 0.2,
      rootMargin: '0px 0px -100px 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id')
          if (sectionId) {
            setVisibleSections(prev => new Set(prev).add(sectionId))
          }
        }
      })
    }, observerOptions)

    const sections = document.querySelectorAll('[data-section-id]')
    sections.forEach(section => observer.observe(section))

    return () => {
      sections.forEach(section => observer.unobserve(section))
    }
  }, [])

  const tradeCategories = [
    'Electrical',
    'Plumbing',
    'HVAC',
    'Roofing',
    'Flooring',
    'Painting',
    'Carpentry',
    'Concrete',
    'Landscaping',
    'General Construction',
    'Renovation',
    'Other'
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    
    // Validate required fields
    if (!formData.name || !formData.email || !formData.trade || !formData.location) {
      setError('Please fill in all required fields.')
      setIsSubmitting(false)
      return
    }
    
    try {
      // Check if email already exists
      const { data: existingSub } = await supabase
        .from('subcontractors')
        .select('email')
        .eq('email', formData.email)
        .single()

      if (existingSub) {
        setError('This email is already registered. Please use a different email address.')
        setIsSubmitting(false)
        return
      }

      // Insert new subcontractor
      const { data, error: insertError } = await supabase
        .from('subcontractors')
        .insert([
          {
            email: formData.email,
            name: formData.name,
            trade_category: formData.trade,
            location: formData.location
          }
        ])
        .select()

      if (insertError) {
        throw insertError
      }

      setIsSubmitted(true)
    } catch (err) {
      console.error('Error saving subcontractor:', err)
      setError('There was an error saving your information. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300 overflow-hidden">
        <BackgroundPattern />

      {/* Quote Service Hero Section */}
      <section className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/30 dark:to-black py-16 sm:py-24 transition-colors duration-300 relative overflow-hidden">
        <div className="absolute inset-0 construction-grid opacity-20 -z-10"></div>
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className={`inline-flex items-center justify-center mb-4 transition-all duration-1000 delay-300 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}>
                <div className="bg-orange-100 dark:bg-orange-900/50 border-2 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm">
                  <FileText className="h-4 w-4 inline mr-2" />
                  Quote Generation Service
                </div>
              </div>
              <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-6 tracking-tight transition-all duration-1000 delay-500 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}>
                Get Professional Quotes
                <span className="block bidi-orange-text">Ready to Send</span>
              </h1>
              <p className={`text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto font-medium transition-all duration-1000 delay-700 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}>
                Upload your plans, describe the work, and receive PDF quotes ready to send to your clients.
              </p>
            </div>

            <Card className={`border-2 border-orange-200 dark:border-orange-900 bg-white dark:bg-gray-950 shadow-xl transition-all duration-1000 delay-900 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}>
              <CardHeader className="text-center pb-6 pt-8">
                <div className="flex justify-center mb-4">
                  <div className="bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 px-4 py-2 rounded-full text-sm font-bold">
                    $200/month
                  </div>
                </div>
                <CardTitle className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-3">
                  Bidi Quote Service
                </CardTitle>
                <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
                  Professional quote generation for subcontractors
                </CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="space-y-4 mb-8">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Upload Plans</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Upload construction plans in PDF or image format</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Describe Your Work</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Tell us what work you need an estimate for</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Add Known Pricing</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Include any pricing you already know</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Receive PDF Quote</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Get a professional PDF quote ready to send to clients within 1 business day</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Note:</strong> Our AI estimator is currently being finalized. Your quote requests will be processed by our team within 1 business day.
                  </p>
                </div>

                <div className="text-center">
                  <Link href="/auth/signup?type=sub">
                    <Button 
                      size="lg" 
                      variant="orange"
                      className="text-lg px-8 py-6 font-bold w-full sm:w-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
                    >
                      Get Started - $200/month
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                    </Button>
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Cancel anytime. Secure payment processing by Stripe.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="container mx-auto px-4 py-12 sm:py-20 relative z-10">
        <div className="max-w-5xl mx-auto">
          <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-black dark:text-white mb-12 tracking-tight transition-all duration-1000 delay-1000 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            See How It Works
          </h2>
          
          <QuoteDemoAnimation />
        </div>
      </section>

      {/* Get More Jobs Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 text-center relative z-10">
        <div className={`flex justify-center mb-8 transition-all duration-1000 delay-1100 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="bg-gray-100 border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center space-x-2">
            <Briefcase className="h-4 w-4" />
            <span>For Subcontractors</span>
          </div>
        </div>
        
        <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold text-black dark:text-white mb-6 tracking-tight transition-all duration-1000 delay-1300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          Get More Jobs
          <span className="block bidi-orange-text">
            Automatically
          </span>
        </h2>
        
        <p className={`text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto font-medium transition-all duration-1000 delay-1500 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          Join our network of subcontractors and get jobs sent to your inbox.<strong className="bidi-orange-text"> No software needed, just reply to our emails with your bid.</strong>
        </p>
        
        <div className={`flex justify-center transition-all duration-1000 delay-1700 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <Button 
            size="lg" 
            variant="outline"
            className="text-lg sm:text-xl px-8 sm:px-12 py-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group font-bold"
            onClick={() => document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Join Now - It's Free!
            <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform duration-200" />
          </Button>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-12 sm:py-20 relative z-10">
        <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-black dark:text-white mb-12 sm:mb-16 tracking-tight transition-all duration-1000 delay-1900 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          How It Works for Subcontractors
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {[
            {
              icon: Briefcase,
              title: "1. Sign Up",
              description: "Fill out your profile with your trade, location, and contact information. It takes just 2 minutes.",
              bgColor: "bg-gray-100",
              iconColor: "text-gray-700",
              borderColor: "border-gray-200"
            },
            {
              icon: Mail,
              title: "2. Get Notified",
              description: "Receive email notifications when jobs matching your trade and location become available.",
              bgColor: "bg-gray-100",
              iconColor: "text-gray-700",
              borderColor: "border-gray-200"
            },
            {
              icon: FileText,
              title: "3. Submit Bids",
              description: "Reply with your bid details and we'll organize everything for the general contractor.",
              bgColor: "bidi-orange-bg-light",
              iconColor: "bidi-orange-text",
              borderColor: "border-orange/20"
            }
          ].map((step, index) => {
            const Icon = step.icon
            const sectionId = `step-${index}`
            const isSectionVisible = visibleSections.has(sectionId)
            
            return (
              <div key={index} data-section-id={sectionId} className={`transition-all duration-700 ${
                isSectionVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`} style={{ transitionDelay: `${index * 150}ms` }}>
                <Card className="text-center hover:scale-105 transition-all duration-300 hover:shadow-xl group border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 h-full">
                  <CardHeader>
                    <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${step.bgColor} ${step.borderColor} border-2 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`h-8 w-8 ${step.iconColor}`} />
                    </div>
                    <CardTitle className="text-xl font-bold text-black dark:text-white group-hover:text-black dark:group-hover:text-white transition-colors duration-300">
                      {step.title}
                    </CardTitle>
                    <CardDescription className="text-base text-gray-600 dark:text-gray-300 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-300 mt-2">
                      {step.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            )
          })}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gray-50 dark:bg-black py-16 sm:py-24 transition-colors duration-300 relative overflow-hidden">
        <div className="absolute inset-0 construction-grid opacity-30 -z-10"></div>
        <div className="container mx-auto px-4">
          <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-black dark:text-white mb-12 sm:mb-16 tracking-tight`}>
            Why Join Our Network?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
            {
              icon: Clock,
              title: "Save Time",
              description: "No more cold calling or driving around looking for work. Jobs come to you.",
              bgColor: "bg-gray-100",
              iconColor: "text-gray-700"
            },
            {
              icon: DollarSign,
              title: "More Opportunities",
              description: "Access to jobs from general contractors you might not have found otherwise.",
              bgColor: "bg-gray-100",
              iconColor: "text-gray-700"
            },
            {
              icon: Shield,
              title: "Professional Presentation",
              description: "Your bids are organized and presented professionally to help you win more work.",
              bgColor: "bg-gray-100",
              iconColor: "text-gray-700"
            },
            {
              icon: Users,
              title: "Build Relationships",
              description: "Connect with general contractors who need reliable subcontractors.",
              bgColor: "bidi-orange-bg-light",
              iconColor: "bidi-orange-text"
            },
            {
              icon: MapPin,
              title: "Local Jobs",
              description: "Only receive notifications for jobs in your area and trade.",
              bgColor: "bg-gray-100",
              iconColor: "text-gray-700"
            },
            {
              icon: Star,
              title: "Completely Free",
              description: "No fees, no subscriptions, no hidden costs. Join and start receiving jobs at no cost.",
              bgColor: "bg-gray-100",
              iconColor: "text-gray-700"
            }
          ].map((benefit, index) => {
            const Icon = benefit.icon
            const sectionId = `benefit-${index}`
            const isSectionVisible = visibleSections.has(sectionId)
            
            return (
              <div key={index} data-section-id={sectionId} className={`text-center p-6 rounded-xl hover:bg-white dark:hover:bg-gray-900 hover:shadow-lg transition-all duration-300 ${
                isSectionVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`} style={{ transitionDelay: `${index * 100}ms` }}>
                <div className={`w-16 h-16 ${benefit.bgColor} dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-gray-200 dark:border-gray-700 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`h-8 w-8 ${benefit.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-black dark:text-white mb-3">{benefit.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 font-medium">{benefit.description}</p>
              </div>
            )
          })}
          </div>
        </div>
      </section>

      {/* Sign Up Form Section */}
      <section id="signup-form" className="container mx-auto px-4 py-16 sm:py-24 relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-6 tracking-tight">
              Join Our Network Today - It's Free!
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 font-medium">
              Fill out the form below and start receiving job opportunities in your area. 
              <strong className="bidi-orange-text block mt-2"> No cost, no fees, no strings attached.</strong>
            </p>
          </div>

          {!isSubmitted ? (
            <Card className="shadow-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 overflow-hidden relative">
              {/* Decorative accent */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange to-orange-600"></div>
              
              <CardHeader className="pt-8 pb-6 text-center">
                <CardTitle className="text-2xl dark:text-white mb-2">Subcontractor Registration</CardTitle>
                <CardDescription className="text-base font-medium text-gray-600 dark:text-gray-300">
                  Complete your profile to start receiving job notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 sm:px-10 pb-10">
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg animate-shake">
                    <p className="text-red-800 text-sm font-medium flex items-center">
                      <span className="mr-2">⚠️</span> {error}
                    </p>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-semibold">Full Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="John Smith"
                        className="h-12 border-gray-300 focus:border-orange focus:ring-orange"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold">Email Address *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="john@example.com"
                        className="h-12 border-gray-300 focus:border-orange focus:ring-orange"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="trade" className="text-sm font-semibold">Primary Trade *</Label>
                      <Select value={formData.trade} onValueChange={(value) => handleSelectChange('trade', value)}>
                        <SelectTrigger className="h-12 border-gray-300 focus:border-orange focus:ring-orange">
                          <SelectValue placeholder="Select your trade" />
                        </SelectTrigger>
                        <SelectContent>
                          {tradeCategories.map((trade) => (
                            <SelectItem key={trade} value={trade}>
                              {trade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-sm font-semibold">Service Area *</Label>
                      <Input
                        id="location"
                        name="location"
                        type="text"
                        required
                        value={formData.location}
                        onChange={handleInputChange}
                        placeholder="City, State (e.g., Austin, TX)"
                        className="h-12 border-gray-300 focus:border-orange focus:ring-orange"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    variant="orange"
                    className="w-full text-lg py-6 font-bold mt-4 shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        Join Our Network
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                  
                  <p className="text-xs text-center text-gray-500 mt-4">
                    By joining, you agree to receive email notifications about relevant job opportunities. 
                    You can unsubscribe at any time.
                  </p>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-2xl text-center border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 animate-scale-in">
              <CardContent className="pt-12 pb-12 px-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="text-3xl font-bold text-black dark:text-white mb-4">Welcome to Bidi!</h3>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 font-medium max-w-xl mx-auto">
                  Thank you for joining our free network! You've been successfully added to our database 
                  and will start receiving email notifications for jobs matching your trade ({formData.trade}) 
                  and location ({formData.location}).
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 mb-8 border border-blue-100 dark:border-blue-800">
                  <p className="text-blue-800 dark:text-blue-300 font-medium">
                    <strong>What's next?</strong> You'll receive email notifications whenever new jobs 
                    are posted that match your trade and location. No action needed on your part - 
                    just reply to the emails with your bid details when jobs interest you.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Button 
                    onClick={() => {
                      setIsSubmitted(false)
                      setFormData({
                        name: '',
                        email: '',
                        trade: '',
                        location: ''
                      })
                    }}
                    variant="outline"
                    className="border-2"
                  >
                    Register Another
                  </Button>
                  <Link href="/">
                    <Button variant="orange" className="font-bold">
                      Back to Home
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
      </div>
    </PublicLayout>
  )
}
