import type { Metadata } from 'next'
import { Saira_Stencil_One, Barlow } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import AuthErrorBoundary from '@/components/auth-error-boundary'
import MasqueradeBanner from '@/components/masquerade-banner'

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
  title: 'Bidi (Beta) - Connect General Contractors with Subcontractors',
  description: 'A marketplace connecting general contractors with qualified subcontractors for construction projects.',
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
        <Providers>
          <AuthErrorBoundary>
            <MasqueradeBanner />
            {children}
          </AuthErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}
