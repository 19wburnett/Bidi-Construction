import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Card - Bidi Contracting',
  description: 'Connect with Bidi Contracting - Download contact info and learn about our construction bidding platform. Get our phone number, email, and website information.',
  keywords: ['Bidi Contracting contact', 'construction platform contact', 'bid management contact', 'construction software support'],
  alternates: {
    canonical: '/card',
  },
  openGraph: {
    title: 'Contact Card - Bidi Contracting',
    description: 'Connect with Bidi Contracting - Download contact info and learn about our construction bidding platform.',
    url: '/card',
    siteName: 'Bidi',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Contact Card - Bidi Contracting',
    description: 'Connect with Bidi Contracting - Download contact info and learn about our construction bidding platform.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

