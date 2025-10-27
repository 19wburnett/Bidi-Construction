'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import Link from 'next/link'
import { 
  Code, 
  Zap, 
  Users, 
  TrendingUp, 
  MapPin, 
  Clock, 
  DollarSign, 
  ArrowRight, 
  CheckCircle, 
  Star,
  Brain,
  Rocket,
  Target,
  Heart,
  Mail
} from 'lucide-react'

export default function JobsPage() {
  const [isVisible, setIsVisible] = useState(false)

  React.useEffect(() => {
    setIsVisible(true)
  }, [])

  const benefits = [
    {
      icon: Rocket,
      title: "Fast Impact",
      description: "Your code ships quickly and directly shapes how contractors work—no bureaucracy or endless review cycles."
    },
    {
      icon: Target,
      title: "True Ownership", 
      description: "Meaningful early-stage equity with real upside as we scale."
    },
    {
      icon: TrendingUp,
      title: "Career Acceleration",
      description: "Early engineers grow into technical leaders as the company expands."
    },
    {
      icon: Heart,
      title: "Massive Market Impact",
      description: "Construction is a $10T global market starving for modern software—you'll help bring it into the digital era."
    }
  ]

  const responsibilities = [
    "Design and ship features in our React + Node + Supabase stack",
    "Implement real-time collaboration and AI-driven plan analysis tools", 
    "Translate user pain points into elegant, high-impact solutions",
    "Optimize scalability and performance as we onboard new contractors weekly",
    "Collaborate directly with founders on architecture and product direction"
  ]

  const qualifications = [
    "Strong skills in JavaScript/TypeScript, React, and Node.js (Supabase experience is a plus)",
    "A builder's mindset—proactive, curious, and fast at turning ideas into products",
    "Interest in construction tech, data visualization, or AI automation",
    "A growth-oriented teammate who values learning, ownership, and collaboration"
  ]

  const perks = [
    "Meaningful early-stage equity with substantial upside as we grow",
    "Flexible hours and a remote-friendly culture focused on results", 
    "Direct mentorship from founders who value curiosity and creative problem-solving",
    "The chance to leave your mark on software that modernizes how buildings get built"
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-black relative overflow-hidden transition-colors duration-300">
      {/* Professional Construction Background Pattern */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-orange-50/60 dark:from-black dark:via-black dark:to-orange-950/40"></div>
        
        {/* Top accent line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange via-orange to-transparent"></div>
        
        {/* Subtle geometric patterns */}
        <div className="absolute top-32 left-10 w-80 h-80 opacity-[0.08] rotate-12 text-gray-500">
          <CodePattern />
        </div>
        <div className="absolute top-[500px] right-20 w-64 h-64 opacity-[0.08] -rotate-45 text-gray-500">
          <CodePattern />
        </div>
        <div className="absolute bottom-96 left-1/4 w-72 h-72 opacity-[0.06] rotate-[30deg] text-orange">
          <CodePattern />
        </div>
        
        {/* Gradient orbs for depth */}
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-gradient-radial from-orange/12 to-transparent blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-gradient-radial from-gray-500/12 to-transparent blur-3xl"></div>
        
        {/* Dot pattern for texture */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle, rgba(235, 80, 35, 0.04) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 text-center relative z-10">
        <div className={`flex justify-center mb-8 transition-all duration-1000 delay-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="bg-gray-100 border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center space-x-2">
              <Code className="h-4 w-4" />
              <span>Software Engineer</span>
            </div>
            <div className="bg-gray-100 border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>Remote</span>
            </div>
            <div className="bidi-orange-bg-light bidi-orange-text px-4 py-2 rounded-lg text-sm font-bold border border-orange/20 flex items-center space-x-2">
              <Star className="h-4 w-4" />
              <span>Early Stage Equity</span>
            </div>
          </div>
        </div>
        
        <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-6 tracking-tight transition-all duration-1000 delay-500 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          Software Engineer
          <span className="block bidi-orange-text">
            Build the Future of Construction Tech
          </span>
        </h1>
        
        <p className={`text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-10 max-w-4xl mx-auto font-medium transition-all duration-1000 delay-700 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          At Bidi, we're modernizing how general contractors and subcontractors connect, bid, and build—eliminating the chaos of email chains and spreadsheet bidding with intelligent plan analysis and bid-leveling tools that save teams hours every day.
        </p>
        
        <div className={`flex flex-col sm:flex-row justify-center gap-6 transition-all duration-1000 delay-1000 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <a href="mailto:jobs@bidi.com?subject=Software Engineer Application">
            <Button 
              variant="orange"
              size="lg" 
              className="text-lg sm:text-xl px-8 sm:px-12 py-4 w-full sm:w-auto font-bold group"
            >
              Apply Now
              <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>
          </a>
          <Button 
            variant="construction" 
            size="lg" 
            className="text-lg sm:text-xl px-8 sm:px-12 py-4 w-full sm:w-auto font-semibold group"
            onClick={() => document.getElementById('why-join')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Zap className="mr-2 h-5 w-5 group-hover:animate-pulse" />
            Why Join Us
          </Button>
        </div>
      </section>

      {/* Why Join Us Section */}
      <section id="why-join" className="bg-gray-50 dark:bg-black py-12 sm:py-16 relative z-10 overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange/20 to-transparent"></div>
        <div className="container mx-auto px-4">
          <div className={`text-center mb-8 sm:mb-12 transition-all duration-1000 delay-1200 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-3 sm:mb-4 tracking-tight px-4">
              Why Join Us
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
              We're a fast-moving startup with real traction, a sharp founding team, and a product solving critical pain points in construction.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <Card key={index} className={`bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-700 hover:border-orange/30 dark:hover:border-orange/30 transition-all duration-700 delay-${1400 + index * 200} ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                } hover:shadow-lg group`}>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-orange/10 rounded-lg flex items-center justify-center group-hover:bg-orange/20 transition-colors duration-300">
                        <Icon className="h-6 w-6 text-orange" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-black dark:text-white mb-2">{benefit.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{benefit.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className={`text-center mt-8 transition-all duration-1000 delay-2200 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">
              We can't offer Silicon Valley salaries yet, but we can offer <span className="bidi-orange-text font-bold">ownership, autonomy, and the chance to grow</span> with a company scaling fast.
            </p>
          </div>
        </div>
      </section>

      {/* What You'll Do Section */}
      <section className="container mx-auto px-4 py-12 sm:py-16 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className={`text-center mb-12 transition-all duration-1000 delay-2400 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-4 tracking-tight">
              What You'll Do
            </h2>
          </div>

          <Card className="bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-700">
            <CardContent className="p-8">
              <ul className="space-y-4">
                {responsibilities.map((responsibility, index) => (
                  <li key={index} className={`flex items-start space-x-3 transition-all duration-700 delay-${2600 + index * 200} ${
                    isVisible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                  }`}>
                    <CheckCircle className="h-5 w-5 text-orange flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300 text-lg">{responsibility}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* What We're Looking For Section */}
      <section className="bg-gray-50 dark:bg-black py-12 sm:py-16 relative z-10 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className={`text-center mb-12 transition-all duration-1000 delay-2800 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-4 tracking-tight">
                What We're Looking For
              </h2>
            </div>

            <Card className="bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-700">
              <CardContent className="p-8">
                <ul className="space-y-4">
                  {qualifications.map((qualification, index) => (
                    <li key={index} className={`flex items-start space-x-3 transition-all duration-700 delay-${3000 + index * 200} ${
                      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                    }`}>
                      <CheckCircle className="h-5 w-5 text-orange flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300 text-lg">{qualification}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What You'll Get Section */}
      <section className="container mx-auto px-4 py-12 sm:py-16 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className={`text-center mb-12 transition-all duration-1000 delay-3200 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-4 tracking-tight">
              What You'll Get
            </h2>
          </div>

          <Card className="bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-700">
            <CardContent className="p-8">
              <ul className="space-y-4">
                {perks.map((perk, index) => (
                  <li key={index} className={`flex items-start space-x-3 transition-all duration-700 delay-${3400 + index * 200} ${
                    isVisible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                  }`}>
                    <CheckCircle className="h-5 w-5 text-orange flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300 text-lg">{perk}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white dark:bg-black text-black dark:text-white py-16 relative overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-orange/8 via-transparent to-orange-500/8 dark:from-orange/12 dark:to-orange-500/12"></div>
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-orange via-transparent to-orange opacity-50"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className={`text-3xl sm:text-4xl font-bold mb-6 tracking-tight transition-all duration-1000 delay-3600 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            Ready to Build the Future?
          </h2>
          <p className={`text-xl sm:text-2xl text-gray-700 dark:text-gray-300 mb-10 font-medium transition-all duration-1000 delay-3800 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            If you want your code to power the future of construction and grow with a startup on the rise—join us.
          </p>
          <div className={`transition-all duration-1000 delay-4000 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <a href="mailto:jobs@bidi.com?subject=Software Engineer Application">
              <Button variant="orange" size="lg" className="text-lg sm:text-xl px-8 sm:px-12 py-4 font-bold">
                Apply Now
                <ArrowRight className="ml-2 h-6 w-6" />
              </Button>
            </a>
          </div>
        </div>
      </section>

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
