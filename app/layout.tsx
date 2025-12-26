import type { Metadata } from 'next'
import { Saira_Stencil_One, Barlow } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import AuthErrorBoundary from '@/components/auth-error-boundary'

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
    default: 'Bidi - AI-Powered Construction Estimating & Bid Management',
    template: '%s | Bidi',
  },
  description: 'AI-powered construction estimating and automated bid management platform. From automated plan analysis to final bid delivery - we handle everything for General Contractors.',
  keywords: ['construction estimating', 'bid management', 'construction software', 'general contractors', 'subcontractors', 'AI estimating', 'construction takeoff', 'automated bidding'],
  authors: [{ name: 'Bidi Contracting' }],
  creator: 'Bidi Contracting',
  publisher: 'Bidi Contracting',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://bidicontracting.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Bidi',
    title: 'Bidi - AI-Powered Construction Estimating & Bid Management',
    description: 'AI-powered construction estimating and automated bid management platform. From automated plan analysis to final bid delivery - we handle everything for General Contractors.',
    images: [
      {
        url: '/brand/Bidi%20Contracting%20Logo.svg',
        width: 1200,
        height: 630,
        alt: 'Bidi Construction Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bidi - AI-Powered Construction Estimating & Bid Management',
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
      </head>
      <body className={barlow.className} suppressHydrationWarning>
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
