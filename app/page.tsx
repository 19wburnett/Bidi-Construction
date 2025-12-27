'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PublicLayout from '@/components/public-layout'
import Link from 'next/link'
import { Users, Mail, FileText, Star, CheckCircle, ArrowRight, Zap, Clock, DollarSign, Phone, MapPin, Play, Search, Brain, AlertCircle, ChevronDown, Calendar } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { StructuredData } from '@/components/structured-data'
import { getBlogPosts } from '@/lib/blog/posts'

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [selectedJob, setSelectedJob] = useState<number | null>(null)
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    setIsVisible(true)

    // Intersection Observer for scroll-triggered animations
    const observerOptions = {
      threshold: 0.2, // Trigger when 20% of element is visible
      rootMargin: '0px 0px -100px 0px' // Start slightly before element enters viewport
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

    // Observe all sections with data-section-id attribute
    const sections = document.querySelectorAll('[data-section-id]')
    sections.forEach(section => observer.observe(section))

    return () => {
      sections.forEach(section => observer.unobserve(section))
    }
  }, [])

  return (
    <>
      {/* SEO Structured Data for Homepage */}
      <StructuredData
        type="LocalBusiness"
        data={{
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: 'BIDI Construction',
          description: 'AI-powered construction estimating and automated bid management platform serving General Contractors across the United States.',
          url: process.env.NEXT_PUBLIC_APP_URL || 'https://bidicontracting.com',
          areaServed: {
            '@type': 'Country',
            name: 'United States',
          },
          serviceType: [
            'Construction Estimating Software',
            'Bid Management Platform',
            'AI-Powered Takeoff',
            'Construction Bid Collection',
          ],
          knowsAbout: [
            'Construction Estimating',
            'Bid Management',
            'Construction Takeoff',
            'General Contracting',
            'Subcontractor Management',
          ],
        }}
      />
      <PublicLayout>
        <div className="min-h-screen bg-white dark:bg-black relative overflow-hidden transition-colors duration-300">
          {/* Professional Construction Background Pattern */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-orange-50/60 dark:from-black dark:via-black dark:to-orange-950/40"></div>
            
            {/* Top accent line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange via-orange to-transparent"></div>
            
            {/* Tire track patterns - visible but subtle */}
            <div className="absolute top-32 left-10 w-80 h-80 opacity-[0.12] rotate-12 text-gray-500">
              <TireTrackPattern />
            </div>
            <div className="absolute top-[500px] right-20 w-64 h-64 opacity-[0.12] -rotate-45 text-gray-500">
              <TireTrackPattern />
            </div>
            <div className="absolute bottom-96 left-1/4 w-72 h-72 opacity-[0.10] rotate-[30deg] text-orange">
              <TireTrackPattern />
            </div>
            <div className="absolute bottom-40 right-1/3 w-56 h-56 opacity-[0.12] -rotate-12 text-gray-500">
              <TireTrackPattern />
            </div>
            
            {/* Gradient orbs for depth */}
            <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-gradient-radial from-orange/12 to-transparent blur-3xl"></div>
            <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-gradient-radial from-gray-500/12 to-transparent blur-3xl"></div>
            <div className="absolute top-2/3 left-1/3 w-80 h-80 bg-gradient-radial from-orange/10 to-transparent blur-2xl"></div>
            
            {/* Additional diagonal accent lines */}
            <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange/15 to-transparent"></div>
            <div className="absolute bottom-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-500/15 to-transparent"></div>
            
            {/* Dot pattern for texture */}
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle, rgba(235, 80, 35, 0.04) 1px, transparent 1px)',
              backgroundSize: '50px 50px'
            }}></div>
          </div>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 text-center relative z-10">
        <div className={`flex justify-center mb-8 transition-all duration-1000 delay-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="bg-gray-100 border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              <span>AI Estimator</span>
            </div>
            <div className="bg-gray-100 border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Automated Takeoff</span>
            </div>
            <div className="bidi-orange-bg-light bidi-orange-text px-4 py-2 rounded-lg text-sm font-bold border border-orange/20 flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Complete Bid Management</span>
            </div>
          </div>
        </div>
        
        <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-6 tracking-tight transition-all duration-1000 delay-500 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          AI-Powered Estimating & Takeoff
          <span className="block bidi-orange-text">
            Built for Contractors
          </span>
        </h1>
        
        <p className={`text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-10 max-w-4xl mx-auto font-medium transition-all duration-1000 delay-700 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          From automated plan analysis to final bid delivery — we handle everything
        </p>
        
        <div className={`flex flex-col sm:flex-row justify-center gap-6 transition-all duration-1000 delay-1000 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <a href="https://calendar.app.google/NeVX7M4JfPJaGYD9A" target="_blank" rel="noopener noreferrer">
            <Button 
              variant="orange"
              size="lg" 
              className="text-lg sm:text-xl px-8 sm:px-12 py-4 w-full sm:w-auto font-bold group"
            >
              Request a Demo
              <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>
          </a>
          <Button 
            variant="construction" 
            size="lg" 
            className="text-lg sm:text-xl px-8 sm:px-12 py-4 w-full sm:w-auto font-semibold group"
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Zap className="mr-2 h-5 w-5 group-hover:animate-pulse" />
            See How It Works
          </Button>
        </div>

        {/* 3D Dashboard Preview */}
        <div className={`mt-16 sm:mt-20 transition-all duration-1000 delay-1200 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
        }`}>
          <HeroPlanVisual />
        </div>
      </section>

      {/* Problem Section */}
      <section className="bg-gray-50 dark:bg-black py-12 sm:py-16 relative z-10 overflow-hidden transition-colors duration-300">
        {/* Section decorative elements */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange/20 to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-orange/12 dark:bg-orange/20 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 construction-grid opacity-50 dark:opacity-30 -z-10"></div>
        <div className="container mx-auto px-4">
          <div className={`text-center mb-8 sm:mb-12 transition-all duration-1000 delay-1200 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-3 sm:mb-4 tracking-tight px-4">
              Stop Losing Time on Manual Processes
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
              General Contractors waste countless hours on tasks that should be automated
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {/* Problem 1: Manual Plan Analysis */}
            <div className={`bg-white dark:bg-gray-950 rounded-lg p-4 sm:p-6 border-2 border-red-200 dark:border-red-900 transition-all duration-700 delay-1400 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            } hover:border-red-300 dark:hover:border-red-700 group`}>
              <div className="flex flex-col items-center justify-center min-h-[160px] sm:min-h-[180px]">
                <div className="relative mb-3 sm:mb-4">
                  {/* Spinning clock showing time wasting */}
                  <Clock className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 dark:text-red-400 animate-slow-spin" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-red-600 dark:text-red-300 text-[10px] sm:text-xs font-bold">8h</span>
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 mb-1">Manual Plan Analysis</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-center px-2">Hours spent reviewing every detail</p>
              </div>
            </div>

            {/* Problem 2: Missing Critical Details */}
            <div className={`bg-white dark:bg-gray-950 rounded-lg p-4 sm:p-6 border-2 border-red-200 dark:border-red-900 transition-all duration-700 delay-1600 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            } hover:border-red-300 dark:hover:border-red-700 group`}>
              <div className="flex flex-col items-center justify-center min-h-[160px] sm:min-h-[180px]">
                <div className="relative mb-3 sm:mb-4">
                  {/* Document with holes/missing pieces */}
                  <div className="relative">
                    <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 dark:text-red-400" />
                    {/* Missing pieces indicators */}
                    <div className="absolute top-1 sm:top-2 right-1 sm:right-2 w-2 h-2 sm:w-3 sm:h-3 bg-red-600 dark:bg-red-400 rounded-full animate-ping"></div>
                    <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 w-2 h-2 sm:w-3 sm:h-3 bg-red-600 dark:bg-red-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                    <div className="absolute top-1/2 left-1/2 w-2 h-2 sm:w-3 sm:h-3 bg-red-600 dark:bg-red-400 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 mb-1">Missing Critical Details</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-center px-2">Incomplete specs lead to change orders</p>
              </div>
            </div>

            {/* Problem 3: Sub Communication Overload */}
            <div className={`bg-white dark:bg-gray-950 rounded-lg p-4 sm:p-6 border-2 border-red-200 dark:border-red-900 transition-all duration-700 delay-1800 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            } hover:border-red-300 dark:hover:border-red-700 group`}>
              <div className="flex flex-col items-center justify-center min-h-[160px] sm:min-h-[180px]">
                <div className="relative mb-3 sm:mb-4">
                  {/* Multiple overlapping mail icons */}
                  <div className="relative w-16 h-12 sm:w-20 sm:h-16">
                    <Mail className="absolute top-0 left-0 h-10 w-10 sm:h-12 sm:w-12 text-red-400 dark:text-red-300 animate-bounce" />
                    <Mail className="absolute top-1 sm:top-2 left-3 sm:left-4 h-10 w-10 sm:h-12 sm:w-12 text-red-500 dark:text-red-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <Mail className="absolute top-2 sm:top-4 left-6 sm:left-8 h-10 w-10 sm:h-12 sm:w-12 text-red-600 dark:text-red-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                  {/* Badge showing count */}
                  <div className="absolute -top-2 -right-2 w-7 h-7 sm:w-8 sm:h-8 bg-red-600 dark:bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs animate-pulse">
                    47
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 mb-1">Communication Overload</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-center px-2">Endless emails, calls & follow-ups</p>
              </div>
            </div>

            {/* Problem 4: Difficult Bid Comparison */}
            <div className={`bg-white dark:bg-gray-950 rounded-lg p-4 sm:p-6 border-2 border-red-200 dark:border-red-900 transition-all duration-700 delay-2000 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            } hover:border-red-300 dark:hover:border-red-700 group`}>
              <div className="flex flex-col items-center justify-center min-h-[160px] sm:min-h-[180px]">
                <div className="relative mb-3 sm:mb-4">
                  {/* Scattered/disorganized documents */}
                  <div className="relative w-16 h-12 sm:w-20 sm:h-16">
                    <div className="absolute top-0 left-1 sm:left-2 w-8 h-11 sm:w-10 sm:h-14 bg-red-100 dark:bg-red-900 border-2 border-red-300 dark:border-red-700 rounded transform -rotate-12 animate-wiggle"></div>
                    <div className="absolute top-0.5 sm:top-1 left-4 sm:left-6 w-8 h-11 sm:w-10 sm:h-14 bg-red-200 dark:bg-red-800 border-2 border-red-400 dark:border-red-600 rounded transform rotate-6 animate-wiggle" style={{ animationDelay: '0.3s' }}></div>
                    <div className="absolute top-1 sm:top-2 left-7 sm:left-10 w-8 h-11 sm:w-10 sm:h-14 bg-red-300 dark:bg-red-700 border-2 border-red-500 rounded transform rotate-12 animate-wiggle" style={{ animationDelay: '0.6s' }}></div>
                  </div>
                  <DollarSign className="absolute bottom-0 right-0 h-7 w-7 sm:h-8 sm:w-8 text-red-600 dark:text-red-400 animate-pulse" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 mb-1">Difficult Comparison</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-center px-2">Inconsistent formats & confusion</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container mx-auto px-4 py-12 sm:py-16 relative z-10 overflow-hidden">
        {/* Decorative gradient line */}
        <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-orange/30 to-transparent"></div>
        {/* Subtle blueprint grid in background */}
        <div className="absolute inset-0 blueprint-grid opacity-50 -z-10"></div>
        <div className={`text-center mb-12 sm:mb-16 transition-all duration-1000 delay-1800 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-3 sm:mb-4 tracking-tight px-4">
            How <span className="font-bidi bidi-orange-text">BIDI</span> Works
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
            Five automated steps from plan upload to bid delivery
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {[
            {
              step: "01",
              title: "Upload Your Plans",
              description: "Upload construction plans and our AI instantly extracts materials, labor requirements, and generates cost estimates",
              icon: FileText,
              color: "blue"
            },
            {
              step: "02",
              title: "AI Analysis & Takeoff",
              description: "Our AI identifies missing details in your plans and creates a comprehensive takeoff, ensuring nothing is overlooked",
              icon: Brain,
              color: "purple"
            },
            {
              step: "03",
              title: "Automatic Sub Outreach",
              description: "We contact qualified subcontractors from your network and ours, sending complete job details automatically",
              icon: Search,
              color: "green"
            },
            {
              step: "04",
              title: "Complete Bid Management",
              description: "We handle all communications—email, text, phone—going back and forth until bids cover everything needed",
              icon: Users,
              color: "indigo"
            },
            {
              step: "05",
              title: "Leveled Bids Delivered",
              description: "Receive organized, comparable bids with AI-powered analysis to help you make informed decisions quickly",
              icon: CheckCircle,
              color: "orange"
            }
          ].map((workflow, index) => {
            const Icon = workflow.icon
            const isEven = index % 2 === 0
            const sectionId = `workflow-${index}`
            const isSectionVisible = visibleSections.has(sectionId)
            
            return (
                    <div 
                      key={index} 
                data-section-id={sectionId}
                className={`flex flex-col md:flex-row items-center gap-4 sm:gap-6 lg:gap-8 mb-8 sm:mb-12 transition-all duration-700 ${
                  isSectionVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                } ${isEven ? '' : 'md:flex-row-reverse'}`}
              >
                <div className="flex-1 w-full">
                  <div className="flex items-center mb-3 sm:mb-4">
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-bold bidi-orange-text mr-3 sm:mr-4">{workflow.step}</span>
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl ${
                      workflow.color === 'orange' ? 'bidi-orange-bg-light' : 'bg-gray-100'
                    } flex items-center justify-center`}>
                      <Icon className={`h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 ${
                        workflow.color === 'orange' ? 'bidi-orange-text' : 'text-gray-700'
                      }`} />
                          </div>
                        </div>
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-black dark:text-white mb-2 sm:mb-3">{workflow.title}</h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">{workflow.description}</p>
                </div>
                <div className="flex-1 w-full">
                  {/* Component Visualization based on step */}
                  {index === 0 && (
                    <div className="bg-white dark:bg-gray-950 rounded-xl p-4 sm:p-6 border-2 border-gray-200 dark:border-gray-700 min-h-[180px] sm:min-h-[200px] shadow-sm transition-colors duration-300">
                      {/* Plan Upload Preview */}
                      <div className="space-y-2 sm:space-y-3">
                        <div className={`flex items-center justify-between mb-4 ${isSectionVisible ? 'animate-fade-in' : 'opacity-0'}`}>
                          <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Commercial_Building_Plans.pdf</h4>
                          <Badge variant="secondary" className={`text-xs dark:bg-gray-700 dark:text-gray-200 ${isSectionVisible ? 'animate-pulse' : ''}`}>42 pages</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { type: 'floor', label: 'Floor Plan' },
                            { type: 'elevation', label: 'Elevation' },
                            { type: 'detail', label: 'Details' },
                            { type: 'site', label: 'Site Plan' }
                          ].map((page, idx) => (
                            <div 
                              key={idx} 
                              className={`aspect-[8.5/11] bg-orange-50 rounded border border-orange-200 relative overflow-hidden hover:border-orange hover:scale-105 transition-all duration-300 group cursor-pointer ${isSectionVisible ? 'animate-slide-up' : 'opacity-0'}`}
                              style={{ animationDelay: isSectionVisible ? `${idx * 150}ms` : '0ms' }}
                            >
                              {/* Blueprint background pattern */}
                              <div className="absolute inset-0 opacity-10">
                                <div className="w-full h-full" style={{
                                  backgroundImage: 'repeating-linear-gradient(0deg, #f64c19 0px, #f64c19 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #f64c19 0px, #f64c19 1px, transparent 1px, transparent 20px)',
                                }}></div>
                              </div>
                              
                              {/* Drawing content */}
                              <div className="absolute inset-0 p-3 flex items-center justify-center">
                                {page.type === 'floor' && (
                                  <svg viewBox="0 0 100 100" className="w-full h-full">
                                    {/* Simple floor plan */}
                                    <rect x="20" y="25" width="60" height="50" fill="none" stroke="#000000" strokeWidth="1.5" />
                                    <line x1="50" y1="25" x2="50" y2="75" stroke="#000000" strokeWidth="1" />
                                    <line x1="20" y1="50" x2="80" y2="50" stroke="#000000" strokeWidth="1" />
                                    <rect x="35" y="73" width="8" height="2" fill="#000000" />
                                    <circle cx="30" cy="35" r="2" fill="#000000" />
                                    <circle cx="70" cy="35" r="2" fill="#000000" />
                                  </svg>
                                )}
                                {page.type === 'elevation' && (
                                  <svg viewBox="0 0 100 100" className="w-full h-full">
                                    {/* Simple elevation */}
                                    <polygon points="50,20 20,45 20,75 80,75 80,45" fill="none" stroke="#000000" strokeWidth="1.5" />
                                    <rect x="35" y="55" width="10" height="15" fill="none" stroke="#000000" strokeWidth="1" />
                                    <rect x="55" y="55" width="10" height="15" fill="none" stroke="#000000" strokeWidth="1" />
                                    <line x1="37" y1="62" x2="43" y2="62" stroke="#000000" strokeWidth="0.5" />
                                    <line x1="40" y1="55" x2="40" y2="70" stroke="#000000" strokeWidth="0.5" />
                                  </svg>
                                )}
                                {page.type === 'detail' && (
                                  <svg viewBox="0 0 100 100" className="w-full h-full">
                                    {/* Detail drawing */}
                                    <line x1="30" y1="30" x2="70" y2="30" stroke="#000000" strokeWidth="2" />
                                    <line x1="30" y1="40" x2="70" y2="40" stroke="#000000" strokeWidth="1.5" />
                                    <line x1="30" y1="50" x2="70" y2="50" stroke="#000000" strokeWidth="1" />
                                    <line x1="30" y1="60" x2="70" y2="60" stroke="#000000" strokeWidth="1.5" />
                                    <line x1="25" y1="25" x2="25" y2="65" stroke="#000000" strokeWidth="0.5" strokeDasharray="2,2" />
                                    <text x="22" y="45" fontSize="6" fill="#000000">A</text>
                                  </svg>
                                )}
                                {page.type === 'site' && (
                                  <svg viewBox="0 0 100 100" className="w-full h-full">
                                    {/* Site plan */}
                                    <rect x="35" y="35" width="30" height="30" fill="none" stroke="#000000" strokeWidth="1.5" />
                                    <path d="M 25,25 L 75,25 L 75,75 L 25,75 Z" fill="none" stroke="#000000" strokeWidth="0.5" strokeDasharray="3,3" />
                                    <circle cx="28" cy="28" r="3" fill="none" stroke="#16a34a" strokeWidth="1" />
                                    <circle cx="72" cy="28" r="3" fill="none" stroke="#16a34a" strokeWidth="1" />
                                    <line x1="20" y1="70" x2="80" y2="70" stroke="#000000" strokeWidth="1.5" />
                                  </svg>
                                )}
                        </div>
                              
                              {/* Page label */}
                              <div className="absolute bottom-1 left-0 right-0 text-center">
                                <span className="text-[9px] text-orange-700 font-medium bg-white/80 px-1 rounded">{page.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
                  )}
                  {index === 1 && (
                    <div className="bg-white dark:bg-gray-950 rounded-xl p-4 sm:p-6 border-2 border-orange-200 dark:border-orange-900 min-h-[180px] sm:min-h-[200px] shadow-sm bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/40 dark:to-black transition-colors duration-300">
                      {/* AI Analysis Preview */}
                      <div className="space-y-2 sm:space-y-3">
                        <div className={`flex items-center mb-3 ${isSectionVisible ? 'animate-fade-in' : 'opacity-0'}`}>
                          <Brain className={`h-5 w-5 text-orange mr-2 ${isSectionVisible ? 'animate-pulse' : ''}`} />
                          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Analysis Results</h4>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className={`bg-white p-2 rounded border border-gray-200 hover:shadow-md transition-shadow duration-300 ${isSectionVisible ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: isSectionVisible ? '200ms' : '0ms' }}>
                            <div className="flex justify-between mb-1">
                              <span className="text-gray-600">Materials</span>
                              <span className="font-semibold text-gray-900">$28,450</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Labor</span>
                              <span className="font-semibold text-gray-900">$18,200</span>
                            </div>
                          </div>
                          <div className={`bg-green-50 p-2 rounded border border-green-200 hover:shadow-md transition-shadow duration-300 ${isSectionVisible ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: isSectionVisible ? '400ms' : '0ms' }}>
                            <div className="flex justify-between">
                              <span className="text-gray-700 font-medium">Total Estimate</span>
                              <span className="font-bold text-green-600">$46,650</span>
                            </div>
                          </div>
                          <div className={`bg-orange-50 p-2 rounded border border-orange-200 hover:shadow-md transition-shadow duration-300 ${isSectionVisible ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: isSectionVisible ? '600ms' : '0ms' }}>
                            <div className="flex items-start">
                              <AlertCircle className="h-3 w-3 text-orange mr-1 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700">3 issues detected</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {index === 2 && (
                    <div className="bg-white dark:bg-gray-950 rounded-xl p-4 sm:p-6 border-2 border-gray-200 dark:border-gray-700 min-h-[180px] sm:min-h-[200px] shadow-sm transition-colors duration-300">
                      {/* Subs Contact List */}
                      <div className="space-y-2 sm:space-y-3">
                        <h4 className={`font-semibold text-sm text-gray-700 dark:text-gray-200 mb-3 ${isSectionVisible ? 'animate-fade-in' : 'opacity-0'}`}>Contacting Subcontractors</h4>
                        {['Elite Construction', 'Premier Builders', 'Metro Construction'].map((sub, i) => (
                          <div 
                            key={i} 
                            className={`flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 hover:border-orange transition-all duration-300 ${isSectionVisible ? 'animate-slide-right' : 'opacity-0'}`}
                            style={{ animationDelay: isSectionVisible ? `${i * 200}ms` : '0ms' }}
                          >
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-orange rounded-full flex items-center justify-center mr-2">
                                <Users className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-xs font-medium text-gray-900">{sub}</span>
                            </div>
                            <CheckCircle className={`h-4 w-4 text-green-600 ${isSectionVisible ? 'animate-scale-in' : 'opacity-0'}`} style={{ animationDelay: isSectionVisible ? `${(i * 200) + 400}ms` : '0ms' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {index === 3 && (
                    <div className="bg-white dark:bg-gray-950 rounded-xl p-4 sm:p-6 border-2 border-gray-200 dark:border-gray-700 min-h-[180px] sm:min-h-[200px] shadow-sm flex items-center justify-center transition-colors duration-300">
                      {/* Back and Forth Communication Visualization */}
                      <div className="w-full flex items-center justify-between px-2 sm:px-4">
                        {/* Bidi Side */}
                        <div className="flex flex-col items-center space-y-1 sm:space-y-2">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg relative">
                            <span className="font-bidi text-white text-sm sm:text-xl font-bold">BIDI</span>
                            {/* Pulse effect */}
                            <div className="absolute inset-0 bg-orange rounded-lg sm:rounded-xl animate-ping opacity-20"></div>
                          </div>
                          <span className="text-[10px] sm:text-xs font-semibold text-gray-700 text-center font-bidi">BIDI</span>
          </div>

                        {/* Animated Connection Line */}
                        <div className="flex-1 relative mx-2 sm:mx-4 lg:mx-6">
                          {/* Base line */}
                          <div className="h-1 bg-gray-200 rounded-full relative overflow-hidden">
                            {/* Pulsing data flow - left to right */}
                            <div className="absolute h-full w-6 sm:w-8 bg-gradient-to-r from-transparent via-orange to-transparent animate-flow-right"></div>
                            {/* Pulsing data flow - right to left */}
                            <div className="absolute h-full w-6 sm:w-8 bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-flow-left"></div>
          </div>
                          
                          {/* Arrow indicators */}
                          <div className="absolute -top-2 sm:-top-3 left-1/2 transform -translate-x-1/2">
                            <div className="flex items-center space-x-0.5 sm:space-x-1">
                              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-orange animate-pulse" />
                              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500 animate-pulse rotate-180" style={{ animationDelay: '0.5s' }} />
        </div>
                          </div>
                          
                          {/* Data labels - hidden on very small screens */}
                          <div className="absolute -bottom-6 sm:-bottom-8 left-0 right-0 hidden xs:flex justify-between text-[8px] sm:text-[9px] text-gray-500">
                            <span>Questions</span>
                            <span className="hidden sm:inline">Clarifications</span>
                            <span>Updates</span>
                          </div>
                        </div>

                        {/* Subcontractor Side */}
                        <div className="flex flex-col items-center space-y-1 sm:space-y-2">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-700 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg relative">
                            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                            {/* Pulse effect */}
                            <div className="absolute inset-0 bg-gray-700 rounded-lg sm:rounded-xl animate-ping opacity-20"></div>
                          </div>
                          <span className="text-[10px] sm:text-xs font-semibold text-gray-700 text-center">Subs</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {index === 4 && (
                    <div className="bg-white dark:bg-gray-950 rounded-xl p-4 sm:p-6 border-2 border-green-200 dark:border-green-900 min-h-[180px] sm:min-h-[200px] shadow-sm transition-colors duration-300">
                      {/* Bid Comparison */}
                      <div className="space-y-2 sm:space-y-3">
                        <div className={`flex items-center mb-3 ${isSectionVisible ? 'animate-fade-in' : 'opacity-0'}`}>
                          <CheckCircle className={`h-5 w-5 text-green-600 mr-2 ${isSectionVisible ? 'animate-pulse' : ''}`} />
                          <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-200">5 Bids Received</h4>
                        </div>
                        <div className="space-y-2 text-xs">
                          {[
                            { name: 'Elite Construction', price: '$45,000', timeline: '3 weeks', rank: 1 },
                            { name: 'Premier Builders', price: '$42,500', timeline: '4 weeks', rank: 2 },
                            { name: 'Metro Construction', price: '$48,000', timeline: '2 weeks', rank: 3 }
                          ].map((bid, i) => (
                            <div 
                              key={i} 
                              className={`p-2 rounded border ${i === 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'} hover:shadow-md transition-all duration-300 cursor-pointer ${isSectionVisible ? 'animate-slide-up' : 'opacity-0'}`}
                              style={{ animationDelay: isSectionVisible ? `${i * 200}ms` : '0ms' }}
                            >
                              <div className="flex justify-between mb-1">
                                <div className="flex items-center">
                                  <Badge variant={i === 0 ? 'default' : 'secondary'} className="h-4 text-[10px] px-1 mr-2">
                                    #{bid.rank}
                                  </Badge>
                                  <span className="font-medium text-gray-900">{bid.name}</span>
                  </div>
                                <span className="font-bold text-gray-900">{bid.price}</span>
                              </div>
                              <div className="flex items-center text-gray-600">
                                <Clock className="h-3 w-3 mr-1" />
                                {bid.timeline}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo-section" className="container mx-auto px-4 py-16 relative z-10 overflow-hidden">
        {/* Demo Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-4">
            See <span className="font-bidi bidi-orange-text">BIDI</span> in Action
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto font-medium">
            Watch how our AI analyzes your plans, generates estimates, and manages the entire bid collection process automatically.
          </p>
        </div>

        {/* Demo Content */}
        <DemoSection />
      </section>

      {/* Blog Section */}
      <section className="bg-gray-50 dark:bg-black py-16 relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-4">
              Latest <span className="font-bidi bidi-orange-text">Insights</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Stay updated with the latest trends and tips in construction estimating and bid management
            </p>
          </div>
          <BlogSection />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16 relative z-10">
        <FAQSection />
      </section>

      {/* CTA Section */}
      <section className="bg-white dark:bg-black text-black dark:text-white py-16 relative overflow-hidden transition-colors duration-300">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange/8 via-transparent to-orange-500/8 dark:from-orange/12 dark:to-orange-500/12"></div>
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-orange via-transparent to-orange opacity-50"></div>
        <div className="absolute -top-20 left-10 w-40 h-40 opacity-[0.10] dark:opacity-[0.15] rotate-45 text-orange">
          <TireTrackPattern />
        </div>
        <div className="absolute -bottom-20 right-10 w-40 h-40 opacity-[0.10] dark:opacity-[0.15] -rotate-12 text-orange">
          <TireTrackPattern />
        </div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className={`text-3xl sm:text-4xl font-bold mb-6 tracking-tight transition-all duration-1000 delay-3400 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            Ready to Transform Your Estimating Process?
          </h2>
          <p className={`text-xl sm:text-2xl text-gray-700 dark:text-gray-300 mb-10 font-medium transition-all duration-1000 delay-3600 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            Join leading General Contractors who trust <span className="font-bidi bidi-orange-text">BIDI</span> for AI-powered estimating and complete bid management.
            </p>
          <div className={`transition-all duration-1000 delay-3800 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <a href="https://calendar.app.google/NeVX7M4JfPJaGYD9A" target="_blank" rel="noopener noreferrer">
              <Button variant="orange" size="lg" className="text-lg sm:text-xl px-8 sm:px-12 py-4 font-bold">
                Schedule a Demo
                <ArrowRight className="ml-2 h-6 w-6" />
              </Button>
            </a>
          </div>
        </div>
      </section>
        </div>
      </PublicLayout>
    </>
  )
}

// Hero Plan Visual Component
function HeroPlanVisual() {
  return (
    <div className="relative w-full max-w-5xl mx-auto perspective-1000">
      {/* Floating Animation Wrapper */}
      <div 
        className="relative animate-float" 
        style={{ 
          transformStyle: 'preserve-3d',
          transform: 'rotateX(20deg) rotateY(0deg) rotateZ(0deg)',
        }}
      >
        {/* Main Plan Viewer Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border-4 border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col h-[600px]">
          {/* Browser/App Header */}
          <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex items-center gap-2 shrink-0">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="bg-white dark:bg-gray-950 rounded px-3 py-1 text-xs text-gray-500 flex-1 mx-4 text-center font-mono flex items-center justify-between">
              <span>app.bidi.construction/plans/view/P-102</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-[10px] h-5">A1.02 Floor Plan</Badge>
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] h-5">Processed</Badge>
              </div>
            </div>
          </div>

          {/* Plan Viewer Toolbar */}
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Search className="h-4 w-4" />
              </Button>
              <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>
              <Button variant="secondary" size="sm" className="h-8 w-8 p-0 bg-orange-100 text-orange-700">
                <MapPin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <FileText className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ChevronDown className="h-4 w-4 rotate-90" />
              </Button>
              <span className="text-xs font-mono">75%</span>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </Button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 relative bg-gray-50 dark:bg-gray-950 overflow-hidden flex">
            {/* Left Sidebar (Miniature) */}
            <div className="w-16 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col items-center py-4 space-y-4 shrink-0">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`w-10 h-14 border rounded ${i === 2 ? 'border-orange bg-orange-50' : 'border-gray-200 bg-gray-50'}`}></div>
              ))}
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8">
              <div className="relative bg-white shadow-sm border border-gray-200 w-full h-full max-w-[800px] aspect-[4/3] p-8 overflow-hidden">
                {/* SVG Plan Drawing */}
                <svg viewBox="0 0 800 600" className="w-full h-full text-gray-800 dark:text-gray-300">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  
                  {/* Walls */}
                  <g stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="square">
                    {/* Outer Walls */}
                    <path d="M 100,100 L 700,100 L 700,500 L 100,500 Z" />
                    
                    {/* Inner Walls */}
                    <path d="M 100,250 L 400,250" />
                    <path d="M 400,100 L 400,500" />
                    <path d="M 400,350 L 700,350" />
                    <path d="M 250,250 L 250,500" />
                  </g>

                  {/* Doors */}
                  <g stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M 180,250 Q 215,285 215,250" />
                    <line x1="180" y1="250" x2="215" y2="250" strokeWidth="1" strokeDasharray="4,4" />
                    
                    <path d="M 400,180 Q 435,215 435,180" transform="rotate(90 400 180)" />
                    
                    <path d="M 550,350 Q 585,385 585,350" />
                  </g>

                  {/* Room Labels */}
                  <g fill="currentColor" fontFamily="monospace" fontSize="12" textAnchor="middle" opacity="0.6">
                    <text x="250" y="175">LIVING AREA</text>
                    <text x="550" y="225">MASTER SUITE</text>
                    <text x="175" y="375">KITCHEN</text>
                    <text x="325" y="375">DINING</text>
                    <text x="550" y="425">GUEST ROOM</text>
                  </g>

                  {/* Dimensions */}
                  <g stroke="currentColor" strokeWidth="1" opacity="0.4">
                    <line x1="80" y1="100" x2="80" y2="500" />
                    <line x1="75" y1="100" x2="85" y2="100" />
                    <line x1="75" y1="500" x2="85" y2="500" />
                    <text x="70" y="300" textAnchor="end" dominantBaseline="middle" fontSize="10" transform="rotate(-90 70 300)">40' - 0"</text>

                    <line x1="100" y1="520" x2="700" y2="520" />
                    <line x1="100" y1="515" x2="100" y2="525" />
                    <line x1="700" y1="515" x2="700" y2="525" />
                    <text x="400" y="535" textAnchor="middle" fontSize="10">60' - 0"</text>
                  </g>

                  {/* Annotations / Pins */}
                  <g>
                    {/* Pin 1 - Material */}
                    <g transform="translate(160, 360)">
                      <circle cx="0" cy="0" r="10" fill="#f97316" fillOpacity="0.2" className="animate-pulse" />
                      <circle cx="0" cy="0" r="5" fill="#f97316" stroke="white" strokeWidth="2" />
                      <g transform="translate(10, -20)">
                        <rect x="0" y="0" width="120" height="40" rx="4" fill="white" stroke="#e5e7eb" className="shadow-lg" />
                        <text x="10" y="15" fontSize="10" fill="#6b7280" fontWeight="bold">Cabinetry</text>
                        <text x="10" y="30" fontSize="10" fill="#111827">Install custom units</text>
                      </g>
                    </g>

                    {/* Pin 2 - Issue */}
                    <g transform="translate(650, 150)">
                      <circle cx="0" cy="0" r="10" fill="#ef4444" fillOpacity="0.2" className="animate-pulse" />
                      <circle cx="0" cy="0" r="5" fill="#ef4444" stroke="white" strokeWidth="2" />
                      <g transform="translate(-130, -20)">
                        <rect x="0" y="0" width="120" height="40" rx="4" fill="white" stroke="#e5e7eb" className="shadow-lg" />
                        <text x="10" y="15" fontSize="10" fill="#ef4444" fontWeight="bold">Missing Spec</text>
                        <text x="10" y="30" fontSize="10" fill="#111827">Confirm floor finish</text>
                      </g>
                    </g>

                    {/* Pin 3 - Measurement */}
                    <g transform="translate(300, 250)">
                      <circle cx="0" cy="0" r="10" fill="#22c55e" fillOpacity="0.2" className="animate-pulse" />
                      <circle cx="0" cy="0" r="5" fill="#22c55e" stroke="white" strokeWidth="2" />
                    </g>
                  </g>
                </svg>

                {/* Overlaid UI Elements on Canvas */}
                <div className="absolute bottom-4 right-4 bg-white shadow-md border border-gray-200 rounded-md p-2 flex flex-col space-y-2">
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <div className="w-4 h-4 border-2 border-gray-400 rounded-sm"></div>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <div className="w-4 h-0.5 bg-gray-400"></div>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Sidebar (Analysis) */}
            <div className="w-64 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0">
              <div className="p-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-sm">
                AI Analysis
              </div>
              <div className="p-3 space-y-3 overflow-y-auto">
                <div className="bg-orange-50 border border-orange-100 rounded p-2">
                  <div className="flex items-center text-xs font-medium text-orange-800 mb-1">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Missing Information
                  </div>
                  <p className="text-[10px] text-orange-700">
                    Floor finish schedule missing for Room 102 (Master Suite).
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Takeoff Summary</p>
                  {[
                    { name: 'Int. Walls', qty: '1,240 SF' },
                    { name: 'Ext. Walls', qty: '850 SF' },
                    { name: 'Doors', qty: '8 Units' },
                    { name: 'Windows', qty: '12 Units' },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between text-xs border-b border-gray-50 pb-1">
                      <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                      <span className="font-mono text-gray-500">{item.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Glow Effect Behind */}
        <div className="absolute -inset-4 bg-orange/20 blur-3xl -z-10 rounded-[30px]"></div>
      </div>
    </div>
  )
}

// Hero Dashboard Visual Component
function HeroDashboardVisual() {
  return (
    <div className="relative w-full max-w-5xl mx-auto perspective-1000">
      {/* Floating Animation Wrapper */}
      <div 
        className="relative animate-float" 
        style={{ 
          transformStyle: 'preserve-3d',
          transform: 'rotateX(20deg) rotateY(0deg) rotateZ(0deg)',
        }}
      >
        {/* Main Dashboard Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border-4 border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
          {/* Browser/App Header */}
          <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="bg-white dark:bg-gray-950 rounded px-3 py-1 text-xs text-gray-500 flex-1 mx-4 text-center font-mono">
              app.bidi.construction/dashboard/project/1284
            </div>
          </div>

          {/* Dashboard Content Preview */}
          <div className="p-6 bg-gray-50 dark:bg-gray-950 min-h-[300px] sm:min-h-[400px]">
            {/* Header Row */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Commercial Complex - Phase 1</h3>
                <p className="text-sm text-gray-500">Last updated 2 hours ago</p>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                <Badge variant="outline">Export</Badge>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Total Estimate</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">$1.2M</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Bids Received</p>
                <p className="text-xl font-bold text-green-600">12/15</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Action Items</p>
                <p className="text-xl font-bold text-orange-500">3 Pending</p>
              </div>
            </div>

            {/* Table Preview */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500">
                <div className="col-span-2">Trade Package</div>
                <div>Lowest Bid</div>
                <div>Status</div>
              </div>
              {[
                { name: '03 30 00 - Cast-in-Place Concrete', bid: '$145,200', status: 'Leveled' },
                { name: '04 20 00 - Unit Masonry', bid: '$82,500', status: 'Reviewing' },
                { name: '05 12 00 - Structural Steel', bid: '$215,000', status: 'Pending' },
                { name: '09 29 00 - Gypsum Board', bid: '$68,400', status: 'Leveled' },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 text-sm">
                  <div className="col-span-2 font-medium text-gray-900 dark:text-white">{row.name}</div>
                  <div className="text-gray-600 dark:text-gray-300">{row.bid}</div>
                  <div>
                    <Badge variant="secondary" className={`text-[10px] ${
                      row.status === 'Leveled' ? 'bg-green-100 text-green-700' :
                      row.status === 'Reviewing' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {row.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Glow Effect Behind */}
        <div className="absolute -inset-4 bg-orange/20 blur-3xl -z-10 rounded-[30px]"></div>
      </div>
    </div>
  )
}

// FAQ Section Component
function FAQSection() {
  const faqs = [
    {
      question: "What kind of plan files can I upload?",
      answer: "We support all standard PDF construction plan sets. You can upload single multi-page files or individual sheets. Our system automatically processes vector and raster PDFs, though vector PDFs (generated directly from CAD/BIM software) typically yield the fastest results."
    },
    {
      question: "Does this work with my existing subcontractors?",
      answer: (
        <>
          Absolutely. You can upload your own subcontractor directory to <span className="font-bidi">BIDI</span>. When you start a project, you can choose to invite your own subs, our network of vetted subcontractors, or a mix of both. We handle the outreach and follow-ups for everyone.
        </>
      )
    },
    {
      question: "How does the bid leveling work?",
      answer: "When subcontractors submit their bids, our AI automatically parses their proposals—even if they're just PDFs or emails—and standardizes them into a single comparison table. It highlights deviations, scope gaps, and outliers so you can compare apples to apples."
    }
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-black dark:text-white mb-4">Frequently Asked Questions</h2>
        <p className="text-gray-600 dark:text-gray-300">Everything you need to know about <span className="font-bidi">BIDI</span></p>
      </div>
      
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left text-lg font-medium text-gray-900 dark:text-gray-100">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-base text-gray-600 dark:text-gray-300">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

// Demo Section Component
function DemoSection() {
  const [currentStep, setCurrentStep] = useState(-1) // -1 = not started
  const [isRunning, setIsRunning] = useState(false)
  const [showBids, setShowBids] = useState(false)
  const [showEstimate, setShowEstimate] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [sendingToSubs, setSendingToSubs] = useState(false)
  const [bidsReceiving, setBidsReceiving] = useState(0)

  const steps = [
    {
      title: 'Submit Plans',
      description: 'Upload construction plans - AI extracts materials, labor & estimates costs',
      icon: FileText,
      color: 'blue',
      loadingText: 'AI analyzing your plans...'
    },
    {
      title: 'Review AI Analysis',
      description: 'See automated estimate & identified missing details',
      icon: Brain,
      color: 'purple',
      loadingText: 'Generating estimate & detecting issues...'
    },
    {
      title: 'Send to Subs',
      description: 'Automatic outreach to your subs and our network',
      icon: Search,
      color: 'green',
      loadingText: 'Contacting subcontractors...'
    },
    {
      title: 'Bid Collection',
      description: 'Automated back-and-forth until bids are complete',
      icon: Mail,
      color: 'indigo',
      loadingText: 'Managing communications...'
    },
    {
      title: 'Leveled Bids',
      description: 'Organized, comparable bids ready for review',
      icon: CheckCircle,
      color: 'orange',
      loadingText: 'Finalizing bid comparison...'
    }
  ]

  const startDemo = async () => {
    setIsRunning(true)
    setShowBids(false)
    setShowEstimate(false)
    setCurrentStep(0)
    setUploadProgress(0)
    setAnalyzing(false)
    setSendingToSubs(false)
    setBidsReceiving(0)
    
    // Step 1: File Upload Animation
    for (let i = 0; i <= 100; i += 5) {
      setUploadProgress(i)
      await new Promise(resolve => setTimeout(resolve, 30))
    }
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Step 2: AI Analysis
    setCurrentStep(1)
    setAnalyzing(true)
    await new Promise(resolve => setTimeout(resolve, 3000))
    setAnalyzing(false)
    
    // Show the estimate and takeoff results
    setShowEstimate(true)
    setIsRunning(false)
  }

  const continueToSubs = async () => {
    setShowEstimate(false)
    setIsRunning(true)
    
    // Step 3: Send to Subs
    setCurrentStep(2)
    setSendingToSubs(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setSendingToSubs(false)
    
    // Step 4: Receive Bids
    setCurrentStep(3)
    for (let i = 1; i <= 5; i++) {
      setBidsReceiving(i)
      await new Promise(resolve => setTimeout(resolve, 600))
    }
    
    // Step 5: Complete
    setCurrentStep(4)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setShowBids(true)
    setIsRunning(false)
  }

  const resetDemo = () => {
    setCurrentStep(-1)
    setShowBids(false)
    setShowEstimate(false)
    setIsRunning(false)
    setUploadProgress(0)
    setAnalyzing(false)
    setSendingToSubs(false)
    setBidsReceiving(0)
  }

  return (
    <div className="space-y-8">
      {/* Animated Demo Visualization */}
      {!showBids && !showEstimate && (
        <div className="max-w-4xl mx-auto">
          {/* Start Demo Button */}
          {currentStep === -1 && (
            <div className="text-center">
              <Button 
                onClick={startDemo}
                variant="orange"
                size="lg"
                className="text-lg px-12 py-6 font-bold"
              >
                <Play className="h-6 w-6 mr-2" />
                Watch the Demo
              </Button>
                </div>
          )}

          {/* Animation Container */}
          {currentStep >= 0 && (
            <Card className="border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8 min-h-[400px] relative overflow-hidden">
              
              {/* Step 0: File Upload Animation */}
              {currentStep === 0 && (
                <div className="flex flex-col items-center justify-center h-full space-y-6">
                  <div className="relative">
                    {/* Upload Area */}
                    <div className="w-64 h-64 border-4 border-dashed border-orange rounded-xl bg-orange/5 flex items-center justify-center">
                      <div className="text-center">
                        <FileText className="h-20 w-20 text-orange mx-auto mb-4 animate-bounce" />
                        <p className="text-lg font-semibold text-gray-700">Uploading Plans...</p>
                </div>
              </div>
              </div>
                  <div className="w-full max-w-md">
                    <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-orange h-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                </div>
                    <p className="text-center mt-2 text-sm text-gray-600 font-medium">{uploadProgress}%</p>
                </div>
                </div>
              )}

              {/* Step 1: AI Analysis */}
              {currentStep === 1 && (
                <div className="flex flex-col items-center justify-center h-full space-y-6">
                  <div className="relative">
                    <div className="w-64 h-64 rounded-xl bg-gradient-to-br from-orange/20 to-purple-500/20 flex items-center justify-center relative overflow-hidden">
                      {/* Scanning effect */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange/30 to-transparent animate-scan"></div>
                      <Brain className="h-24 w-24 text-orange animate-pulse relative z-10" />
                </div>
              </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-black mb-2">AI Analyzing Plans</h3>
                    <p className="text-gray-600">Extracting materials, labor & generating estimates...</p>
              </div>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-orange rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-3 h-3 bg-orange rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-3 h-3 bg-orange rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}

              {/* Step 2: Sending to Subs */}
              {currentStep === 2 && (
                <div className="flex flex-col items-center justify-center h-full space-y-6 relative">
                  <div className="relative w-full h-64 flex items-center justify-center">
                    {/* Center Document */}
                    <div className="absolute z-20 w-20 h-20 bg-orange rounded-lg flex items-center justify-center shadow-lg">
                      <FileText className="h-10 w-10 text-white" />
              </div>
                    
                    {/* Emails flying out to subs */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="absolute w-16 h-16 bg-gray-100 border-2 border-gray-300 rounded-lg flex items-center justify-center animate-fly-out"
                        style={{
                          animationDelay: `${i * 200}ms`,
                          transform: `rotate(${i * 72}deg) translateY(-120px)`,
                        }}
                      >
                        <Users className="h-8 w-8 text-gray-600" />
              </div>
                    ))}
            </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-black mb-2">Sending to Subcontractors</h3>
                    <p className="text-gray-600">Contacting qualified subs from your network...</p>
                  </div>
                </div>
              )}

              {/* Step 3: Receiving Bids */}
              {currentStep === 3 && (
                <div className="flex flex-col items-center justify-center h-full space-y-6">
                  <div className="relative w-full h-64 flex items-center justify-center">
                    {/* Center Inbox */}
                    <div className="absolute z-20 w-24 h-24 bg-gray-800 rounded-lg flex items-center justify-center shadow-lg">
                      <Mail className="h-12 w-12 text-white" />
                    </div>
                    
                    {/* Bids flying in */}
                    {Array.from({ length: bidsReceiving }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center animate-fly-in shadow-lg"
                        style={{
                          animationDelay: `${i * 100}ms`,
                          left: `${20 + i * 15}%`,
                        }}
                      >
                        <FileText className="h-6 w-6 text-white" />
                </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-black mb-2">Collecting Bids</h3>
                    <p className="text-gray-600">Received {bidsReceiving} of 5 bids...</p>
                  </div>
                  </div>
                )}

              {/* Step 4: Leveling Complete */}
              {currentStep === 4 && (
                <div className="flex flex-col items-center justify-center h-full space-y-6">
                  <div className="relative">
                    <div className="w-64 h-64 rounded-xl bg-gradient-to-br from-green-500/20 to-orange/20 flex items-center justify-center">
                      <CheckCircle className="h-32 w-32 text-green-600 animate-scale-in" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-black mb-2">Bids Leveled!</h3>
                    <p className="text-gray-600">AI has organized and compared all bids</p>
                  </div>
                  </div>
                )}
            </Card>
          )}
      </div>
      )}

      {/* Estimate & Takeoff Results */}
      {showEstimate && (
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-scale-in px-4">
          <div className="text-center mb-4 sm:mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full mb-3 sm:mb-4">
              <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-green-600" />
              </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-black mb-2 px-4">AI Analysis Complete!</h3>
            <p className="text-base sm:text-lg text-gray-600 px-4">Here's your automated estimate and takeoff</p>
          </div>

          {/* Estimate Summary */}
          <Card className="border-2 border-green-500 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl lg:text-2xl flex items-center">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-green-600" />
                Project Estimate
            </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
                <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Materials</p>
                  <p className="text-3xl font-bold text-black">$28,450</p>
              </div>
                <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Labor</p>
                  <p className="text-3xl font-bold text-black">$18,200</p>
              </div>
                <div className="text-center p-4 bg-green-100 rounded-lg border-2 border-green-500">
                  <p className="text-sm text-gray-700 mb-1 font-semibold">Total Estimate</p>
                  <p className="text-3xl font-bold text-green-600">$46,650</p>
              </div>
              </div>

              {/* Material Takeoff */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <h4 className="font-semibold text-black mb-3 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-gray-600" />
                  Material Takeoff
                </h4>
                <div className="space-y-2">
                  {[
                    { item: 'Concrete (cubic yards)', qty: '12', unit: 'cy', cost: '$3,600' },
                    { item: 'Rebar #4', qty: '850', unit: 'lbs', cost: '$1,275' },
                    { item: 'Lumber 2x4x8', qty: '240', unit: 'pcs', cost: '$1,920' },
                    { item: 'Drywall 4x8 sheets', qty: '65', unit: 'sheets', cost: '$845' },
                    { item: 'Paint (gallons)', qty: '45', unit: 'gal', cost: '$1,350' },
                  ].map((material, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <span className="text-gray-900 font-medium">{material.item}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-gray-600 w-20 text-right">{material.qty} {material.unit}</span>
                        <span className="text-black font-semibold w-24 text-right">{material.cost}</span>
                      </div>
                    </div>
                  ))}
                  <div className="text-right text-sm text-gray-500 pt-2">
                    + 15 more items...
                  </div>
                </div>
              </div>

              {/* Detected Issues */}
              <div className="bg-orange-50 rounded-lg border-2 border-orange-200 p-4">
                <h4 className="font-semibold text-black mb-3 flex items-center">
                  <Brain className="h-5 w-5 mr-2 text-orange" />
                  AI Detected Issues
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="text-orange mr-2">•</span>
                    <span className="text-gray-700">Missing electrical specifications on pages 4-6</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange mr-2">•</span>
                    <span className="text-gray-700">HVAC load calculations not included</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange mr-2">•</span>
                    <span className="text-gray-700">Plumbing fixture schedule incomplete</span>
                  </li>
                </ul>
            </div>
          </CardContent>
        </Card>

          {/* Continue Button */}
          <div className="text-center px-4">
            <Button
              onClick={continueToSubs}
              variant="orange"
              size="lg"
              className="text-base sm:text-lg lg:text-xl px-6 sm:px-10 lg:px-12 py-4 sm:py-5 lg:py-6 font-bold w-full sm:w-auto"
            >
              <Users className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
              <span className="hidden sm:inline">Send to Subcontractors</span>
              <span className="sm:hidden">Send to Subs</span>
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 ml-2" />
            </Button>
            <p className="text-xs sm:text-sm text-gray-600 mt-2 sm:mt-3 px-2">
              We'll contact qualified subs and manage the entire bid process
            </p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {showBids && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-black mb-2">
              Your Leveled Bids Are Ready!
            </h3>
            <p className="text-gray-600 mb-4">
              AI has analyzed and organized all bids with complete material takeoffs and cost comparisons
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

                  <a href="https://calendar.app.google/NeVX7M4JfPJaGYD9A" target="_blank" rel="noopener noreferrer">
                    <Button variant="orange" className="w-full mt-4 font-bold">
                      Schedule a Demo
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Blog Section Component
function BlogSection() {
  const featuredPosts = getBlogPosts({ featured: true, limit: 3 })

  if (featuredPosts.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {featuredPosts.map(post => (
        <Link key={post.slug} href={`/blog/${post.slug}`}>
          <Card className="h-full hover:shadow-lg transition-all duration-300 cursor-pointer group border-2 hover:border-orange">
            <CardHeader>
              <Badge className="mb-2 w-fit bidi-orange-bg-light bidi-orange-text">
                Featured
              </Badge>
              <CardTitle className="group-hover:text-orange transition-colors line-clamp-2">
                {post.title}
              </CardTitle>
              <CardDescription className="line-clamp-3">
                {post.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                {post.readingTime && (
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {post.readingTime} min
                  </div>
                )}
              </div>
              <div className="flex items-center text-orange group-hover:underline font-semibold">
                Read article
                <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
      <div className="md:col-span-3 text-center mt-8">
        <Link href="/blog">
          <Button variant="construction" size="lg">
            View All Articles
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

// Tire Track Pattern Component
function TireTrackPattern() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Tire track pattern - repeating tread marks */}
      <g opacity="0.6">
        {/* Left track */}
        <g transform="translate(30, 0)">
          {Array.from({ length: 8 }).map((_, i) => (
            <g key={i} transform={`translate(0, ${i * 25})`}>
              <rect x="0" y="0" width="20" height="4" fill="currentColor" rx="2"/>
              <rect x="5" y="8" width="10" height="6" fill="currentColor" rx="1"/>
              <rect x="2" y="16" width="16" height="3" fill="currentColor" rx="1"/>
            </g>
          ))}
        </g>
        
        {/* Right track */}
        <g transform="translate(150, 0)">
          {Array.from({ length: 8 }).map((_, i) => (
            <g key={i} transform={`translate(0, ${i * 25})`}>
              <rect x="0" y="0" width="20" height="4" fill="currentColor" rx="2"/>
              <rect x="5" y="8" width="10" height="6" fill="currentColor" rx="1"/>
              <rect x="2" y="16" width="16" height="3" fill="currentColor" rx="1"/>
            </g>
          ))}
        </g>
      </g>
    </svg>
  )
}
