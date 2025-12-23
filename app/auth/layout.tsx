import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Sign In to Bidi',
    template: '%s | Bidi',
  },
  description: 'Sign in to your Bidi account to access AI-powered construction estimating and bid management tools.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}











