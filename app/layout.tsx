import type { Metadata } from 'next'
import { Saira_Stencil_One, Barlow } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import AuthErrorBoundary from '@/components/auth-error-boundary'
import { StructuredData } from '@/components/structured-data'

const sairaStencilOne = Saira_Stencil_One({ 
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-saira-stencil',
})

const barlow = Barlow({ 
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-barlow',
})

export const metadata: Metadata = {
  title: {
    default: 'BIDI - AI-Powered Construction Estimating & Bid Management',
    template: '%s | BIDI',
  },
  description: 'AI-powered construction estimating and automated bid management platform. From automated plan analysis to final bid delivery - we handle everything for General Contractors.',
  keywords: [
    'construction estimating',
    'bid management',
    'construction software',
    'general contractors',
    'subcontractors',
    'AI estimating',
    'construction takeoff',
    'automated bidding',
    'construction bid software',
    'construction estimating software',
    'takeoff software',
    'construction management',
    'bid collection',
    'construction technology',
    'construction AI',
    'construction software USA',
    'construction estimating tool',
    'GC software',
    'construction bid platform',
  ],
  authors: [{ name: 'BIDI Contracting' }],
  creator: 'BIDI Contracting',
  publisher: 'BIDI Contracting',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://bidicontracting.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'BIDI',
    title: 'BIDI - AI-Powered Construction Estimating & Bid Management',
    description: 'AI-powered construction estimating and automated bid management platform. From automated plan analysis to final bid delivery - we handle everything for General Contractors.',
    images: [
      {
        url: '/brand/Bidi%20Contracting%20Logo.svg',
        width: 1200,
        height: 630,
        alt: 'BIDI Construction Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BIDI - AI-Powered Construction Estimating & Bid Management',
    description: 'AI-powered construction estimating and automated bid management platform for General Contractors.',
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
  icons: {
    icon: [
      { url: '/brand/Bidi%20Contracting%20Logo.svg', type: 'image/svg+xml' },
    ],
    shortcut: ['/brand/Bidi%20Contracting%20Logo.svg'],
    apple: ['/brand/Bidi%20Contracting%20Logo.svg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${barlow.variable} ${sairaStencilOne.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="geo.region" content="US" />
        <meta name="geo.placename" content="United States" />
        <meta name="language" content="English" />
        <meta name="distribution" content="global" />
        <meta name="rating" content="general" />
        <meta name="revisit-after" content="7 days" />
        <link rel="canonical" href={process.env.NEXT_PUBLIC_APP_URL || 'https://bidicontracting.com'} />
      </head>
      <body className={barlow.className} suppressHydrationWarning>
        <StructuredData type="Organization" />
        <StructuredData type="SoftwareApplication" />
        <StructuredData type="WebSite" />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-SX6C5ZZ8EN"
          strategy="afterInteractive"
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17834110171"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-SX6C5ZZ8EN');
            gtag('config', 'AW-17834110171');
          `}
        </Script>
        <Providers>
          <AuthErrorBoundary>
            {children}
          </AuthErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}
