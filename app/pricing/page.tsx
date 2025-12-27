'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PublicLayout from '@/components/public-layout'
import Link from 'next/link'
import { BackgroundPattern } from '@/components/ui/background-pattern'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { 
  CheckCircle, 
  ArrowRight, 
  Star,
  Zap,
  Users,
  Mail,
  FileText,
  Clock,
  AlertTriangle,
  Crown
} from 'lucide-react'

export default function PricingPage() {
  const [isVisible, setIsVisible] = useState(false)
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    setIsVisible(true)

    const observerOptions = {
      threshold: 0.2,
      rootMargin: '0px 0px -100px 0px'
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

    const sections = document.querySelectorAll('[data-section-id]')
    sections.forEach(section => observer.observe(section))

    return () => {
      sections.forEach(section => observer.unobserve(section))
    }
  }, [])

  const features = [
    {
      icon: Users,
      title: "Access to Subcontractor Network",
      description: "Connect with qualified subcontractors in your area"
    },
    {
      icon: Mail,
      title: "Automated Job Distribution",
      description: "Jobs automatically sent to relevant subcontractors"
    },
    {
      icon: FileText,
      title: "Bid Management",
      description: "Organize and compare bids from multiple contractors"
    },
    {
      icon: Clock,
      title: "Time Savings",
      description: "No more cold calling or manual contractor searches"
    },
    {
      icon: Zap,
      title: "Priority Support",
      description: "Get help when you need it most"
    },
    {
      icon: Star,
      title: "Quality Assurance",
      description: "Vetted subcontractors with proven track records"
    }
  ]

  const faqs = [
    {
      question: "What happens when beta pricing ends?",
      answer: "Beta pricing is significantly discounted from our planned launch pricing. We'll provide advance notice before any pricing changes, and existing subscribers will be grandfathered into their current pricing for a period of time."
    },
    {
      question: "Is there a free trial?",
      answer: "During our beta period, we're offering special pricing instead of a free trial. However, you can cancel your subscription at any time with no penalty."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, MasterCard, American Express) and process payments securely through Stripe. We can also arrange invoicing for larger annual contracts."
    },
    {
      question: "Can I change plans later?",
      answer: "Yes, you can upgrade, downgrade, or cancel your plan at any time from your account settings. Changes will be reflected in your next billing cycle."
    }
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300 overflow-hidden">
      <BackgroundPattern />

      <PublicLayout>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 text-center relative z-10">
        <div className={`flex justify-center mb-8 transition-all duration-1000 delay-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="bidi-orange-bg-light bidi-orange-text px-6 py-3 rounded-lg text-sm font-bold border border-orange/20 flex items-center space-x-2 shadow-sm animate-pulse">
            <AlertTriangle className="h-5 w-5" />
            <span>Beta Pricing - Limited Time</span>
          </div>
        </div>
        
        <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-8 tracking-tight transition-all duration-1000 delay-500 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          Simple, Transparent
          <span className="block bidi-orange-text">
            Pricing
          </span>
        </h1>
        
        <p className={`text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-4xl mx-auto font-medium transition-all duration-1000 delay-700 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          Choose the plan that works best for your business. 
          <strong className="bidi-orange-text"> Beta pricing is significantly discounted</strong> - 
          take advantage while you can!
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 py-8 sm:py-16 relative z-10">
        <div className={`max-w-5xl mx-auto transition-all duration-1000 delay-1000 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
        }`}>
          <div className="flex justify-center">
            {/* Monthly Pricing */}
            <div className="w-full max-w-lg">
              <Card className="relative hover:scale-105 transition-all duration-500 hover:shadow-2xl border-2 border-orange dark:border-orange-500 bg-white dark:bg-gray-950 w-full overflow-visible">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-orange/30 blur-xl -z-10 rounded-[30px] opacity-0 hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="bg-black text-white px-6 py-2 rounded-full text-sm font-bold flex items-center space-x-2 shadow-lg tracking-wide">
                    <Crown className="h-4 w-4 text-yellow-400" />
                    <span>MOST POPULAR</span>
                  </div>
                </div>
                
                <CardHeader className="text-center pb-6 pt-12 relative overflow-hidden">
                  {/* Background accent */}
                  <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-orange/10 to-transparent -z-10"></div>
                  
                  <div className="flex justify-center mb-4">
                    <div className="bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-4 py-1 rounded-full text-sm font-semibold border border-gray-200 dark:border-gray-700 shadow-sm">
                      Best Value
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold text-black dark:text-white mb-3">
                    Monthly Subscription
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300 mb-6 font-medium text-base">
                    Unlimited job requests - perfect for active contractors
                  </CardDescription>
                  <div className="text-center flex items-end justify-center mb-2">
                    <span className="text-6xl font-bold text-black dark:text-white tracking-tighter">$300</span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2 font-medium mb-2 text-lg">/month</span>
                  </div>
                  <div className="mt-2 inline-block">
                    <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                      Limited Time Beta Pricing
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-10">
                  <div className="w-full h-px bg-gray-100 dark:bg-gray-800"></div>
                  <ul className="space-y-4">
                    <li className="flex items-center space-x-4">
                      <div className="bg-green-100 rounded-full p-1">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">Unlimited job requests</span>
                    </li>
                    <li className="flex items-center space-x-4">
                      <div className="bg-green-100 rounded-full p-1">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">Send to unlimited subcontractors</span>
                    </li>
                    <li className="flex items-center space-x-4">
                      <div className="bg-green-100 rounded-full p-1">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">Advanced bid management</span>
                    </li>
                    <li className="flex items-center space-x-4">
                      <div className="bg-green-100 rounded-full p-1">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">Priority support</span>
                    </li>
                    <li className="flex items-center space-x-4">
                      <div className="bg-green-100 rounded-full p-1">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">Analytics dashboard</span>
                    </li>
                  </ul>
                  <div className="pt-4">
                    <Link href="/auth/signup">
                      <Button variant="orange" className="w-full text-xl py-6 font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1">
                        Start Monthly Plan
                        <ArrowRight className="ml-2 h-6 w-6" />
                      </Button>
                    </Link>
                    <p className="text-center text-xs text-gray-500 mt-4">
                      No commitment, cancel anytime
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 dark:bg-black py-16 sm:py-24 transition-colors duration-300 relative overflow-hidden">
        <div className="absolute inset-0 construction-grid opacity-30 -z-10"></div>
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12 sm:mb-16 tracking-tight">
            Everything You Need to Scale
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const sectionId = `feature-${index}`
              const isSectionVisible = visibleSections.has(sectionId)
              
              return (
                <div key={index} data-section-id={sectionId} className={`text-center p-6 rounded-xl hover:bg-white dark:hover:bg-gray-900 hover:shadow-lg transition-all duration-300 ${
                  isSectionVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`} style={{ transitionDelay: `${index * 100}ms` }}>
                  <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-gray-200 dark:border-gray-700 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-8 w-8 text-orange" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 font-medium">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 relative z-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-10 font-medium">
            Common questions about our pricing and plans
          </p>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 bg-white dark:bg-gray-950">
                <AccordionTrigger className="text-left text-lg font-bold text-gray-900 dark:text-gray-100 py-4 hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600 dark:text-gray-300 pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white dark:bg-black text-black dark:text-white py-16 sm:py-24 transition-colors duration-300 relative overflow-hidden">
         {/* Decorative background elements */}
         <div className="absolute inset-0 bg-gradient-to-br from-orange/5 via-transparent to-orange-500/5"></div>
         
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6 tracking-tight">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-700 dark:text-gray-300 mb-10 max-w-2xl mx-auto font-medium">
            Join the beta and take advantage of our special pricing while it lasts!
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/auth/signup">
              <Button 
                size="lg" 
                className="text-lg px-8 py-4 bg-orange text-white hover:bg-orange-600 font-bold shadow-lg hover:shadow-orange/20 w-full sm:w-auto"
              >
                Start Free Account 
              </Button>
            </Link>
            <Link href="/demo">
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-4 border-2 border-orange text-orange hover:bg-orange-50 dark:hover:bg-gray-900 font-bold w-full sm:w-auto"
              >
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      </PublicLayout>
    </div>
  )
}
