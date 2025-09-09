'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Navbar from '@/components/navbar'
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
      </div>

      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 text-center relative z-10">
        <div className="flex justify-center mb-6">
          <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Beta Pricing - Limited Time</span>
          </div>
        </div>
        
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
          Simple, Transparent
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {' '}Pricing
          </span>
        </h1>
        
        <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Choose the plan that works best for your business. 
          <strong className="text-orange-600"> Beta pricing is significantly discounted</strong> - 
          take advantage while you can!
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 py-8 sm:py-16 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Per Job Pricing */}
            <Card className="relative hover:scale-105 transition-all duration-300 hover:shadow-xl">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    Pay Per Use
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                  Per Job Request
                </CardTitle>
                <CardDescription className="text-gray-600 mb-4">
                  Perfect for occasional users or testing the platform
                </CardDescription>
                <div className="text-center">
                  <span className="text-4xl font-bold text-blue-600">$20</span>
                  <span className="text-gray-600 ml-2">per job request</span>
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
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Send job to up to 10 subcontractors</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Receive organized bids</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Email notifications</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Basic support</span>
                  </li>
                </ul>
                <div className="pt-4">
                  <Link href="/auth/signup">
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg py-3">
                      Start with Per Job
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Pricing */}
            <Card className="relative hover:scale-105 transition-all duration-300 hover:shadow-xl border-2 border-blue-200">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                  <Crown className="h-4 w-4" />
                  <span>MOST POPULAR</span>
                </div>
              </div>
              <CardHeader className="text-center pb-4 pt-8">
                <div className="flex justify-center mb-4">
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    Best Value
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                  Monthly Subscription
                </CardTitle>
                <CardDescription className="text-gray-600 mb-4">
                  Unlimited job requests - perfect for active contractors
                </CardDescription>
                <div className="text-center">
                  <span className="text-4xl font-bold text-blue-600">$100</span>
                  <span className="text-gray-600 ml-2">per month</span>
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
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Unlimited job requests</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Send to unlimited subcontractors</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Advanced bid management</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Priority support</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Analytics dashboard</span>
                  </li>
                </ul>
                <div className="pt-4">
                  <Link href="/auth/signup">
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg py-3">
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
      <section className="bg-gray-50 py-8 sm:py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12">
            What's Included in Both Plans
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 relative z-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12">
          Frequently Asked Questions
        </h2>
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What happens when beta pricing ends?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Beta pricing is significantly discounted from our planned launch pricing. 
                We'll provide advance notice before any pricing changes, and existing subscribers 
                will be grandfathered into their current pricing for a period of time.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Can I switch between plans?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Yes! You can upgrade from per-job to monthly at any time, or downgrade 
                from monthly to per-job at your next billing cycle.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Is there a free trial?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                During our beta period, we're offering special pricing instead of a free trial. 
                You can start with our per-job pricing at just $20 to test the platform.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What payment methods do you accept?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                We accept all major credit cards (Visa, MasterCard, American Express) 
                and process payments securely through Stripe.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-8 sm:py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg sm:text-xl mb-8 opacity-90">
            Join the beta and take advantage of our special pricing while it lasts!
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth/signup">
              <Button 
                size="lg" 
                className="text-base sm:text-lg px-6 sm:px-8 py-3 bg-white text-blue-600 hover:bg-gray-100 border-2 border-white"
              >
                Start Free Account
              </Button>
            </Link>
            <Link href="/demo">
              <Button 
                size="lg" 
                variant="outline"
                className="text-base sm:text-lg px-6 sm:px-8 py-3 border-2 border-white text-white hover:bg-white hover:text-blue-600"
              >
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Building2 className="h-6 w-6" />
            <span className="text-xl font-bold">Bidi</span>
            <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2 py-1 rounded-full border border-orange-200">
              BETA
            </span>
          </div>
          <p className="text-gray-400">
            © 2024 Bidi. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
