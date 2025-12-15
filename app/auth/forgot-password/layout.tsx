import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reset Your Password',
  description: 'Reset your Bidi account password. Enter your email address and we\'ll send you a link to reset your password.',
  alternates: {
    canonical: '/auth/forgot-password',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}


