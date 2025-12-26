import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing - Simple, Transparent Plans',
  description: 'Choose the plan that works best for your business. Beta pricing is significantly discounted - take advantage while you can! Monthly subscription plans for General Contractors.',
  keywords: ['construction software pricing', 'bid management pricing', 'construction platform cost', 'general contractor software', 'beta pricing'],
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'Pricing - Simple, Transparent Plans | Bidi',
    description: 'Choose the plan that works best for your business. Beta pricing is significantly discounted - take advantage while you can!',
    url: '/pricing',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Pricing - Simple, Transparent Plans | Bidi',
    description: 'Choose the plan that works best for your business. Beta pricing is significantly discounted.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}














