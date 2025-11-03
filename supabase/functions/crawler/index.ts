// Import required modules from Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

// Firecrawl API configuration
const FIRECRAWL_API_BASE_URL = "https://api.firecrawl.dev";

// Categories to search
const categories = ["plumber", "electrician", "roofer", "hvac", "drywall"];

// Expanded search queries for better coverage
const searchQueries = [
  // Standard searches
  { query: "Utah {category} contractor", weight: 1 },
  { query: "Utah {category} company", weight: 1 },
  
  // City-specific searches
  { query: "Salt Lake City {category}", weight: 2 },
  { query: "Provo {category} contractor", weight: 2 },
  { query: "Ogden {category} contractor", weight: 2 },
  { query: "Lehi {category} company", weight: 2 },
  { query: "Orem {category}", weight: 2 },
  
  // Niche searches for smaller/obscure contractors
  { query: "Utah {category} LLC", weight: 3 },
  { query: "Utah {category} business", weight: 3 },
  { query: "small {category} Utah", weight: 3 },
  { query: "local {category} Utah contractor", weight: 3 },
  { query: "independent {category} Utah", weight: 3 },
  
  // Specialty/niche searches
  { query: "{category} services Utah", weight: 4 },
  { query: "{category} specialist Utah", weight: 4 },
  { query: "Utah {category} residential", weight: 4 },
  { query: "Utah {category} commercial", weight: 4 },
];

/**
 * Firecrawl Search API wrapper
 */
async function firecrawlSearch(query: string, numResults: number) {
  const apiKey = Deno.env.get("FIRECRAWL_KEY");
  if (!apiKey) {
    throw new Error("Missing FIRECRAWL_KEY in environment variables");
  }

  try {
    console.log(`  🔍 Searching: "${query}"`);
    
    const response = await fetch(`${FIRECRAWL_API_BASE_URL}/v2/search`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: numResults,
      }),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    const results = data.data?.web || data.data || [];
    console.log(`  📊 Found ${results.length} results`);
    
    return { results };
  } catch (err) {
    console.error(`  ❌ Firecrawl search error for "${query}":`, err);
    return { results: [] };
  }
}

/**
 * Firecrawl Extract API wrapper
 */
async function firecrawlExtract(url: string) {
  const apiKey = Deno.env.get("FIRECRAWL_KEY");
  if (!apiKey) {
    throw new Error("Missing FIRECRAWL_KEY in environment variables");
  }

  try {
    // Retry logic for rate limits
    let retries = 3;
    let lastError = null;
    
    while (retries > 0) {
      try {
        const response = await fetch(`${FIRECRAWL_API_BASE_URL}/v2/extract`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
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
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return { data: [data.data] };
        }
        
        // Handle rate limits with backoff
        if (response.status === 429) {
          const waitTime = Math.pow(2, 4 - retries) * 1000; // Exponential backoff
          console.log(`  ⏳ Rate limited, waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries--;
          continue;
        }
        
        throw new Error(`Extract failed: ${response.status}`);
      } catch (err) {
        lastError = err;
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // All retries failed
    throw lastError;
  } catch (err) {
    console.error(`  ❌ Firecrawl extract error for "${url}":`, err);
    return null;
  }
}

/**
 * Search for Google Reviews
 */
async function searchGoogleReviews(businessName: string, location: string = "Utah") {
  const apiKey = Deno.env.get("FIRECRAWL_KEY");
  if (!apiKey) {
    return null;
  }

  try {
    const query = `"${businessName}" reviews ${location} site:google.com`;
    console.log(`  🌐 Searching Google Reviews for: ${businessName}`);
    
    const response = await fetch(`${FIRECRAWL_API_BASE_URL}/v2/search`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google search failed: ${response.status}`);
    }

    const data = await response.json();
    const results = data.data?.web || data.data || [];
    
    if (results.length > 0) {
      const googleUrl = results[0].url;
      console.log(`  📊 Found Google result: ${googleUrl}`);
      
      // Extract structured data from Google Reviews page
      const extractResponse = await fetch(`${FIRECRAWL_API_BASE_URL}/v2/extract`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: googleUrl,
          schema: {
            average_rating: "number",
            total_reviews: "string",
            reviews_link: "string",
          },
        }),
      });

      if (extractResponse.ok) {
        const extractData = await extractResponse.json();
        return extractData.data || null;
      }
    }
    
    return null;
  } catch (err) {
    console.error(`  ❌ Google Reviews search error:`, err);
    return null;
  }
}

/**
 * Check if subcontractor exists
 */
