'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Building2
} from 'lucide-react'

export default function JobsPage() {
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
                <a href="mailto:jobs@bidi.com?subject=Software Engineer Application">
                  <Button size="lg" className="w-full sm:w-auto">
                    Apply Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
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
                    <a href="mailto:jobs@bidi.com?subject=Software Engineer Application">
                      <Button size="lg" className="w-full sm:w-auto">
                        Apply Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </a>
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
