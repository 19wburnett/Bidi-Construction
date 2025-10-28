'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import { 
  Code, 
  MapPin, 
  Clock, 
  DollarSign, 
  ArrowRight, 
  CheckCircle, 
  Star,
  Mail,
  Calendar,
  Users,
  Building2,
  Upload,
  FileText,
  Send,
  Copy,
  Check,
  Twitter,
  Linkedin,
  Facebook
} from 'lucide-react'

export default function JobsPage() {
  const [showApplicationForm, setShowApplicationForm] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    experience: '',
    currentRole: '',
    company: '',
    linkedin: '',
    github: '',
    portfolio: '',
    coverLetter: '',
    resume: null as File | null
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setFormData(prev => ({ ...prev, resume: file }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulate form submission
    setTimeout(() => {
      setShowConfirmation(true)
    }, 1000)
  }

  const handleBackToJob = () => {
    setShowApplicationForm(false)
    setShowConfirmation(false)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: '',
      experience: '',
      currentRole: '',
      company: '',
      linkedin: '',
      github: '',
      portfolio: '',
      coverLetter: '',
      resume: null
    })
  }

  const jobUrl = typeof window !== 'undefined' ? window.location.href : ''
  const jobTitle = "Software Engineer - Build the Future of Construction Tech with Bidi"
  const jobDescription = "Join Bidi and help modernize how general contractors and subcontractors connect, bid, and build. We're growing 200% month-over-month and need exceptional engineers!"

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const shareToLinkedIn = () => {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`
    window.open(linkedinUrl, '_blank')
  }

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(jobTitle)}&url=${encodeURIComponent(jobUrl)}`
    window.open(twitterUrl, '_blank')
  }

  const shareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`
    window.open(facebookUrl, '_blank')
  }

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Check out this job posting: ${jobTitle}`)
    const body = encodeURIComponent(`${jobDescription}\n\nView the full posting: ${jobUrl}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  // Show confirmation page
  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="bg-white dark:bg-gray-800">
              <CardContent className="pt-8 pb-8">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  Application Submitted!
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                  Thank you for your interest in joining Bidi. We've received your application for the Software Engineer position and will review it carefully.
                </p>
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 mb-8">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">What happens next?</h3>
                  <ul className="text-left text-gray-700 dark:text-gray-300 space-y-2">
                    <li>• We'll review your application within 3-5 business days</li>
                    <li>• If selected, we'll reach out to schedule an initial phone call</li>
                    <li>• Our process typically includes a technical interview and culture fit discussion</li>
                    <li>• We'll keep you updated throughout the process</li>
                  </ul>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button onClick={handleBackToJob} variant="outline">
                    View Other Positions
                  </Button>
                  <Button onClick={() => window.location.href = '/'}>
                    Back to Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // Show application form
  if (showApplicationForm) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <Button 
                onClick={handleBackToJob} 
                variant="outline" 
                className="mb-4"
              >
                ← Back to Job Posting
              </Button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Apply for Software Engineer
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Join Bidi and help build the future of construction tech
              </p>
            </div>

            <Card className="bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Application Form
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="location">Location *</Label>
                        <Input
                          id="location"
                          value={formData.location}
                          onChange={(e) => handleInputChange('location', e.target.value)}
                          placeholder="City, State/Country"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Professional Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Professional Information</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="experience">Years of Experience *</Label>
                        <Select value={formData.experience} onValueChange={(value) => handleInputChange('experience', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select experience level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0-1">0-1 years</SelectItem>
                            <SelectItem value="2-3">2-3 years</SelectItem>
                            <SelectItem value="4-5">4-5 years</SelectItem>
                            <SelectItem value="6-10">6-10 years</SelectItem>
                            <SelectItem value="10+">10+ years</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="currentRole">Current Role</Label>
                        <Input
                          id="currentRole"
                          value={formData.currentRole}
                          onChange={(e) => handleInputChange('currentRole', e.target.value)}
                          placeholder="e.g., Frontend Developer, Full Stack Engineer"
                        />
                      </div>
                      <div>
                        <Label htmlFor="company">Current Company</Label>
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={(e) => handleInputChange('company', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Links */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Links & Portfolio</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="linkedin">LinkedIn Profile</Label>
                        <Input
                          id="linkedin"
                          type="url"
                          value={formData.linkedin}
                          onChange={(e) => handleInputChange('linkedin', e.target.value)}
                          placeholder="https://linkedin.com/in/yourname"
                        />
                      </div>
                      <div>
                        <Label htmlFor="github">GitHub Profile</Label>
                        <Input
                          id="github"
                          type="url"
                          value={formData.github}
                          onChange={(e) => handleInputChange('github', e.target.value)}
                          placeholder="https://github.com/yourname"
                        />
                      </div>
                      <div>
                        <Label htmlFor="portfolio">Portfolio Website</Label>
                        <Input
                          id="portfolio"
                          type="url"
                          value={formData.portfolio}
                          onChange={(e) => handleInputChange('portfolio', e.target.value)}
                          placeholder="https://yourportfolio.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resume Upload */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resume</h3>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <Label htmlFor="resume" className="cursor-pointer">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formData.resume ? formData.resume.name : 'Click to upload resume'}
                        </span>
                        <input
                          id="resume"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">PDF, DOC, or DOCX (max 10MB)</p>
                    </div>
                  </div>

                  {/* Cover Letter */}
                  <div>
                    <Label htmlFor="coverLetter">Cover Letter</Label>
                    <Textarea
                      id="coverLetter"
                      value={formData.coverLetter}
                      onChange={(e) => handleInputChange('coverLetter', e.target.value)}
                      placeholder="Tell us why you're excited about this role and what you can bring to Bidi..."
                      rows={6}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <Button type="submit" size="lg" className="w-full sm:w-auto">
                      <Send className="mr-2 h-4 w-4" />
                      Submit Application
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />

      {/* Job Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  Software Engineer
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
                  Build the Future of Construction Tech with Bidi
                </p>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="secondary" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Remote
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Full-time
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Equity
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={() => setShowApplicationForm(true)}
                  size="lg" 
                  className="w-full sm:w-auto"
                >
                  Apply Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => setShowShareModal(true)}
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Company Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    About Bidi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-700 dark:text-gray-300">
                    At Bidi, we're modernizing how general contractors and subcontractors connect, bid, and build—eliminating the chaos of email chains and spreadsheet bidding with intelligent plan analysis and bid-leveling tools that save teams hours every day.
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    We're growing 200% month-over-month and need exceptional engineers to help build technology transforming a trillion-dollar industry.
                  </p>
                </CardContent>
              </Card>

              {/* Why Join Us */}
              <Card>
                <CardHeader>
                  <CardTitle>Why Join Us</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    We're a fast-moving startup with real traction, a sharp founding team, and a product solving critical pain points in construction.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">
                        <strong>Fast impact:</strong> Your code ships quickly and directly shapes how contractors work—no bureaucracy or endless review cycles.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">
                        <strong>True ownership:</strong> Meaningful early-stage equity with real upside as we scale.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">
                        <strong>Career acceleration:</strong> Early engineers grow into technical leaders as the company expands.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">
                        <strong>Massive market impact:</strong> Construction is a $10T global market starving for modern software—you'll help bring it into the digital era.
                      </span>
                    </li>
                  </ul>
                  <p className="text-gray-700 dark:text-gray-300 mt-4 font-medium">
                    We can't offer Silicon Valley salaries yet, but we can offer ownership, autonomy, and the chance to grow with a company scaling fast.
                  </p>
                </CardContent>
              </Card>

              {/* Job Responsibilities */}
              <Card>
                <CardHeader>
                  <CardTitle>What You'll Do</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Design and ship features in our React + Node + Supabase stack</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Implement real-time collaboration and AI-driven plan analysis tools</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Translate user pain points into elegant, high-impact solutions</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Optimize scalability and performance as we onboard new contractors weekly</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Collaborate directly with founders on architecture and product direction</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle>What We're Looking For</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Strong skills in JavaScript/TypeScript, React, and Node.js (Supabase experience is a plus)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">A builder's mindset—proactive, curious, and fast at turning ideas into products</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Interest in construction tech, data visualization, or AI automation</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">A growth-oriented teammate who values learning, ownership, and collaboration</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle>What You'll Get</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Meaningful early-stage equity with substantial upside as we grow</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Flexible hours and a remote-friendly culture focused on results</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Direct mentorship from founders who value curiosity and creative problem-solving</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">The chance to leave your mark on software that modernizes how buildings get built</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Call to Action */}
              <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Ready to Build the Future?
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-6">
                      If you want your code to power the future of construction and grow with a startup on the rise—join us.
                    </p>
                    <Button 
                      onClick={() => setShowApplicationForm(true)}
                      size="lg" 
                      className="w-full sm:w-auto"
                    >
                      Apply Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Job Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Job Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Location</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Remote</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Type</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Full-time</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Experience</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Mid-level</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Compensation</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Equity + Competitive</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tech Stack */}
              <Card>
                <CardHeader>
                  <CardTitle>Tech Stack</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">React</Badge>
                    <Badge variant="outline">Node.js</Badge>
                    <Badge variant="outline">TypeScript</Badge>
                    <Badge variant="outline">Supabase</Badge>
                    <Badge variant="outline">Next.js</Badge>
                    <Badge variant="outline">AI/ML</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Company Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Company Growth</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">200%</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Month-over-month growth</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">$10T</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Global market opportunity</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-center pb-2">
            <DialogTitle className="text-xl font-bold">Share this job posting</DialogTitle>
            <DialogDescription className="text-base">
              Help us spread the word about this opportunity!
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-2">
            {/* Copy Link Section */}
            <div className="space-y-3">
              <Label htmlFor="link" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Copy link
              </Label>
              <div className="flex items-center space-x-3">
                <Input
                  id="link"
                  defaultValue={jobUrl}
                  readOnly
                  className="h-10 text-sm bg-gray-50 dark:bg-gray-800"
                />
                <Button 
                  onClick={copyToClipboard}
                  size="sm" 
                  className="px-4 h-10 min-w-[80px]"
                  variant={copied ? "default" : "outline"}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  Or share on social media
                </span>
              </div>
            </div>
            
            {/* Social Media Share Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={shareToLinkedIn}
                className="w-full h-12 flex flex-col items-center justify-center space-y-1 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20"
              >
                <Linkedin className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium">LinkedIn</span>
              </Button>
              <Button
                variant="outline"
                onClick={shareToTwitter}
                className="w-full h-12 flex flex-col items-center justify-center space-y-1 hover:bg-sky-50 hover:border-sky-300 dark:hover:bg-sky-900/20"
              >
                <Twitter className="h-5 w-5 text-sky-500" />
                <span className="text-sm font-medium">Twitter</span>
              </Button>
              <Button
                variant="outline"
                onClick={shareToFacebook}
                className="w-full h-12 flex flex-col items-center justify-center space-y-1 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20"
              >
                <Facebook className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium">Facebook</span>
              </Button>
              <Button
                variant="outline"
                onClick={shareViaEmail}
                className="w-full h-12 flex flex-col items-center justify-center space-y-1 hover:bg-gray-50 hover:border-gray-300 dark:hover:bg-gray-800"
              >
                <Mail className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium">Email</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Code Pattern Component
function CodePattern() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <g opacity="0.6">
        {/* Code brackets */}
        <g transform="translate(20, 20)">
          {Array.from({ length: 6 }).map((_, i) => (
            <g key={i} transform={`translate(0, ${i * 30})`}>
              <rect x="0" y="0" width="4" height="20" fill="currentColor" rx="2"/>
              <rect x="16" y="0" width="4" height="20" fill="currentColor" rx="2"/>
              <rect x="8" y="8" width="4" height="4" fill="currentColor" rx="1"/>
            </g>
          ))}
        </g>
        
        {/* Function symbols */}
        <g transform="translate(80, 30)">
          {Array.from({ length: 5 }).map((_, i) => (
            <g key={i} transform={`translate(0, ${i * 35})`}>
              <rect x="0" y="0" width="40" height="3" fill="currentColor" rx="1.5"/>
              <rect x="0" y="8" width="25" height="3" fill="currentColor" rx="1.5"/>
              <rect x="0" y="16" width="35" height="3" fill="currentColor" rx="1.5"/>
            </g>
          ))}
        </g>
        
        {/* Variable names */}
        <g transform="translate(140, 25)">
          {Array.from({ length: 6 }).map((_, i) => (
            <g key={i} transform={`translate(0, ${i * 30})`}>
              <rect x="0" y="0" width="8" height="8" fill="currentColor" rx="1"/>
              <rect x="12" y="2" width="20" height="2" fill="currentColor" rx="1"/>
              <rect x="12" y="6" width="15" height="2" fill="currentColor" rx="1"/>
            </g>
          ))}
        </g>
      </g>
    </svg>
  )
}
