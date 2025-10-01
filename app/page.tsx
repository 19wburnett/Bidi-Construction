'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import Link from 'next/link'
import { Building2, Users, Mail, FileText, Star, CheckCircle, ArrowRight, Sparkles, Zap, Clock, DollarSign, Phone, MapPin, Eye, MoreHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import logo from '../public/brand/Bidi Contracting Logo.svg'
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
              <Sparkles className="h-4 w-4" />
              <span>AI-Powered Bid Analysis</span>
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
          Find the Best Subcontractors
          <span className="block bidi-orange-text">
            Automatically
          </span>
        </h1>
        
        <p className={`text-xl sm:text-2xl text-gray-600 mb-10 max-w-4xl mx-auto font-medium transition-all duration-1000 delay-700 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          Our automated system searches for qualified subcontractors, collects their bids, and presents them in an easy-to-read format. 
          Get competitive pricing and contact information instantly - no more manual searching or waiting for responses.
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
              Start Searching Now
              <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>
          </Link>
          <Link href="/demo">
            <Button 
              variant="construction" 
              size="lg" 
              className="text-lg sm:text-xl px-8 sm:px-12 py-4 w-full sm:w-auto font-semibold group"
            >
              <Zap className="mr-2 h-5 w-5 group-hover:animate-pulse" />
              See How It Works
            </Button>
          </Link>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="container mx-auto px-4 py-16 relative z-10">
        <div className={`text-center mb-12 transition-all duration-1000 delay-1000 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <h2 className="text-3xl sm:text-4xl font-bold text-black mb-6 tracking-tight">
            Professional Construction Management
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto font-medium">
            See how Bidi streamlines your subcontractor search process with a clean, professional interface designed for construction professionals
          </p>
        </div>

        {/* Interactive Dashboard Preview */}
        <div className={`max-w-6xl mx-auto transition-all duration-1000 delay-1200 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-2 border-gray-200">
            {/* Dashboard Header */}
            <div className="bg-white border-b-2 border-gray-200 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <img src={logo.src} alt="Bidi" className="h-10 w-10 text-black" />
                  <h3 className="text-2xl font-bold text-black">Bidi Dashboard</h3>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2 border border-gray-200">
                    <div className="w-8 h-8 bg-orange rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">MJ</span>
                    </div>
                    <span className="text-gray-700 text-sm font-semibold">Mike Johnson</span>
                  </div>
                  <div className="w-3 h-3 bg-orange rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg p-6 border-2 border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Active Jobs</p>
                      <p className="text-3xl font-bold text-black">3</p>
                    </div>
                    <Building2 className="h-10 w-10 text-gray-400" />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-6 border-2 border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Bids Received</p>
                      <p className="text-3xl font-bold text-black">12</p>
                    </div>
                    <FileText className="h-10 w-10 text-gray-400" />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-6 border-2 border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Subcontractors</p>
                      <p className="text-3xl font-bold text-black">8</p>
                    </div>
                    <Users className="h-10 w-10 text-gray-400" />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-6 border-2 border-orange shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm bidi-orange-text font-semibold">Time Saved</p>
                      <p className="text-3xl font-bold bidi-orange-text">24h</p>
                    </div>
                    <Clock className="h-10 w-10 bidi-orange-text" />
                  </div>
                </div>
              </div>

              {/* Recent Jobs */}
              <div className="mb-6">
                <h4 className="text-xl font-bold text-black mb-6">Recent Job Searches</h4>
                <div className="space-y-3">
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
                      className={`bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-all duration-200 cursor-pointer group ${
                        selectedJob === index ? 'ring-2 ring-orange-500 bg-orange-50' : ''
                      }`}
                      onClick={() => setSelectedJob(selectedJob === index ? null : index)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                            {job.title}
                          </h5>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                            <span className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-1" />
                              {job.budget}
                            </span>
                            <span className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {job.bids} bids
                            </span>
                            <span className="text-gray-400">{job.time}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            job.color === 'green' ? 'bg-green-100 text-green-800' :
                            job.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {job.status}
                          </span>
                          {job.bids > 0 && (
                            <Button size="sm" className="text-xs">
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
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600 font-medium flex items-center justify-center">
              <span className="w-2 h-2 bg-orange rounded-full mr-2 animate-pulse"></span>
              Click anywhere to explore the dashboard
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 relative z-10">
        <h2 className={`text-3xl sm:text-4xl font-bold text-center text-black mb-12 tracking-tight transition-all duration-1000 delay-1200 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          How Our Search Tool Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {[
            {
              icon: Building2,
              title: "1. Submit Your Job",
              description: "Simply provide your project details, location, and requirements. Our system handles the rest.",
              color: "blue",
              delay: "delay-1400"
            },
            {
              icon: Mail,
              title: "2. Automated Search",
              description: "Our system automatically finds and contacts qualified subcontractors in your area and trade.",
              color: "green",
              delay: "delay-1600"
            },
            {
              icon: Users,
              title: "3. Collect Bids",
              description: "We automatically collect and organize all incoming bids with pricing and contact information.",
              color: "purple",
              delay: "delay-1800"
            },
            {
              icon: FileText,
              title: "4. AI-Leveled Results",
              description: "Our AI analyzes and presents all bids in an easy-to-read format for quick comparison and decision making.",
              color: "orange",
              delay: "delay-2000"
            }
          ].map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card 
                key={index}
                className={`transition-all duration-1000 ${feature.delay} ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                } hover:scale-105 hover:shadow-lg group cursor-pointer border-2 border-gray-200 hover:border-gray-300`}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <CardHeader className="text-center">
                  <div className={`w-16 h-16 mx-auto rounded-lg flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 ${
                    feature.color === 'orange'
                      ? hoveredCard === index 
                        ? 'bg-orange shadow-lg' 
                        : 'bidi-orange-bg-light'
                      : hoveredCard === index 
                        ? 'bg-gray-200 shadow-lg' 
                        : 'bg-gray-100'
                  }`}>
                    <Icon className={`h-8 w-8 transition-all duration-300 ${
                      feature.color === 'orange'
                        ? hoveredCard === index 
                          ? 'text-white scale-110' 
                          : 'bidi-orange-text'
                        : hoveredCard === index 
                          ? 'text-gray-700 scale-110' 
                          : 'text-gray-600'
                    }`} />
                  </div>
                  <CardTitle className="text-lg group-hover:text-black transition-colors duration-300">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-sm group-hover:text-gray-700 transition-colors duration-300">
                    {feature.description}
                  </CardDescription>
                  {hoveredCard === index && (
                    <div className="mt-2">
                      <div className={`w-full h-1 rounded-full animate-pulse ${
                        feature.color === 'orange' ? 'bg-orange' : 'bg-gray-400'
                      }`}></div>
                    </div>
                  )}
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </section>


      {/* CTA Section */}
      <section className="bg-white text-black py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className={`text-3xl sm:text-4xl font-bold mb-6 tracking-tight transition-all duration-1000 delay-3400 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            Ready to Find Subcontractors Automatically?
          </h2>
          <p className={`text-xl sm:text-2xl mb-10 font-medium transition-all duration-1000 delay-3600 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            Stop wasting time searching for subcontractors. Let our automated system find, contact, and collect bids for you.
          </p>
          <div className={`transition-all duration-1000 delay-3800 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <Link href="/auth/signup">
              <Button variant="orange" size="lg" className="text-lg sm:text-xl px-8 sm:px-12 py-4 font-bold">
                Start Your Search Now
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
