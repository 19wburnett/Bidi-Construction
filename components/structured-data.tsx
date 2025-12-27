import Script from 'next/script'

interface StructuredDataProps {
  type?: 'Organization' | 'LocalBusiness' | 'SoftwareApplication' | 'WebSite'
  data?: Record<string, any>
}

export function StructuredData({ type = 'Organization', data }: StructuredDataProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bidicontracting.com'
  
  // Default organization data
  const defaultData = {
    '@context': 'https://schema.org',
    '@type': type,
    name: 'Bidi Contracting',
    alternateName: 'BIDI',
    url: baseUrl,
    logo: `${baseUrl}/brand/Bidi%20Contracting%20Logo.svg`,
    description: 'AI-powered construction estimating and automated bid management platform for General Contractors.',
    foundingDate: '2025',
    sameAs: [
      'https://www.facebook.com/profile.php?id=61585117637329',
      'https://www.linkedin.com/company/bidicontracting/',
      'https://www.instagram.com/bidi_contracting/',
      'https://www.youtube.com/@BidiContracting',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      email: 'weston@bidicontracting.com',
      availableLanguage: ['English'],
    },
  }

  // LocalBusiness specific data
  const localBusinessData = {
    ...defaultData,
    '@type': 'LocalBusiness',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'US',
      // Add specific address if available
    },
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
    serviceArea: {
      '@type': 'Country',
      name: 'United States',
    },
    priceRange: '$$',
    currenciesAccepted: 'USD',
  }

  // SoftwareApplication specific data
  const softwareAppData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Bidi Contracting Platform',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '99',
      priceCurrency: 'USD',
      priceValidUntil: '2025-12-31',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
    },
  }

  // WebSite specific data
  const websiteData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Bidi Contracting',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  let structuredData: Record<string, any> = defaultData
  if (type === 'LocalBusiness') {
    structuredData = localBusinessData
  } else if (type === 'SoftwareApplication') {
    structuredData = softwareAppData
  } else if (type === 'WebSite') {
    structuredData = websiteData
  }

  // Merge with custom data if provided
  const finalData = data ? { ...structuredData, ...data } : structuredData

  return (
    <Script
      id={`structured-data-${type.toLowerCase()}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(finalData) }}
    />
  )
}