async function subcontractorExists(supabase: any, email: string | null, websiteUrl: string | null) {
  try {
    let query = supabase.from("subcontractors").select("id");
    
    const conditions = [];
    if (email) conditions.push(`email.eq.${email}`);
    if (websiteUrl) conditions.push(`website_url.eq.${websiteUrl}`);
    
    if (conditions.length === 0) return false;
    
    query = query.or(conditions.join(","));
    const { data, error } = await query;
    
    if (error) {
      console.error("Error checking subcontractor existence:", error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error("Exception checking subcontractor existence:", error);
    return false;
  }
}

/**
 * Main crawler function
 */
async function crawlUtahSubcontractors(supabase: any) {
  console.log("\n🚀 Starting Utah subcontractor crawl...\n");
  
  let totalProcessed = 0;
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const category of categories) {
    console.log(`📋 Processing category: ${category}`);
    
    // Use weighted random search queries to find more obscure contractors
    // Lower weight = more common searches (run more often)
    // Higher weight = niche/obscure searches (run less often)
    const weightedQueries = searchQueries.map(sq => 
      Array(sq.weight).fill(sq.query.replace('{category}', category))
    ).flat();
    
    // Randomly select query to use
    const randomQuery = weightedQueries[Math.floor(Math.random() * weightedQueries.length)];
    const searchResults = await firecrawlSearch(randomQuery, 20);
    
    if (!searchResults?.results || searchResults.results.length === 0) {
      console.log(`  ⚠️  No results found for ${category}\n`);
      continue;
    }

    // Process each URL from search results
    for (const result of searchResults.results) {
      const url = result.url;
      totalProcessed++;
      
      try {
        // Check if this URL already exists in the database
        const urlExists = await subcontractorExists(supabase, null, url);
        if (urlExists) {
          console.log(`  ⏩ Skipping duplicate URL: ${url}`);
          totalSkipped++;
          continue;
        }

        // Extract structured data from the webpage
        const extracted = await firecrawlExtract(url);
        const info = extracted?.data?.[0];
        
        if (!info || !info.business_name) {
          console.log(`  ⚠️  No valid data extracted from: ${url}`);
          continue;
        }

        // Normalize email - use placeholder if none found
        const email = info.email?.toLowerCase()?.trim() || `no-email-${Date.now()}@placeholder.local`;
        
        // Check for duplicates by email (only if it's not a placeholder)
        if (email && !email.includes('placeholder')) {
          const emailExists = await subcontractorExists(supabase, email, null);
          if (emailExists) {
            console.log(`  ⏩ Skipping duplicate email: ${email}`);
            totalSkipped++;
            continue;
          }
        }

        // Search for Google Reviews if not already found on website
        let googleData = null;
        if (!info.google_review_score) {
          const businessName = info.business_name || "Unknown";
          const location = info.city || "Utah";
          googleData = await searchGoogleReviews(businessName, location);
          
          // Add a delay after Google Reviews search
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Prepare data for insertion
        const googleReviewScore = info.google_review_score || googleData?.average_rating || null;
        const googleReviewsLink = info.google_reviews_link || googleData?.reviews_link || null;
        
        const subcontractorData = {
          name: info.business_name || "Unknown",
          email: email,
          phone: info.phone || null,
          trade_category: category,
          location: info.city || "Utah",
          website_url: url,
          google_review_score: googleReviewScore,
          google_reviews_link: googleReviewsLink,
          time_in_business: info.time_in_business || null,
          licensed: info.licensed || null,
          bonded: info.bonded || null,
          notes: info.notes || null,
          created_at: new Date().toISOString(),
        };

        // Insert the new subcontractor
        const { data: insertData, error: insertError } = await supabase
          .from("subcontractors")
          .insert(subcontractorData)
          .select();
        
        if (insertError) {
          console.error(`  ❌ Failed to add ${info.business_name}: ${insertError.message}`);
          totalErrors++;
        } else {
          console.log(`  ✅ Added: ${info.business_name} (${category})`);
          totalAdded++;
        }

        // Add a delay to be respectful to the APIs and avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds between extractions

      } catch (error) {
        console.error(`  ❌ Error processing ${url}:`, error);
        totalErrors++;
        // Longer delay on errors to avoid compounding rate limit issues
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`  ✓ Finished ${category}\n`);
    
    // Add a longer delay between categories
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Print summary
  console.log("\n📊 Crawl Summary:");
  console.log(`  Total processed: ${totalProcessed}`);
  console.log(`  Added: ${totalAdded}`);
  console.log(`  Skipped (duplicates): ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log("\n✅ Crawl completed!\n");
  
  return {
    totalProcessed,
    totalAdded,
    totalSkipped,
    totalErrors,
  };
}

/**
 * Main Edge Function handler
 */
serve(async (req) => {
  // Handle CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Run the crawler
    const results = await crawlUtahSubcontractors(supabase);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Crawl completed successfully",
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

