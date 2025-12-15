import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'For Subcontractors - Get More Jobs Automatically',
  description: 'Join our network of subcontractors and get jobs sent to your inbox. No software needed, just reply to our emails with your bid. Completely free to join. Also get professional quote generation service for $200/month.',
  keywords: ['subcontractor network', 'construction jobs', 'subcontractor opportunities', 'construction bidding', 'quote generation', 'subcontractor software'],
  alternates: {
    canonical: '/subcontractors',
  },
  openGraph: {
    title: 'For Subcontractors - Get More Jobs Automatically | Bidi',
    description: 'Join our network of subcontractors and get jobs sent to your inbox. No software needed, just reply to our emails with your bid. Completely free to join.',
    url: '/subcontractors',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'For Subcontractors - Get More Jobs Automatically | Bidi',
    description: 'Join our network of subcontractors and get jobs sent to your inbox. Completely free to join.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function SubcontractorsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}


