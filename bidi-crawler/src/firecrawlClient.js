import axios from "axios";
import "dotenv/config";

const apiKey = process.env.FIRECRAWL_KEY;
const FIRECRAWL_API_BASE_URL = "https://api.firecrawl.dev";

if (!apiKey) {
  throw new Error("Missing FIRECRAWL_KEY in environment variables");
}

/**
 * Search using Firecrawl's search API
 * @param {string} query - Search query
 * @param {number} numResults - Number of results to return
 * @returns {Promise<Object>} Search results
 */
export async function firecrawlSearch(query, numResults = 10) {
  try {
    console.log(`  🔍 Searching: "${query}"`);
    
    const response = await axios.post(
      `${FIRECRAWL_API_BASE_URL}/v2/search`,
      {
        query,
        limit: numResults,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Firecrawl v2 search returns data in response.data.data.web format
    const results = response.data.data?.web || response.data.data || [];
    console.log(`  📊 Found ${results.length} results`);
    
    return { results };
  } catch (err) {
    console.error(`  ❌ Firecrawl search error for "${query}":`, err.message);
    return { results: [] };
  }
}

/**
 * Extract structured data using Firecrawl's extract API
 * @param {string} url - URL to extract data from
 * @returns {Promise<Object|null>} Extracted data or null on error
 */
export async function firecrawlExtract(url) {
  // Retry logic for rate limits with exponential backoff
  let retries = 3;
  let lastError = null;
  
  while (retries > 0) {
    try {
      const response = await axios.post(
        `${FIRECRAWL_API_BASE_URL}/v2/extract`,
        {
          url,
          schema: {
            business_name: "string",
            phone: "string",
            email: "string",
            website: "string",
            city: "string",
            services: "string",
            google_review_score: "number",
            google_reviews_link: "string",
            time_in_business: "string",
            licensed: "boolean",
            bonded: "boolean",
            notes: "string",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return { data: [response.data.data] };
    } catch (err) {
      lastError = err;
      
      // Handle rate limits with exponential backoff
      if (err.response?.status === 429) {
        const waitTime = Math.pow(2, 4 - retries) * 1000;
        console.log(`  ⏳ Rate limited, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retries--;
        continue;
      }
      
      // For other errors, retry once
      if (retries > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      retries--;
    }
  }
  
  // All retries failed
  console.error(`  ❌ Firecrawl extract error for "${url}":`, lastError?.message || 'Unknown error');
  return null;
}

/**
 * Search for Google Reviews using business name and location
 * @param {string} businessName - Name of the business
 * @param {string} location - City/location (e.g., "Utah")
 * @returns {Promise<Object|null>} Google Reviews data or null on error
 */
export async function searchGoogleReviews(businessName, location = "Utah") {
  try {
    const query = `"${businessName}" reviews ${location} site:google.com`;
    console.log(`  🌐 Searching Google Reviews for: ${businessName}`);
    
    const response = await axios.post(
      `${FIRECRAWL_API_BASE_URL}/v2/search`,
      {
        query,
        limit: 3,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const results = response.data.data?.web || response.data.data || [];
    
    if (results.length > 0) {
      // Try to extract Google Reviews data from the first result
      const googleUrl = results[0].url;
      console.log(`  📊 Found Google result: ${googleUrl}`);
      
      // Extract structured data from Google Reviews page
      const extractResponse = await axios.post(
        `${FIRECRAWL_API_BASE_URL}/v2/extract`,
        {
          url: googleUrl,
          schema: {
            average_rating: "number",
            total_reviews: "string",
            reviews_link: "string",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return extractResponse.data.data || null;
    }
    
    return null;
  } catch (err) {
    console.error(`  ❌ Google Reviews search error:`, err.message);
    return null;
  }
}