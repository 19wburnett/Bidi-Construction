// Import required modules from Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

// Firecrawl API configuration
const FIRECRAWL_API_BASE_URL = "https://api.firecrawl.dev";

// Categories to search
const categories = ["plumber", "electrician", "roofer", "hvac", "drywall"];

// Runtime guardrails (Edge Functions have ~60s limit)
const DEFAULT_MAX_CATEGORIES_PER_RUN = 3;
const DEFAULT_MAX_RESULTS_PER_CATEGORY = 5;
const DEFAULT_MAX_QUERIES_PER_CATEGORY = 4;
const RESULT_DELAY_MS = 1_200;
const CATEGORY_DELAY_MS = 2_000;
const ERROR_DELAY_MS = 4_000;
const RATE_LIMIT_DELAY_MS = 1_500;
const MAX_RUN_TIME_MS = 55_000;

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
 * Utility helpers for URL/email normalization
 */
function ensureProtocol(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function normalizeUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(ensureProtocol(trimmed));
    url.hash = "";
    url.search = "";
    // Remove trailing slash unless root
    if (url.pathname === "/") {
      url.pathname = "";
    } else {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch (_err) {
    return trimmed;
  }
}

function extractDomain(rawUrl: string | null): string | null {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    return url.hostname.replace(/^www\./, "");
  } catch (_err) {
    return null;
  }
}

function generatePlaceholderEmail(input: { businessName?: string | null; websiteUrl?: string | null; category: string }): string | null {
  const domain = extractDomain(input.websiteUrl);
  const basis = domain || input.businessName || `${input.category}-contractor`;
  if (!basis) {
    return null;
  }

  const sanitized = basis
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!sanitized) {
    return null;
  }

  return `${sanitized}@no-email.bidi`;
}

function pickQueriesForCategory(category: string, maxQueries: number) {
  const shuffled = [...searchQueries].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, maxQueries).map((sq) => sq.query.replace("{category}", category));
}

/**
 * Main crawler function
 */
