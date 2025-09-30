'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import Link from 'next/link'
import { 
  Building2, 
  Mail, 
  Users, 
  FileText, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Phone,
  MapPin,
  ArrowRight,
  Play,
  Star,
  Loader2,
  Search,
  Zap,
  Brain
} from 'lucide-react'

interface DemoBid {
  id: string
  company: string
  contact: string
  phone: string
  email: string
  location: string
  price: string
  timeline: string
  rating: number
  specialties: string[]
  status: 'received' | 'analyzing' | 'ready'
}

const sampleBids: DemoBid[] = [
  {
    id: '1',
    company: 'Elite Construction Co.',
    contact: 'Mike Johnson',
    phone: '(555) 123-4567',
    email: 'mike@eliteconstruction.com',
    location: '5 miles away',
    price: '$45,000',
    timeline: '2-3 weeks',
    rating: 4.8,
    specialties: ['Residential', 'Commercial'],
    status: 'ready'
  },
  {
    id: '2',
    company: 'Premier Builders LLC',
    contact: 'Sarah Williams',
    phone: '(555) 987-6543',
    email: 'sarah@premierbuilders.com',
    location: '8 miles away',
    price: '$42,500',
    timeline: '3-4 weeks',
    rating: 4.6,
    specialties: ['Residential', 'Renovation'],
    status: 'ready'
  },
  {
    id: '3',
    company: 'Metro Construction',
    contact: 'David Chen',
    phone: '(555) 456-7890',
    email: 'david@metroconstruction.com',
    location: '12 miles away',
    price: '$48,000',
    timeline: '2 weeks',
    rating: 4.9,
    specialties: ['Commercial', 'Industrial'],
    status: 'ready'
  }
]

