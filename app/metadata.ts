import { Metadata } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bidicontracting.com'

export const homepageMetadata: Metadata = {
  title: 'Bidi - AI-Powered Construction Estimating & Bid Management',
  description: 'AI-powered construction estimating and automated bid management platform for General Contractors. Automated plan analysis, takeoff, and bid collection across the United States.',
  keywords: [
    'construction estimating software',
    'bid management platform',
    'construction takeoff software',
    'AI construction estimating',
    'general contractor software',
    'construction bid software',
    'automated construction estimating',
    'construction management software',
    'GC software',
    'construction technology',
    'construction software USA',
    'construction estimating tool',
  ],
  openGraph: {
    title: 'BIDI - AI-Powered Construction Estimating & Bid Management',
    description: 'AI-powered construction estimating and automated bid management platform. From automated plan analysis to final bid delivery - we handle everything for General Contractors.',
    url: baseUrl,
    siteName: 'BIDI Construction',
    locale: 'en_US',
    type: 'website',
  },
  alternates: {
    canonical: baseUrl,
  },
  other: {
    'geo.region': 'US',
    'geo.placename': 'United States',
  },
}

