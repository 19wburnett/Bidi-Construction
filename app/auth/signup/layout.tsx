import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your Bidi account to get started with AI-powered construction estimating and automated bid management. Sign up as a General Contractor or Subcontractor.',
  alternates: {
    canonical: '/auth/signup',
  },
  openGraph: {
    title: 'Sign Up for Bidi',
    description: 'Create your Bidi account to get started with AI-powered construction estimating and automated bid management.',
    url: '/auth/signup',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}







