'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Navbar from '@/components/navbar'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { 
  Building2, 
  Mail, 
  Users, 
  FileText, 
  Star, 
  CheckCircle, 
  ArrowRight, 
  Sparkles, 
  Zap,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  Briefcase
} from 'lucide-react'

export default function SubcontractorsPage() {
  const [isVisible, setIsVisible] = useState(false)
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-4000"></div>
      </div>

      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 text-center relative z-10">
        <div className="flex justify-center mb-6">
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center space-x-2">
            <Briefcase className="h-4 w-4" />
            <span>For Subcontractors</span>
          </div>
        </div>
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center space-x-2">
            <CheckCircle className="h-4 w-4" />
            <span>100% Free for Subcontractors</span>
          </div>
        </div>
        
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
          Get More Jobs
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {' '}Automatically
          </span>
        </h1>
        
        <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Join our network of qualified subcontractors and receive job opportunities directly in your inbox. 
          No more cold calling or searching for work - we bring the jobs to you. <strong className="text-blue-600">It's completely free!</strong>
        </p>
        
        <div className="flex justify-center">
          <Button 
            size="lg" 
            className="text-base sm:text-lg px-6 sm:px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
            onClick={() => document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Join Now - It's Free!
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
          </Button>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 relative z-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12">
          How It Works for Subcontractors
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {[
            {
              icon: Briefcase,
              title: "1. Sign Up",
              description: "Fill out your profile with your trade, location, and contact information. It takes just 2 minutes.",
              bgColor: "bg-blue-100",
              iconColor: "text-blue-600"
            },
            {
              icon: Mail,
              title: "2. Get Notified",
              description: "Receive email notifications when jobs matching your trade and location become available.",
              bgColor: "bg-green-100",
              iconColor: "text-green-600"
            },
            {
              icon: FileText,
              title: "3. Submit Bids",
              description: "Reply with your bid details and we'll organize everything for the general contractor.",
              bgColor: "bg-purple-100",
              iconColor: "text-purple-600"
            }
          ].map((step, index) => {
            const Icon = step.icon
            return (
              <Card key={index} className="text-center hover:scale-105 transition-all duration-300 hover:shadow-xl group">
                <CardHeader>
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${step.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`h-8 w-8 ${step.iconColor}`} />
                  </div>
                  <CardTitle className="text-lg group-hover:text-blue-600 transition-colors duration-300">
                    {step.title}
                  </CardTitle>
                  <CardDescription className="text-sm group-hover:text-gray-700 transition-colors duration-300">
                    {step.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gray-50 py-8 sm:py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12">
            Why Join Our Network?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {[
            {
              icon: Clock,
              title: "Save Time",
              description: "No more cold calling or driving around looking for work. Jobs come to you.",
              bgColor: "bg-blue-100",
              iconColor: "text-blue-600"
            },
            {
              icon: DollarSign,
              title: "More Opportunities",
              description: "Access to jobs from general contractors you might not have found otherwise.",
              bgColor: "bg-green-100",
              iconColor: "text-green-600"
            },
            {
              icon: Star,
              title: "Professional Presentation",
              description: "Your bids are organized and presented professionally to help you win more work.",
              bgColor: "bg-purple-100",
              iconColor: "text-purple-600"
            },
            {
              icon: Users,
              title: "Build Relationships",
              description: "Connect with general contractors who need reliable subcontractors.",
              bgColor: "bg-orange-100",
              iconColor: "text-orange-600"
            },
            {
              icon: MapPin,
              title: "Local Jobs",
              description: "Only receive notifications for jobs in your area and trade.",
              bgColor: "bg-pink-100",
              iconColor: "text-pink-600"
            },
            {
              icon: DollarSign,
              title: "Completely Free",
              description: "No fees, no subscriptions, no hidden costs. Join and start receiving jobs at no cost.",
              bgColor: "bg-emerald-100",
              iconColor: "text-emerald-600"
            }
          ].map((benefit, index) => {
            const Icon = benefit.icon
            return (
              <div key={index} className="text-center">
                <div className={`w-16 h-16 ${benefit.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <Icon className={`h-8 w-8 ${benefit.iconColor}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            )
          })}
          </div>
        </div>
      </section>

      {/* Sign Up Form Section */}
      <section id="signup-form" className="container mx-auto px-4 py-8 sm:py-16 relative z-10">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Join Our Network Today - It's Free!
            </h2>
            <p className="text-lg text-gray-600">
              Fill out the form below and start receiving job opportunities in your area. 
              <strong className="text-blue-600"> No cost, no fees, no strings attached.</strong>
            </p>
          </div>

          {!isSubmitted ? (
            <Card className="shadow-2xl">
              <CardHeader>
                <CardTitle className="text-center">Subcontractor Registration</CardTitle>
                <CardDescription className="text-center">
                  Complete your profile to start receiving job notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="trade">Primary Trade *</Label>
                      <Select value={formData.trade} onValueChange={(value) => handleSelectChange('trade', value)}>
                        <SelectTrigger>
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
                    <div>
                      <Label htmlFor="location">Service Area *</Label>
                      <Input
                        id="location"
                        name="location"
                        type="text"
                        required
                        value={formData.location}
                        onChange={handleInputChange}
                        placeholder="City, State (e.g., Austin, TX)"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg py-3"
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
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-2xl text-center">
              <CardContent className="pt-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Bidi!</h3>
                <p className="text-lg text-gray-600 mb-6">
                  Thank you for joining our free network! You've been successfully added to our database 
                  and will start receiving email notifications for jobs matching your trade ({formData.trade}) 
                  and location ({formData.location}) - at no cost to you.
                </p>
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>What's next?</strong> You'll receive email notifications whenever new jobs 
                    are posted that match your trade and location. No action needed on your part - 
                    just reply to the emails with your bid details when jobs interest you.
                  </p>
                </div>
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
                  className="mr-4"
                >
                  Register Another
                </Button>
                <Link href="/">
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    Back to Home
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-8 sm:py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Get More Jobs?
          </h2>
          <p className="text-lg sm:text-xl mb-8 opacity-90">
            Join hundreds of subcontractors who are already receiving job opportunities through Bidi. 
            <strong className="text-white"> It's completely free to join!</strong>
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              size="lg" 
              className="text-base sm:text-lg px-6 sm:px-8 py-3 bg-white text-blue-600 hover:bg-gray-100 border-2 border-white"
              onClick={() => document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Sign Up Now
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Building2 className="h-6 w-6" />
            <span className="text-xl font-bold">Bidi</span>
          </div>
          <p className="text-gray-400">
            © 2024 Bidi. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
