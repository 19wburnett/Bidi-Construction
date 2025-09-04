'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Navbar from '@/components/navbar'
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
  Star
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

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [showBids, setShowBids] = useState(false)

  const steps = [
    {
      title: 'Submit Your Project',
      description: 'Provide basic project details and requirements',
      icon: Building2,
      color: 'blue'
    },
    {
      title: 'Automated Search',
      description: 'Our system finds qualified subcontractors in your area',
      icon: Mail,
      color: 'green'
    },
    {
      title: 'Collect Bids',
      description: 'We automatically collect and organize incoming bids',
      icon: Users,
      color: 'purple'
    },
    {
      title: 'AI Analysis',
      description: 'Our AI levels and presents all bids for easy comparison',
      icon: FileText,
      color: 'orange'
    }
  ]

  const runDemo = async () => {
    setIsRunning(true)
    setShowBids(false)
    
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    setShowBids(true)
    setIsRunning(false)
  }

  const resetDemo = () => {
    setCurrentStep(0)
    setShowBids(false)
    setIsRunning(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Demo Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            See How Our Search Tool Works
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Watch our automated system find subcontractors, collect bids, and present them in an easy-to-read format.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={runDemo} 
              disabled={isRunning}
              size="lg" 
              className="text-base px-8 py-3"
            >
              <Play className="h-5 w-5 mr-2" />
              {isRunning ? 'Running Demo...' : 'Start Demo'}
            </Button>
            <Button 
              onClick={resetDemo} 
              variant="outline" 
              size="lg" 
              className="text-base px-8 py-3"
            >
              Reset Demo
            </Button>
          </div>
        </div>

        {/* Demo Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep >= index
            const isCurrent = currentStep === index
            
            return (
              <Card 
                key={index}
                className={`transition-all duration-500 ${
                  isActive 
                    ? 'ring-2 ring-blue-500 shadow-lg' 
                    : 'opacity-50'
                } ${isCurrent ? 'scale-105' : ''}`}
              >
                <CardHeader className="text-center">
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                    isActive 
                      ? `bg-${step.color}-100` 
                      : 'bg-gray-100'
                  }`}>
                    <Icon className={`h-8 w-8 ${
                      isActive 
                        ? `text-${step.color}-600` 
                        : 'text-gray-400'
                    }`} />
                  </div>
                  <CardTitle className={`text-lg ${
                    isActive ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {step.description}
                  </CardDescription>
                  {isCurrent && (
                    <div className="mt-2">
                      <Badge variant="default" className="bg-blue-600">
                        In Progress...
                      </Badge>
                    </div>
                  )}
                  {isActive && !isCurrent && (
                    <div className="mt-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                    </div>
                  )}
                </CardHeader>
              </Card>
            )
          })}
        </div>

        {/* Sample Project */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-blue-600" />
              Sample Project: Kitchen Renovation
            </CardTitle>
            <CardDescription>
              Residential kitchen renovation in downtown area, 200 sq ft, modern design
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Budget:</strong> $40,000 - $50,000
              </div>
              <div>
                <strong>Timeline:</strong> 2-4 weeks
              </div>
              <div>
                <strong>Location:</strong> Downtown, 5-mile radius
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {showBids && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Your Leveled Bids Are Ready!
              </h2>
              <p className="text-gray-600">
                Our AI has analyzed and organized all received bids for easy comparison
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {sampleBids.map((bid, index) => (
                <Card key={bid.id} className="relative">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{bid.company}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <MapPin className="h-4 w-4 mr-1" />
                          {bid.location}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        #{index + 1} Choice
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                        <span className="font-semibold text-lg">{bid.price}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-blue-600" />
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

                    <Button className="w-full mt-4">
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
        <div className="text-center mt-12 p-8 bg-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to Try This for Your Project?
          </h2>
          <p className="text-gray-600 mb-6">
            Stop wasting time searching for subcontractors. Let our automated system do the work for you.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth/signup">
              <Button size="lg" className="text-base px-8 py-3">
                Start Your Search Now
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="lg" className="text-base px-8 py-3">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
