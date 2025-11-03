import { firecrawlSearch, firecrawlExtract, searchGoogleReviews } from "./firecrawlClient.js";
import { subcontractorExists, insertSubcontractor } from "./supabaseClient.js";

const categories = [
  "plumber",
  "electrician", 
  "roofer",
  "hvac",
  "drywall"
];

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
 * Main crawler function that searches and extracts subcontractor data
 */
export async function crawlUtahSubcontractors() {
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
        const urlExists = await subcontractorExists(null, url);
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
        
        // Check for duplicates by email (only if it's not a placeholder) or website
        if (email && !email.includes('placeholder')) {
          const emailExists = await subcontractorExists(email, null);
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
        // Merge Google Reviews data if found
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
        const insertResult = await insertSubcontractor(subcontractorData);
        
        if (insertResult.success) {
          console.log(`  ✅ Added: ${info.business_name} (${category})`);
          totalAdded++;
        } else {
          console.error(`  ❌ Failed to add ${info.business_name}: ${insertResult.error}`);
          totalErrors++;
        }

        // Add delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds between extractions

      } catch (error) {
        console.error(`  ❌ Error processing ${url}:`, error.message);
        totalErrors++;
        // Longer delay on errors to avoid compounding rate limit issues
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`  ✓ Finished ${category}\n`);
    
    // Add longer delay between categories
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Print summary
  console.log("\n📊 Crawl Summary:");
  console.log(`  Total processed: ${totalProcessed}`);
  console.log(`  Added: ${totalAdded}`);
  console.log(`  Skipped (duplicates): ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log("\n✅ Crawl completed!\n");
}