async function crawlUtahSubcontractors(
  supabase: any,
  options: {
    categoriesToProcess?: string[];
    maxCategories?: number;
    maxResultsPerCategory?: number;
    maxQueriesPerCategory?: number;
  } = {},
) {
  console.log("\n🚀 Starting Utah subcontractor crawl...\n");
  
  const runStartedAt = Date.now();
  let totalProcessed = 0;
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const categoriesHandled: string[] = [];

  const {
    categoriesToProcess,
    maxCategories = DEFAULT_MAX_CATEGORIES_PER_RUN,
    maxResultsPerCategory = DEFAULT_MAX_RESULTS_PER_CATEGORY,
    maxQueriesPerCategory = DEFAULT_MAX_QUERIES_PER_CATEGORY,
  } = options;

  const categoryPool = categoriesToProcess && categoriesToProcess.length > 0 ? categoriesToProcess : categories;
  const effectiveCategories = categoryPool.slice(0, Math.min(maxCategories, categoryPool.length));

  const runDeadline = Date.now() + MAX_RUN_TIME_MS;

  for (const category of effectiveCategories) {
    console.log(`📋 Processing category: ${category}`);
    
    let processedForCategory = 0;
    const seenUrls = new Set<string>();

    const queries = pickQueriesForCategory(category, maxQueriesPerCategory);
    if (queries.length === 0) {
      console.log(`  ⚠️  No queries available for ${category}\n`);
      continue;
    }

    for (const query of queries) {
      if (processedForCategory >= maxResultsPerCategory) {
        break;
      }

      if (Date.now() >= runDeadline) {
        console.log("⏹️  Runtime budget reached, stopping current run early");
        break;
      }

      const remaining = maxResultsPerCategory - processedForCategory;
      const searchResults = await firecrawlSearch(query, remaining);

      if (!searchResults?.results || searchResults.results.length === 0) {
        console.log(`  ⚠️  No results found for query "${query}"`);
        continue;
      }

      for (const result of searchResults.results) {
        if (processedForCategory >= maxResultsPerCategory) {
          break;
        }

        if (Date.now() >= runDeadline) {
          console.log("⏹️  Runtime budget reached during URL processing");
          break;
        }

        const rawUrl = result.url;
        const normalizedUrl = normalizeUrl(rawUrl);
        if (!normalizedUrl) {
          console.log("  ⚠️  Skipping result with invalid URL");
          continue;
        }

        if (seenUrls.has(normalizedUrl)) {
          continue;
        }
        seenUrls.add(normalizedUrl);
        totalProcessed++;

        try {
          // Check if this URL already exists in the database
          const urlExists = await subcontractorExists(supabase, null, normalizedUrl);
          if (urlExists) {
            console.log(`  ⏩ Skipping duplicate URL: ${normalizedUrl}`);
            totalSkipped++;
            continue;
          }

          // Extract structured data from the webpage
          const extracted = await firecrawlExtract(normalizedUrl);
          const info = extracted?.data?.[0];

          if (!info || !info.business_name) {
            console.log(`  ⚠️  No valid data extracted from: ${normalizedUrl}`);
            continue;
          }

          // Normalize email - use deterministic placeholder if none found
          const extractedEmail = info.email?.toLowerCase()?.trim() || null;
          const email = extractedEmail || generatePlaceholderEmail({
            businessName: info.business_name,
            websiteUrl: normalizedUrl,
            category,
          });

          // Check for duplicates by email (only if it's not null)
          if (email) {
            const emailExists = await subcontractorExists(supabase, email, null);
            if (emailExists) {
              console.log(`  ⏩ Skipping duplicate email: ${email}`);
              totalSkipped++;
              continue;
            }
          }

          // Search for Google Reviews if not already found on website
          let googleData = null;
          if (!info.google_review_score && info.business_name) {
            const businessName = info.business_name || "Unknown";
            const location = info.city || "Utah";
            googleData = await searchGoogleReviews(businessName, location);

            // Add a delay after Google Reviews search
            await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
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
            website_url: normalizedUrl,
            google_review_score: googleReviewScore,
            google_reviews_link: googleReviewsLink,
            time_in_business: info.time_in_business || null,
            licensed: info.licensed ?? null,
            bonded: info.bonded ?? null,
            notes: info.notes || null,
            created_at: new Date().toISOString(),
          };

          // Insert the new subcontractor
          const { error: insertError } = await supabase.from("subcontractors").insert(subcontractorData);

          if (insertError) {
            console.error(`  ❌ Failed to add ${info.business_name}: ${insertError.message}`);
            totalErrors++;
          } else {
            console.log(`  ✅ Added: ${info.business_name} (${category})`);
            totalAdded++;
            processedForCategory++;
          }

          // Add a delay to be respectful to the APIs and avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, RESULT_DELAY_MS));
        } catch (error) {
          console.error(`  ❌ Error processing ${normalizedUrl}:`, error);
          totalErrors++;
          // Longer delay on errors to avoid compounding rate limit issues
          await new Promise((resolve) => setTimeout(resolve, ERROR_DELAY_MS));
        }
      }
    }

    console.log(`  ✓ Finished ${category} (${processedForCategory} processed)\n`);
    categoriesHandled.push(category);

    if (Date.now() >= runDeadline) {
      console.log("⏹️  Runtime budget reached after category processing");
      break;
    }

    if (category !== effectiveCategories[effectiveCategories.length - 1]) {
      await new Promise((resolve) => setTimeout(resolve, CATEGORY_DELAY_MS));
    }
  }

  // Print summary
  console.log("\n📊 Crawl Summary:");
  console.log(`  Total processed: ${totalProcessed}`);
  console.log(`  Added: ${totalAdded}`);
  console.log(`  Skipped (duplicates): ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log("\n✅ Crawl completed!\n");
  
  return {
    categoriesProcessed: categoriesHandled,
    runtimeMs: Date.now() - runStartedAt,
    maxRuntimeMs: MAX_RUN_TIME_MS,
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

    let payload: Record<string, unknown> = {};
     if (req.method !== "GET" && req.method !== "HEAD") {
       try {
        payload = await req.json();
       } catch (_err) {
         payload = {};
       }
     }

    const payloadCategories = payload["categories"];
    const categoriesOverride = Array.isArray(payloadCategories)
      ? payloadCategories.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase())
       : undefined;

    const payloadMaxCategories = payload["maxCategories"];
    const maxCategoriesOverride =
      typeof payloadMaxCategories === "number" && payloadMaxCategories > 0 ? Math.floor(payloadMaxCategories) : undefined;

    const payloadMaxResults = payload["maxResultsPerCategory"];
    const maxResultsOverride =
      typeof payloadMaxResults === "number" && payloadMaxResults > 0 ? Math.floor(payloadMaxResults) : undefined;

    const payloadMaxQueries = payload["maxQueriesPerCategory"];
    const maxQueriesOverride =
      typeof payloadMaxQueries === "number" && payloadMaxQueries > 0 ? Math.floor(payloadMaxQueries) : undefined;

    // Run the crawler
    const results = await crawlUtahSubcontractors(supabase, {
      categoriesToProcess: categoriesOverride,
      maxCategories: maxCategoriesOverride,
      maxResultsPerCategory: maxResultsOverride,
      maxQueriesPerCategory: maxQueriesOverride,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Crawl completed successfully",
        config: {
          categories: results?.categoriesProcessed ?? categoriesOverride ?? categories,
          maxCategories: maxCategoriesOverride ?? DEFAULT_MAX_CATEGORIES_PER_RUN,
          maxResultsPerCategory: maxResultsOverride ?? DEFAULT_MAX_RESULTS_PER_CATEGORY,
          maxQueriesPerCategory: maxQueriesOverride ?? DEFAULT_MAX_QUERIES_PER_CATEGORY,
        },
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

