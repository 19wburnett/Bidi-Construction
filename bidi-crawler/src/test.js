import "dotenv/config";
import { firecrawlSearch, firecrawlExtract } from "./firecrawlClient.js";
import { subcontractorExists } from "./supabaseClient.js";

/**
 * Test script to verify API connections and functionality
 */
async function runTests() {
  console.log("🧪 Running Bidi Crawler Tests...\n");

  // Test 1: Environment Variables
  console.log("1️⃣ Testing Environment Variables...");
  const checks = {
    FIRECRAWL_KEY: !!process.env.FIRECRAWL_KEY,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_KEY: !!process.env.SUPABASE_KEY,
  };

  const allSet = Object.values(checks).every(v => v);
  Object.entries(checks).forEach(([key, value]) => {
    console.log(`   ${value ? "✅" : "❌"} ${key}: ${value ? "Set" : "Missing"}`);
  });

  if (!allSet) {
    console.log("\n⚠️  Please set all environment variables in .env file");
    process.exit(1);
  }
  console.log("   ✅ All environment variables are set\n");

  // Test 2: Firecrawl Search
  console.log("2️⃣ Testing Firecrawl Search API...");
  try {
    const searchResults = await firecrawlSearch("Utah plumber", 5);
    if (searchResults?.results && searchResults.results.length > 0) {
      console.log(`   ✅ Search successful! Found ${searchResults.results.length} results`);
      console.log(`   📄 Sample result: ${searchResults.results[0].url || "No URL"}`);
    } else {
      console.log("   ⚠️  Search returned no results (may be API rate limit or issue)");
    }
  } catch (error) {
    console.log(`   ❌ Search failed: ${error.message}`);
  }
  console.log();

  // Test 3: Firecrawl Extract
  console.log("3️⃣ Testing Firecrawl Extract API...");
  try {
    // Use a sample URL from the search results
    const testUrl = "https://www.beehiveplumbing.com/";
    const extracted = await firecrawlExtract(testUrl);
    if (extracted?.data?.[0]) {
      console.log("   ✅ Extract successful!");
      const data = extracted.data[0];
      console.log(`   📊 Extracted fields: ${Object.keys(data).join(", ")}`);
    } else {
      console.log("   ⚠️  Extract returned no data (may be normal for this URL)");
    }
  } catch (error) {
    console.log(`   ❌ Extract failed: ${error.message}`);
  }
  console.log();

  // Test 4: Supabase Connection
  console.log("4️⃣ Testing Supabase Connection...");
  try {
    // Try to check if a non-existent subcontractor exists
    const exists = await subcontractorExists(null, "https://test-url-that-does-not-exist.com");
    console.log(`   ✅ Supabase connection successful! (Query executed without error)`);
  } catch (error) {
    console.log(`   ❌ Supabase connection failed: ${error.message}`);
    if (error.message.includes("Invalid API key")) {
      console.log("   💡 Tip: Make sure you're using the service role key, not the anon key");
    }
  }
  console.log();

  console.log("✅ All tests completed!\n");
  console.log("💡 If all tests passed, run 'npm start' to begin crawling\n");
}

runTests().catch(console.error);
