'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PublicLayout from '@/components/public-layout'
import { FileText, CheckCircle, ArrowRight, Mail, Sparkles, Zap, Brain, Clock, DollarSign } from 'lucide-react'
import { BackgroundPattern } from '@/components/ui/background-pattern'
import Script from 'next/script'

export default function EstimatePage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/estimate-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      setSuccess(true)
      setEmail('')
      setName('')
      setLoading(false)
    } catch (err) {
      setError('Network error. Please check your connection and try again.')
      setLoading(false)
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || 'https://bidicontracting.com'

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Free Estimate on Construction Plans',
    description: 'Join our waitlist for free estimates on your construction plans. Get instant AI-powered analysis and cost estimates.',
    url: `${baseUrl}/estimate`,
    mainEntity: {
      '@type': 'Service',
      name: 'Free Construction Plan Estimate',
      description: 'AI-powered analysis and cost estimates for construction plans',
      provider: {
        '@type': 'Organization',
        name: 'BIDI Contracting',
        url: baseUrl,
      },
      areaServed: {
        '@type': 'Country',
        name: 'United States',
      },
    },
  }

  return (
    <>
      <Script
        id="estimate-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300 overflow-hidden">
        {/* Enhanced Background Pattern */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-orange-50/60 dark:from-black dark:via-black dark:to-orange-950/40"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange via-orange to-transparent"></div>
          <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange/15 to-transparent"></div>
          <div className="absolute bottom-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-500/15 to-transparent"></div>
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, rgba(235, 80, 35, 0.04) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </div>
        <BackgroundPattern />
        <PublicLayout>
        {/* Hero Section */}
        <main className="container mx-auto px-4 py-12 sm:py-20 text-center relative z-10">
          {/* Animated Badges */}
          <div className={`flex justify-center mb-8 transition-all duration-1000 delay-300 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <Badge className="bg-gray-100 border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center space-x-2 hover:scale-105 transition-transform">
                <Sparkles className="h-4 w-4" />
                <span>100% Free</span>
              </Badge>
              <Badge className="bg-gray-100 border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center space-x-2 hover:scale-105 transition-transform">
                <Brain className="h-4 w-4" />
                <span>AI-Powered</span>
              </Badge>
              <Badge className="bidi-orange-bg-light bidi-orange-text px-4 py-2 rounded-lg text-sm font-bold border border-orange/20 flex items-center space-x-2 hover:scale-105 transition-transform">
                <Zap className="h-4 w-4" />
                <span>Instant Analysis</span>
              </Badge>
            </div>
          </div>

          {/* Main Heading */}
          <div className={`max-w-4xl mx-auto transition-all duration-1000 delay-500 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-950/20 rounded-2xl p-6 shadow-lg border-2 border-orange/20">
                  <FileText className="h-16 w-16 text-orange mx-auto animate-pulse" />
                </div>
                <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg animate-bounce">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-6 tracking-tight">
              Get a Free Estimate on Your
              <span className="block bidi-orange-text mt-2">Construction Plans</span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-4 font-medium max-w-3xl mx-auto">
              Join our waitlist and get instant AI-powered analysis and cost estimates on your construction plans.
            </p>
            <p className="text-base text-gray-500 dark:text-gray-400 mb-12">
              No cost, no commitment — just free estimates delivered to your inbox.
            </p>
          </div>

          {/* Signup Form Section */}
          <section className={`max-w-2xl mx-auto transition-all duration-1000 delay-700 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`} aria-labelledby="signup-heading">
            {success ? (
              <Card className="border-2 border-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/40 dark:to-gray-950 shadow-2xl">
                <CardContent className="pt-12 pb-12 px-8">
                  <div className="text-center">
                    <div className="flex justify-center mb-6">
                      <div className="relative">
                        <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-6 animate-scale-in">
                          <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full animate-ping"></div>
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-black dark:text-white mb-3">
                      You're on the list! 🎉
                    </h3>
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto">
                      We'll notify you as soon as free estimates become available. Check your email for confirmation.
                    </p>
                    <Button
                      onClick={() => {
                        setSuccess(false)
                        setEmail('')
                        setName('')
                      }}
                      variant="outline"
                      className="border-2 border-gray-300 hover:border-orange"
                    >
                      Add Another Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 shadow-2xl hover:shadow-3xl transition-all duration-300">
                <CardHeader className="text-center pb-6 pt-8">
                  <div className="flex justify-center mb-4">
                    <div className="bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-950/20 rounded-full p-4">
                      <Mail className="h-8 w-8 text-orange" />
                    </div>
                  </div>
                  <CardTitle id="signup-heading" className="text-3xl font-bold text-black dark:text-white mb-2">
                    Join the Waitlist
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-300">
                    Enter your email below and be among the first to get free estimates
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold">
                        Email Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="h-14 text-base border-2 focus:border-orange transition-colors"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-semibold">
                        Name <span className="text-gray-400 text-xs">(Optional)</span>
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                        className="h-14 text-base border-2 focus:border-orange transition-colors"
                      />
                    </div>

                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4 animate-pulse">
                        <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="orange"
                      className="w-full h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                          <span>Submitting...</span>
                        </div>
                      ) : (
                        <>
                          <Mail className="mr-2 h-5 w-5" />
                          Get on the List
                          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                      By submitting, you agree to receive updates about free estimate availability.
                      <br />
                      <span className="font-semibold">We'll never spam you.</span>
                    </p>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Benefits Section */}
            <div className={`mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-1000 delay-1000 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}>
              <div className="group text-center p-8 bg-white dark:bg-gray-950 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-orange transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <div className="bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-950/20 rounded-2xl p-4 w-20 h-20 mx-auto mb-5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Brain className="h-10 w-10 text-orange" />
                </div>
                <h3 className="text-xl font-bold text-black dark:text-white mb-3">AI-Powered Analysis</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Get instant, accurate estimates using our advanced AI technology trained on construction plans
                </p>
              </div>

              <div className="group text-center p-8 bg-white dark:bg-gray-950 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <div className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-950/20 rounded-2xl p-4 w-20 h-20 mx-auto mb-5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <DollarSign className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-black dark:text-white mb-3">100% Free</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  No cost, no commitment, no credit card required — just free estimates delivered to your inbox
                </p>
              </div>

              <div className="group text-center p-8 bg-white dark:bg-gray-950 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <div className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-950/20 rounded-2xl p-4 w-20 h-20 mx-auto mb-5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-black dark:text-white mb-3">Early Access</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Be among the first to know when free estimates launch and get priority access
                </p>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className={`mt-16 text-center transition-all duration-1000 delay-1200 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}>
              <div className="inline-flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-6 py-3 rounded-full border border-gray-200 dark:border-gray-700">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>No spam, ever</span>
                <span className="text-gray-300">•</span>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Unsubscribe anytime</span>
                <span className="text-gray-300">•</span>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>100% free</span>
              </div>
            </div>
          </section>
        </main>

        </PublicLayout>
      </div>
    </>
  )
}
