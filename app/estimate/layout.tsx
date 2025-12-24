import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Estimate on Construction Plans - Get AI-Powered Analysis',
  description: 'Join our waitlist for free estimates on your construction plans. Get instant AI-powered analysis and cost estimates using our advanced construction estimating technology. No cost, no commitment.',
  keywords: [
    'free construction estimate',
    'construction plan estimate',
    'AI construction estimating',
    'free building estimate',
    'construction cost estimate',
    'plan analysis',
    'construction takeoff',
    'free estimate waitlist',
    'construction plans analysis',
    'building cost estimate'
  ],
  alternates: {
    canonical: '/estimate',
  },
  openGraph: {
    title: 'Free Estimate on Construction Plans - Get AI-Powered Analysis | Bidi',
    description: 'Join our waitlist for free estimates on your construction plans. Get instant AI-powered analysis and cost estimates. No cost, no commitment.',
    url: '/estimate',
    type: 'website',
    siteName: 'Bidi',
    images: [
      {
        url: '/brand/Bidi%20Contracting%20Logo.svg',
        width: 1200,
        height: 630,
        alt: 'Bidi Construction - Free Estimate on Plans',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Estimate on Construction Plans - Get AI-Powered Analysis | Bidi',
    description: 'Join our waitlist for free estimates on your construction plans. Get instant AI-powered analysis and cost estimates.',
    images: ['/brand/Bidi%20Contracting%20Logo.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function EstimateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

