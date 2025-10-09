'use client'

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
import { Building2, Users, Mail, FileText, Star, CheckCircle, ArrowRight, Sparkles, Zap, Clock, DollarSign, Phone, MapPin, Eye, MoreHorizontal, Play, Loader2, Search, Brain } from 'lucide-react'
import { useEffect, useState } from 'react'
export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [selectedJob, setSelectedJob] = useState<number | null>(null)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="min-h-screen bg-white relative">
      {/* Professional Construction Background Pattern */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-orange"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange/5 rounded-full blur-3xl"></div>
      </div>
      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 text-center relative z-10">
        <div className={`flex justify-center mb-8 transition-all duration-1000 delay-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="bg-gray-100 border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              <span>AI-Powered Plan Analysis</span>
            </div>
            <div className="bg-gray-100 border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Complete Automation</span>
            </div>
            <div className="bidi-orange-bg-light bidi-orange-text px-4 py-2 rounded-lg text-sm font-bold border border-orange/20 flex items-center space-x-2">
              <span>🚀</span>
              <span>Now in Beta</span>
            </div>
          </div>
        </div>
        
        <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 tracking-tight transition-all duration-1000 delay-500 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          Stop spending time on bidding.
          <span className="block bidi-orange-text">
            Let <span className="font-bidi">BIDI</span> Do It For You
          </span>
        </h1>
        
        <p className={`text-xl sm:text-2xl text-gray-600 mb-10 max-w-4xl mx-auto font-medium transition-all duration-1000 delay-700 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          From Job Posting to Final Payment
        </p>
        
        <div className={`flex flex-col sm:flex-row justify-center gap-6 transition-all duration-1000 delay-1000 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <Link href="/auth/signup">
            <Button 
              variant="orange"
              size="lg" 
              className="text-lg sm:text-xl px-8 sm:px-12 py-4 w-full sm:w-auto font-bold group"
            >
              Automate Your Bidding
              <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>
          </Link>
          <Button 
            variant="construction" 
            size="lg" 
            className="text-lg sm:text-xl px-8 sm:px-12 py-4 w-full sm:w-auto font-semibold group"
            onClick={() => document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Zap className="mr-2 h-5 w-5 group-hover:animate-pulse" />
            See How It Works
          </Button>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 relative z-10">

        {/* Interactive Dashboard Preview */}
        <div className={`max-w-6xl mx-auto transition-all duration-1000 delay-1200 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-2 border-gray-200">
            {/* Dashboard Header */}
            <div className="bg-white border-b-2 border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <img src="/brand/Bidi Contracting Logo.svg" alt="Bidi" className="h-8 w-8 sm:h-10 sm:w-10 text-black" />
              <h3 className="text-lg sm:text-2xl font-bold text-black"><span className="font-bidi">BIDI</span> Dashboard</h3>
            </div>
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-2 sm:px-3 py-1 sm:py-2 border border-gray-200">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-orange rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-xs sm:text-sm">MJ</span>
                    </div>
                    <span className="text-gray-700 text-xs sm:text-sm font-semibold hidden sm:inline">Mike Johnson</span>
                    <span className="text-gray-700 text-xs sm:text-sm font-semibold sm:hidden">MJ</span>
                  </div>
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-orange rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-4 sm:p-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
                <div className="bg-white rounded-lg p-3 sm:p-6 border-2 border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 font-semibold">Active Jobs</p>
                      <p className="text-xl sm:text-3xl font-bold text-black">3</p>
                    </div>
                    <Building2 className="h-6 w-6 sm:h-10 sm:w-10 text-gray-400" />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 sm:p-6 border-2 border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 font-semibold">Bids Received</p>
                      <p className="text-xl sm:text-3xl font-bold text-black">12</p>
                    </div>
                    <FileText className="h-6 w-6 sm:h-10 sm:w-10 text-gray-400" />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 sm:p-6 border-2 border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 font-semibold">Subcontractors</p>
                      <p className="text-xl sm:text-3xl font-bold text-black">8</p>
                    </div>
                    <Users className="h-6 w-6 sm:h-10 sm:w-10 text-gray-400" />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 sm:p-6 border-2 border-orange shadow-sm col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm bidi-orange-text font-semibold">Time Saved</p>
                      <p className="text-xl sm:text-3xl font-bold bidi-orange-text">24h</p>
                    </div>
                    <Clock className="h-6 w-6 sm:h-10 sm:w-10 bidi-orange-text" />
                  </div>
                </div>
              </div>

              {/* Recent Jobs */}
              <div className="mb-4 sm:mb-6">
                <h4 className="text-lg sm:text-xl font-bold text-black mb-4 sm:mb-6">Recent Job Searches</h4>
                <div className="space-y-2 sm:space-y-3">
                  {[
                    {
                      title: "Kitchen Renovation - Downtown",
                      status: "Bids Received",
                      bids: 5,
                      budget: "$45,000",
                      time: "2 hours ago",
                      color: "gray"
                    },
                    {
                      title: "Office Building HVAC",
                      status: "Searching...",
                      bids: 0,
                      budget: "$12,000",
                      time: "1 day ago",
                      color: "gray"
                    },
                    {
                      title: "Residential Roofing",
                      status: "Bids Ready",
                      bids: 7,
                      budget: "$8,500",
                      time: "2 days ago",
                      color: "gray"
                    }
                  ].map((job, index) => (
                    <div 
                      key={index} 
                      className={`bg-gray-50 rounded-lg p-3 sm:p-4 hover:bg-gray-100 transition-all duration-200 cursor-pointer group ${
                        selectedJob === index ? 'ring-2 ring-orange-500 bg-orange-50' : ''
                      }`}
                      onClick={() => setSelectedJob(selectedJob === index ? null : index)}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start space-y-2 sm:space-y-0">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200 text-sm sm:text-base truncate">
                            {job.title}
                          </h5>
                          <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
                            <span className="flex items-center">
                              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              {job.budget}
                            </span>
                            <span className="flex items-center">
                              <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              {job.bids} bids
                            </span>
                            <span className="text-gray-400">{job.time}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            job.color === 'green' ? 'bg-green-100 text-green-800' :
                            job.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {job.status}
                          </span>
                          {job.bids > 0 && (
                            <Button size="sm" className="text-xs px-2 py-1 h-auto">
                              View Bids
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Click to interact hint */}
          <div className="text-center mt-4 sm:mt-6">
            <p className="text-xs sm:text-sm text-gray-600 font-medium flex items-center justify-center">
              <span className="w-2 h-2 bg-orange rounded-full mr-2 animate-pulse"></span>
              Click anywhere to explore the dashboard
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 relative z-10">
        <h2 className={`text-3xl sm:text-4xl font-bold text-center text-black mb-4 tracking-tight transition-all duration-1000 delay-1200 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          Complete Bidding Automation
        </h2>
        <p className={`text-lg text-gray-600 text-center mb-12 max-w-3xl mx-auto transition-all duration-1000 delay-1200 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          From finding subcontractors to managing every detail, we handle it all so you can focus on building.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {[
            {
              icon: Search,
              title: "Find Subcontractors",
              description: "We automatically search and contact qualified subs in your area and trade, saving you hours of research.",
              color: "blue",
              delay: "delay-1400"
            },
            {
              icon: Users,
              title: "Collect Bids",
              description: "Handle all back-and-forth communications with subs and automatically collect and organize bids.",
              color: "green",
              delay: "delay-1600"
            },
            {
              icon: Brain,
              title: "AI Plan Analysis",
              description: "Our AI extracts key details from your plans so GCs know exactly what information they need.",
              color: "orange",
              delay: "delay-1800"
            },
            {
              icon: FileText,
              title: "Manage Paperwork",
              description: "Automate all back office paperwork including contracts, documentation, and administrative tasks.",
              color: "orange",
              delay: "delay-2000"
            }
          ].map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card 
                key={index}
                className={`transition-all duration-700 ease-out ${feature.delay} ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                } hover:scale-[1.02] hover:shadow-xl group border-2 border-gray-200 hover:border-gray-300 transform-gpu`}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'transform, box-shadow, border-color'
                }}
              >
                <CardHeader className="text-center p-6">
                  <div className={`w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-6 transition-all duration-500 ease-out group-hover:scale-110 group-hover:rotate-3 ${
                    feature.color === 'orange'
                      ? hoveredCard === index 
                        ? 'bg-orange shadow-xl shadow-orange/25' 
                        : 'bidi-orange-bg-light shadow-md'
                      : hoveredCard === index 
                        ? 'bg-gray-200 shadow-xl shadow-gray/25' 
                        : 'bg-gray-100 shadow-md'
                  }`}
                  style={{
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    willChange: 'transform, background-color, box-shadow'
                  }}>
                    <Icon className={`h-8 w-8 transition-all duration-500 ease-out ${
                      feature.color === 'orange'
                        ? hoveredCard === index 
                          ? 'text-white scale-110' 
                          : 'bidi-orange-text'
                        : hoveredCard === index 
                          ? 'text-gray-700 scale-110' 
                          : 'text-gray-600'
                    }`} 
                    style={{
                      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                      willChange: 'transform, color'
                    }} />
                  </div>
                  <CardTitle className="text-lg group-hover:text-black transition-colors duration-500 ease-out font-semibold">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-sm group-hover:text-gray-700 transition-colors duration-500 ease-out leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </section>




      {/* Demo Section */}
      <section id="demo-section" className="container mx-auto px-4 py-16 relative z-10">
        {/* Demo Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">
            See Complete Automation in Action
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto font-medium">
            Submit your project and watch as we find subs, collect bids, manage communications, and use AI to analyze your plans — all automatically.
          </p>
        </div>

        {/* Demo Content */}
        <DemoSection />
      </section>

            {/* CTA Section */}
            <section className="bg-white text-black py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className={`text-3xl sm:text-4xl font-bold mb-6 tracking-tight transition-all duration-1000 delay-3400 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            Ready to Automate Your Entire Bidding Process?
          </h2>
          <p className={`text-xl sm:text-2xl mb-10 font-medium transition-all duration-1000 delay-3600 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            Stop wasting time on manual work. Let us handle the entire bidding process for you.
            </p>
          <div className={`transition-all duration-1000 delay-3800 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <Link href="/auth/signup">
              <Button variant="orange" size="lg" className="text-lg sm:text-xl px-8 sm:px-12 py-4 font-bold">
                Get Started Now
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

// Demo Section Component
function DemoSection() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [showBids, setShowBids] = useState(false)
  const [projectSubmitted, setProjectSubmitted] = useState(false)
  const [projectForm, setProjectForm] = useState({
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
      description: 'Upload plans and provide project details - AI extracts key info',
      icon: Building2,
      color: 'blue',
      loadingText: 'Processing your project details...'
    },
    {
      title: 'Find & Contact Subs',
      description: 'Auto-search and reach out to qualified subcontractors',
      icon: Search,
      color: 'green',
      loadingText: 'Finding and contacting contractors...'
    },
    {
      title: 'Collect & Manage',
      description: 'Handle all communications, collect bids, manage paperwork',
      icon: Mail,
      color: 'purple',
      loadingText: 'Managing communications and paperwork...'
    },
    {
      title: 'AI-Leveled Results',
      description: 'AI analyzes and presents organized, comparable bids',
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
    <div className="space-y-8">
      {/* Project Submission Form */}
      {!projectSubmitted && (
        <Card className="max-w-2xl mx-auto border-2 border-gray-200 bg-white">
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
                    placeholder="Enter your location"
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
        <Card className="max-w-2xl mx-auto border-2 border-gray-200 bg-white">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <Card className="border-2 border-gray-200 bg-white">
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
            <h3 className="text-2xl font-bold text-black mb-2">
              Your Leveled Bids Are Ready!
            </h3>
            <p className="text-gray-600 mb-4">
              Our AI has analyzed and organized all received bids for easy comparison
            </p>
            <Button onClick={resetDemo} variant="construction" size="sm">
              Try Another Project
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
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
            ].map((bid, index) => (
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

                  <Link href="/auth/signup">
                    <Button variant="orange" className="w-full mt-4 font-bold">
                      Sign Up to Contact Contractors
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
