'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Navbar from '@/components/navbar'
import Link from 'next/link'
import { Building2, Users, Mail, FileText, Star, CheckCircle, ArrowRight, Sparkles, Zap, Clock, DollarSign, Phone, MapPin, Eye, MoreHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [selectedJob, setSelectedJob] = useState<number | null>(null)

  useEffect(() => {
    setIsVisible(true)
  }, [])

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
        <div className={`flex justify-center mb-6 transition-all duration-1000 delay-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center space-x-2">
            <Sparkles className="h-4 w-4 animate-spin" />
            <span>AI-Powered Bid Analysis</span>
          </div>
        </div>
        
        <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 transition-all duration-1000 delay-500 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          Find the Best Subcontractors
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
            {' '}Automatically
          </span>
        </h1>
        
        <p className={`text-lg sm:text-xl text-gray-600 mb-8 max-w-3xl mx-auto transition-all duration-1000 delay-700 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          Our automated system searches for qualified subcontractors, collects their bids, and presents them in an easy-to-read format. 
          Get competitive pricing and contact information instantly - no more manual searching or waiting for responses.
        </p>
        
        <div className={`flex flex-col sm:flex-row justify-center gap-4 transition-all duration-1000 delay-1000 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <Link href="/auth/signup">
            <Button 
              size="lg" 
              className="text-base sm:text-lg px-6 sm:px-8 py-3 w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
            >
              Start Searching Now
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>
          </Link>
          <Link href="/demo">
            <Button 
              variant="outline" 
              size="lg" 
              className="text-base sm:text-lg px-6 sm:px-8 py-3 w-full sm:w-auto border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-300 hover:scale-105 group"
            >
              <Zap className="mr-2 h-5 w-5 group-hover:animate-pulse" />
              See How It Works
            </Button>
          </Link>
        </div>

        {/* Floating Icons */}
        <div className="absolute top-20 left-10 animate-bounce delay-1000">
          <Building2 className="h-8 w-8 text-blue-300 opacity-60" />
        </div>
        <div className="absolute top-32 right-16 animate-bounce delay-2000">
          <Users className="h-6 w-6 text-purple-300 opacity-60" />
        </div>
        <div className="absolute bottom-20 left-20 animate-bounce delay-3000">
          <FileText className="h-7 w-7 text-green-300 opacity-60" />
        </div>
        <div className="absolute bottom-32 right-10 animate-bounce delay-4000">
          <Mail className="h-5 w-5 text-pink-300 opacity-60" />
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 relative z-10">
        <div className={`text-center mb-8 transition-all duration-1000 delay-1000 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            See Your Dashboard in Action
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Here's what your dashboard looks like when you're actively using Bidi to find subcontractors
          </p>
        </div>

        {/* Interactive Dashboard Preview */}
        <div className={`max-w-6xl mx-auto transition-all duration-1000 delay-1200 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
            {/* Dashboard Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <Building2 className="h-8 w-8 text-white" />
                  <h3 className="text-xl font-bold text-white">Bidi Dashboard</h3>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-1">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-sm">MJ</span>
                    </div>
                    <span className="text-white text-sm font-medium">Mike Johnson</span>
                  </div>
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Active Jobs</p>
                      <p className="text-2xl font-bold text-blue-900">3</p>
                    </div>
                    <Building2 className="h-8 w-8 text-blue-500" />
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Bids Received</p>
                      <p className="text-2xl font-bold text-green-900">12</p>
                    </div>
                    <FileText className="h-8 w-8 text-green-500" />
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Subcontractors</p>
                      <p className="text-2xl font-bold text-purple-900">8</p>
                    </div>
                    <Users className="h-8 w-8 text-purple-500" />
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-600 font-medium">Time Saved</p>
                      <p className="text-2xl font-bold text-orange-900">24h</p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-500" />
                  </div>
                </div>
              </div>

              {/* Recent Jobs */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Job Searches</h4>
                <div className="space-y-3">
                  {[
                    {
                      title: "Kitchen Renovation - Downtown",
                      status: "Bids Received",
                      bids: 5,
                      budget: "$45,000",
                      time: "2 hours ago",
                      color: "green"
                    },
                    {
                      title: "Office Building HVAC",
                      status: "Searching...",
                      bids: 0,
                      budget: "$12,000",
                      time: "1 day ago",
                      color: "blue"
                    },
                    {
                      title: "Residential Roofing",
                      status: "Bids Ready",
                      bids: 7,
                      budget: "$8,500",
                      time: "2 days ago",
                      color: "purple"
                    }
                  ].map((job, index) => (
                    <div 
                      key={index} 
                      className={`bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-all duration-200 cursor-pointer group ${
                        selectedJob === index ? 'ring-2 ring-blue-500 bg-blue-50' : ''
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

              {/* Quick Actions */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h4>
                <div className="flex flex-wrap gap-3">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Building2 className="h-4 w-4 mr-2" />
                    Start New Search
                  </Button>
                  <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white">
                    <FileText className="h-4 w-4 mr-2" />
                    View All Bids
                  </Button>
                  <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Contacts
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Click to interact hint */}
          <div className="text-center mt-4">
            <p className="text-sm text-gray-500 flex items-center justify-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
              Click anywhere to explore the dashboard
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 relative z-10">
        <h2 className={`text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12 transition-all duration-1000 delay-1200 ${
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
                } hover:scale-105 hover:shadow-xl group cursor-pointer`}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <CardHeader className="text-center">
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 ${
                    hoveredCard === index 
                      ? `bg-${feature.color}-200 shadow-lg` 
                      : `bg-${feature.color}-100`
                  }`}>
                    <Icon className={`h-8 w-8 transition-all duration-300 ${
                      hoveredCard === index 
                        ? `text-${feature.color}-700 scale-110` 
                        : `text-${feature.color}-600`
                    }`} />
                  </div>
                  <CardTitle className="text-lg group-hover:text-blue-600 transition-colors duration-300">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-sm group-hover:text-gray-700 transition-colors duration-300">
                    {feature.description}
                  </CardDescription>
                  {hoveredCard === index && (
                    <div className="mt-2">
                      <div className="w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
                    </div>
                  )}
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
            Why Choose Our Automated Search Tool?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Save Time</h3>
              <p className="text-gray-600">
                No more manual searching, calling, or waiting for responses. Our system does the work for you.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Get Better Bids</h3>
              <p className="text-gray-600">
                Access a wider network of qualified subcontractors and receive competitive, leveled bids.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Easy Comparison</h3>
              <p className="text-gray-600">
                All bids are organized and presented in a clear, easy-to-read format with contact information ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-8 sm:py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Find Subcontractors Automatically?
          </h2>
          <p className="text-lg sm:text-xl mb-8 opacity-90">
            Stop wasting time searching for subcontractors. Let our automated system find, contact, and collect bids for you.
          </p>
          <Link href="/auth/signup">
            <Button variant="secondary" size="lg" className="text-base sm:text-lg px-6 sm:px-8 py-3">
              Start Your Search Now
            </Button>
          </Link>
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