interface ProjectForm {
  projectType: string
  description: string
  budget: string
  timeline: string
  location: string
  squareFootage: string
}

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [showBids, setShowBids] = useState(false)
  const [projectSubmitted, setProjectSubmitted] = useState(false)
  const [projectForm, setProjectForm] = useState<ProjectForm>({
    projectType: '',
    description: '',
    budget: '',
    timeline: '',
    location: '',
    squareFootage: ''
  })
  const [loadingStep, setLoadingStep] = useState<string | null>(null)

  const steps = [
    {
      title: 'Submit Your Project',
      description: 'Provide basic project details and requirements',
      icon: Building2,
      color: 'blue',
      loadingText: 'Processing your project details...'
    },
    {
      title: 'Automated Search',
      description: 'Our system finds qualified subcontractors in your area',
      icon: Search,
      color: 'green',
      loadingText: 'Searching for qualified contractors...'
    },
    {
      title: 'Collect Bids',
      description: 'We automatically collect and organize incoming bids',
      icon: Users,
      color: 'purple',
      loadingText: 'Collecting bids from contractors...'
    },
    {
      title: 'AI Analysis',
      description: 'Our AI levels and presents all bids for easy comparison',
      icon: Brain,
      color: 'orange',
      loadingText: 'AI analyzing and leveling bids...'
    }
  ]

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProjectSubmitted(true)
    setCurrentStep(0)
    setIsRunning(true)
    setShowBids(false)
    
    // Step 1: Process project details
    setLoadingStep('Processing your project details...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    setCurrentStep(1)
    
    // Step 2: Search for contractors
    setLoadingStep('Searching for qualified contractors...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    setCurrentStep(2)
    
    // Step 3: Collect bids
    setLoadingStep('Collecting bids from contractors...')
    await new Promise(resolve => setTimeout(resolve, 2500))
    setCurrentStep(3)
    
    // Step 4: AI Analysis
    setLoadingStep('AI analyzing and leveling bids...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setShowBids(true)
    setIsRunning(false)
    setLoadingStep(null)
  }

  const fillSampleData = () => {
    setProjectForm({
      projectType: 'kitchen-renovation',
      description: 'Complete kitchen renovation with modern design, new cabinets, countertops, and appliances. Looking for high-quality work with attention to detail.',
      budget: '25k-50k',
      timeline: '1-month',
      location: 'Downtown, 5-mile radius',
      squareFootage: '200 sq ft'
    })
  }

  const resetDemo = () => {
    setCurrentStep(0)
    setShowBids(false)
    setIsRunning(false)
    setProjectSubmitted(false)
    setLoadingStep(null)
    setProjectForm({
      projectType: '',
      description: '',
      budget: '',
      timeline: '',
      location: '',
      squareFootage: ''
    })
  }

  return (
    <div className="min-h-screen bg-white relative">
      {/* Professional Construction Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-orange"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange/5 rounded-full blur-3xl"></div>
      </div>

      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Demo Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-black mb-4">
            See How Our Search Tool Works
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto font-medium">
            Submit your project details and watch our automated system find subcontractors, collect bids, and present them in an easy-to-read format.
          </p>
        </div>

        {/* Project Submission Form */}
        {!projectSubmitted && (
          <Card className="mb-12 max-w-2xl mx-auto border-2 border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2 text-black" />
                Submit Your Project Details
              </CardTitle>
              <CardDescription className="font-medium text-gray-600">
                Fill out the form below to see how our system works with your specific project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectType">Project Type</Label>
                    <Select 
                      value={projectForm.projectType} 
                      onValueChange={(value) => setProjectForm({...projectForm, projectType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kitchen-renovation">Kitchen Renovation</SelectItem>
                        <SelectItem value="bathroom-remodel">Bathroom Remodel</SelectItem>
                        <SelectItem value="home-addition">Home Addition</SelectItem>
                        <SelectItem value="roofing">Roofing</SelectItem>
                        <SelectItem value="flooring">Flooring</SelectItem>
                        <SelectItem value="electrical">Electrical Work</SelectItem>
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="hvac">HVAC</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="squareFootage">Square Footage</Label>
                    <Input
                      id="squareFootage"
                      type="text"
                      placeholder="e.g., 200 sq ft"
                      value={projectForm.squareFootage}
                      onChange={(e) => setProjectForm({...projectForm, squareFootage: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Project Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your project in detail..."
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({...projectForm, description: e.target.value})}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget Range</Label>
                    <Select 
                      value={projectForm.budget} 
                      onValueChange={(value) => setProjectForm({...projectForm, budget: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select budget" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="under-10k">Under $10,000</SelectItem>
                        <SelectItem value="10k-25k">$10,000 - $25,000</SelectItem>
                        <SelectItem value="25k-50k">$25,000 - $50,000</SelectItem>
                        <SelectItem value="50k-100k">$50,000 - $100,000</SelectItem>
                        <SelectItem value="over-100k">Over $100,000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="timeline">Timeline</Label>
                    <Select 
                      value={projectForm.timeline} 
                      onValueChange={(value) => setProjectForm({...projectForm, timeline: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timeline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asap">ASAP</SelectItem>
                        <SelectItem value="1-2-weeks">1-2 weeks</SelectItem>
                        <SelectItem value="1-month">1 month</SelectItem>
                        <SelectItem value="2-3-months">2-3 months</SelectItem>
                        <SelectItem value="flexible">Flexible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      type="text"
                      placeholder="e.g., Downtown, 5-mile radius"
                      value={projectForm.location}
                      onChange={(e) => setProjectForm({...projectForm, location: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    type="button"
                    variant="construction" 
                    size="lg" 
                    className="flex-1"
                    onClick={fillSampleData}
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Fill Sample Data
                  </Button>
                  <Button 
                    type="submit" 
                    size="lg" 
                    variant="orange"
                    className="flex-1 font-bold"
                    disabled={!projectForm.projectType || !projectForm.description || !projectForm.budget}
                  >
                    <Zap className="h-5 w-5 mr-2" />
                    Submit Project & Start Demo
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isRunning && loadingStep && (
          <Card className="mb-12 max-w-2xl mx-auto border-2 border-gray-200 bg-white">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-black" />
                </div>
                <h3 className="text-lg font-semibold text-black">{loadingStep}</h3>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-black h-2 rounded-full transition-all duration-500"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Demo Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep >= index
            const isCurrent = currentStep === index
            
            return (
              <Card 
                key={index}
                className={`transition-all duration-500 border-2 ${
                  isActive 
                    ? 'border-orange shadow-lg' 
                    : 'border-gray-200 opacity-60'
                } ${isCurrent ? 'scale-105' : ''} bg-white`}
              >
                <CardHeader className="text-center">
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                    isActive ? 'bidi-orange-bg-light' : 'bg-gray-100'
                  }`}>
                    <Icon className={`h-8 w-8 ${isActive ? 'bidi-orange-text' : 'text-gray-400'}`} />
                  </div>
                  <CardTitle className={`text-lg ${
                    isActive ? 'text-black' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {step.description}
                  </CardDescription>
                  {isCurrent && isRunning && (
                    <div className="mt-2">
                      <Badge variant="orange">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        In Progress...
                      </Badge>
                    </div>
                  )}
                  {isActive && !isCurrent && (
                    <div className="mt-2">
                      <CheckCircle className="h-5 w-5 text-gray-700 mx-auto" />
                    </div>
                  )}
                </CardHeader>
              </Card>
            )
          })}
        </div>

        {/* Project Details */}
        {projectSubmitted && (
          <Card className="mb-8 border-2 border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Building2 className="h-5 w-5 mr-2 text-black" />
                  Your Project: {projectForm.projectType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <Button onClick={resetDemo} variant="construction" size="sm">
                  Reset Demo
                </Button>
              </CardTitle>
              <CardDescription>
                {projectForm.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <strong>Budget:</strong> {projectForm.budget.replace('-', ' - ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div>
                  <strong>Timeline:</strong> {projectForm.timeline.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div>
                  <strong>Location:</strong> {projectForm.location || 'Not specified'}
                </div>
                <div>
                  <strong>Size:</strong> {projectForm.squareFootage || 'Not specified'}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {showBids && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-black mb-2">
                Your Leveled Bids Are Ready!
              </h2>
              <p className="text-gray-600 mb-4">
                Our AI has analyzed and organized all received bids for easy comparison
              </p>
              <Button onClick={resetDemo} variant="construction" size="sm">
                Try Another Project
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {sampleBids.map((bid, index) => (
                <Card key={bid.id} className="relative border-2 border-gray-200 bg-white">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{bid.company}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <MapPin className="h-4 w-4 mr-1" />
                          {bid.location}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="bidi-orange-bg-light bidi-orange-text border border-orange/20">
                        #{index + 1} Choice
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-700" />
                        <span className="font-semibold text-lg">{bid.price}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-700" />
                        <span>{bid.timeline}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className="text-sm font-medium">Contact:</span>
                        <span className="text-sm ml-2">{bid.contact}</span>
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-sm">{bid.phone}</span>
                      </div>
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-sm">{bid.email}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className="text-sm font-medium">Rating:</span>
                        <div className="flex ml-2">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`h-4 w-4 ${
                                i < Math.floor(bid.rating) 
                                  ? 'text-yellow-400 fill-current' 
                                  : 'text-gray-300'
                              }`} 
                            />
                          ))}
                          <span className="text-sm ml-1">{bid.rating}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {bid.specialties.map((specialty) => (
                          <Badge key={specialty} variant="outline" className="text-xs">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button variant="orange" className="w-full mt-4 font-bold">
                      Contact This Contractor
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="text-center mt-12 p-8 bg-white rounded-lg shadow-lg border-2 border-gray-200">
          <h2 className="text-2xl font-bold text-black mb-4">
            Ready to Try This for Your Project?
          </h2>
          <p className="text-gray-600 mb-6">
            Stop wasting time searching for subcontractors. Let our automated system do the work for you.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth/signup">
              <Button size="lg" variant="orange" className="text-base px-8 py-3 font-bold">
                Start Your Search Now
              </Button>
            </Link>
            <Link href="/">
              <Button variant="construction" size="lg" className="text-base px-8 py-3">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}