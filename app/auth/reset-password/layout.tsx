import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Set New Password',
  description: 'Set a new password for your Bidi account. Enter your new password below to complete the reset process.',
  alternates: {
    canonical: '/auth/reset-password',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

