import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bidi Contracting - Contact Card',
  description: 'Connect with Bidi Contracting - Download contact info and learn about our construction bidding platform.',
  openGraph: {
    title: 'Bidi Contracting - Contact Card',
    description: 'Connect with Bidi Contracting - Download contact info and learn about our construction bidding platform.',
    url: 'https://bidicontracting.com/card',
    siteName: 'Bidi Contracting',
    type: 'website',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function CardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

