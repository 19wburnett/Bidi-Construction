'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import Link from 'next/link'
import { 
  Building2, 
  CheckCircle, 
  ArrowRight, 
  Star,
  Zap,
  Users,
  Mail,
  FileText,
  Clock,
  DollarSign,
  AlertTriangle,
  Crown
} from 'lucide-react'

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)

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

  return (
    <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300">
      {/* Professional Construction Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white dark:from-black dark:to-orange-950/20"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-orange"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange/5 dark:bg-orange/10 rounded-full blur-3xl"></div>
      </div>

      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center relative z-10">
        <div className="flex justify-center mb-8">
          <div className="bidi-orange-bg-light bidi-orange-text px-6 py-3 rounded-lg text-sm font-bold border border-orange/20 flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Beta Pricing - Limited Time</span>
          </div>
        </div>
        
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-8 tracking-tight">
          Simple, Transparent
          <span className="block bidi-orange-text">
            Pricing
          </span>
        </h1>
        
        <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-4xl mx-auto font-medium">
          Choose the plan that works best for your business. 
          <strong className="bidi-orange-text"> Beta pricing is significantly discounted</strong> - 
          take advantage while you can!
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 py-8 sm:py-16 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center">
            {/* Monthly Pricing */}
            <Card className="relative hover:scale-105 transition-all duration-300 hover:shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 w-full max-w-lg">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-black text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                  <Crown className="h-4 w-4" />
                  <span>MOST POPULAR</span>
                </div>
              </div>
              <CardHeader className="text-center pb-4 pt-8">
                <div className="flex justify-center mb-4">
                  <div className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-semibold border border-gray-200">
                    Best Value
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-black dark:text-white mb-2">
                  Monthly Subscription
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300 mb-4 font-medium">
                  Unlimited job requests - perfect for active contractors
                </CardDescription>
                <div className="text-center">
                  <span className="text-4xl font-bold text-black dark:text-white">$300</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2 font-medium">per month</span>
                </div>
                <div className="mt-2">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                    BETA PRICING
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-gray-700 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Unlimited job requests</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-gray-700 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Send to unlimited subcontractors</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-gray-700 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Advanced bid management</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-gray-700 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Priority support</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-gray-700 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Analytics dashboard</span>
                  </li>
                </ul>
                <div className="pt-4">
                  <Link href="/auth/signup">
                    <Button variant="orange" className="w-full text-lg py-3 font-bold">
                      Start Monthly Plan
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 dark:bg-black py-8 sm:py-16 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-8 sm:mb-12">
            What's Included in Both Plans
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-8 w-8 text-black-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 relative z-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-8 sm:mb-12">
          Frequently Asked Questions
        </h2>
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg dark:text-white">What happens when beta pricing ends?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Beta pricing is significantly discounted from our planned launch pricing. 
                We'll provide advance notice before any pricing changes, and existing subscribers 
                will be grandfathered into their current pricing for a period of time.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg dark:text-white">Is there a free trial?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                During our beta period, we're offering special pricing instead of a free trial. 
                You can cancel your subscription at any time.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg dark:text-white">What payment methods do you accept?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                We accept all major credit cards (Visa, MasterCard, American Express) 
                and process payments securely through Stripe.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white dark:bg-black text-black dark:text-white py-8 sm:py-16 transition-colors duration-300">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 mb-8">
            Join the beta and take advantage of our special pricing while it lasts!
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth/signup">
              <Button 
                size="lg" 
                className="text-base sm:text-lg px-6 sm:px-8 py-3 bg-orange text-white hover:bg-white hover:text-orange border-2 border-orange"
              >
                Start Free Account 
              </Button>
            </Link>
            <Link href="/demo">
              <Button 
                size="lg" 
                variant="outline"
                className="text-base sm:text-lg px-6 sm:px-8 py-3 border-2 bg-white border-orange text-orange hover:bg-white hover:text-orange"
              >
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
