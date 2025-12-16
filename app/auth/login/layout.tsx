import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your General Contractor account on Bidi. Access AI-powered construction estimating, automated plan analysis, and complete bid management tools.',
  alternates: {
    canonical: '/auth/login',
  },
  openGraph: {
    title: 'Sign In to Bidi',
    description: 'Sign in to your General Contractor account on Bidi. Access AI-powered construction estimating and bid management tools.',
    url: '/auth/login',
    type: 'website',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}







