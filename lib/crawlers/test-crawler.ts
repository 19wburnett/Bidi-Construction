export async function crawlTest(
  tradeCategory: string, 
  location: string, 
  maxResults: number
): Promise<any[]> {
  console.log(`Running test crawler for ${tradeCategory} in ${location}`)
  
  const results = []
  
  // Generate mock contractor data
  const mockContractors = [
    {
      name: `${tradeCategory} Pro Solutions`,
      email: `info@${tradeCategory.toLowerCase()}pro.com`,
      phone: '(555) 123-4567',
      address: `123 Main St, ${location}`,
      rating: 4.5,
      website: `https://www.${tradeCategory.toLowerCase()}pro.com`,
      source: 'test_crawler',
      verified: false
    },
    {
      name: `Elite ${tradeCategory} Services`,
      email: `contact@elite${tradeCategory.toLowerCase()}.com`,
      phone: '(555) 234-5678',
      address: `456 Oak Ave, ${location}`,
      rating: 4.8,
      website: `https://www.elite${tradeCategory.toLowerCase()}.com`,
      source: 'test_crawler',
      verified: false
    },
    {
      name: `${tradeCategory} Masters LLC`,
      email: `hello@${tradeCategory.toLowerCase()}masters.com`,
      phone: '(555) 345-6789',
      address: `789 Pine Rd, ${location}`,
      rating: 4.2,
      website: `https://www.${tradeCategory.toLowerCase()}masters.com`,
      source: 'test_crawler',
      verified: false
    },
    {
      name: `Premium ${tradeCategory} Co.`,
      email: `admin@premium${tradeCategory.toLowerCase()}.com`,
      phone: '(555) 456-7890',
      address: `321 Elm St, ${location}`,
      rating: 4.7,
      website: `https://www.premium${tradeCategory.toLowerCase()}.com`,
      source: 'test_crawler',
      verified: false
    },
    {
      name: `Expert ${tradeCategory} Group`,
      email: `office@expert${tradeCategory.toLowerCase()}.com`,
      phone: '(555) 567-8901',
      address: `654 Maple Dr, ${location}`,
      rating: 4.3,
      website: `https://www.expert${tradeCategory.toLowerCase()}.com`,
      source: 'test_crawler',
      verified: false
    }
  ]
  
  // Return up to maxResults contractors
  const contractorsToReturn = mockContractors.slice(0, Math.min(maxResults, mockContractors.length))
  
  console.log(`Test crawler generated ${contractorsToReturn.length} mock contractors`)
  return contractorsToReturn
}

