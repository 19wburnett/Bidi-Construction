import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// import { Button as HeroUIButton } from '@heroui/button'
// import { Card as HeroUICard, CardBody, CardHeader as HeroUICardHeader } from '@heroui/card'
// import { Badge } from '@heroui/badge'
// import { Chip } from '@heroui/chip'
import Link from 'next/link'
import { Building2, Users, Mail, FileText, Star, CheckCircle } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">SubBidi</h1>
          </div>
          <div className="flex space-x-4">
            <Link href="/auth/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
            ✨ AI-Powered Bid Analysis
          </div>
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Connect General Contractors with
          <span className="text-blue-600"> Subcontractors</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Streamline your construction projects with our marketplace that connects GCs with qualified subcontractors. 
          Post jobs, receive bids, and manage projects all in one place.
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/auth/signup">
            <Button size="lg" className="text-lg px-8 py-3">
              Start as General Contractor
            </Button>
          </Link>
          <Link href="/subcontractor">
            <Button variant="outline" size="lg" className="text-lg px-8 py-3">
              Learn More for Subs
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          How SubBidi Works
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>1. Post Your Project</CardTitle>
              <CardDescription>
                General contractors post detailed job requests with specifications, budget, and timeline.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>2. Automatic Distribution</CardTitle>
              <CardDescription>
                We automatically email qualified subcontractors in your area and trade category.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>3. Receive Bids</CardTitle>
              <CardDescription>
                Subcontractors reply with detailed bids, pricing, and project timelines.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle>4. AI-Powered Analysis</CardTitle>
              <CardDescription>
                Our AI parses and organizes all bids for easy comparison and decision making.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Streamline Your Construction Projects?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of general contractors who trust SubBidi for their subcontractor needs.
          </p>
          <Link href="/auth/signup">
            <Button variant="secondary" size="lg" className="text-lg px-8 py-3">
              Get Started Today
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Building2 className="h-6 w-6" />
            <span className="text-xl font-bold">SubBidi</span>
          </div>
          <p className="text-gray-400">
            © 2024 SubBidi. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
