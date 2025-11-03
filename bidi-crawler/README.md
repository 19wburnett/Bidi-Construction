# Bidi Subcontractor Crawler

Automated crawler service that finds new Utah subcontractors using Firecrawl's search and extract APIs and saves them to Supabase.

## Features

- 🔍 Smart search expansion with 15+ query patterns per category
- 🎯 Weighted randomization to find obscure/niche contractors
- 🏙️ City-specific searches (Salt Lake City, Provo, Ogden, Lehi, Orem)
- 🏢 Niche patterns (LLC, small, local, independent, specialist)
- 🌐 Extracts structured business data + Google Reviews
- 🚫 Automatically skips duplicates by email or website URL
- ⏰ Runs daily at 6:00 AM via cron schedule
- 📊 Comprehensive logging and error handling

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

   Required variables:
   - `FIRECRAWL_KEY` - Your Firecrawl API key
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_KEY` - Your Supabase service role key

3. **Test the setup:**
   ```bash
   npm test
   ```
   This runs quick validation tests to verify:
   - ✅ Environment variables are set
   - ✅ Firecrawl API connection works
   - ✅ Supabase connection works

4. **Run the crawler:**
   ```bash
   npm start
   ```

## Testing

Before running the full crawler, you can test your configuration:

```bash
npm test
```

The test script validates:
- Environment variables are properly configured
- Firecrawl API credentials work
- Supabase database connection works
- API endpoints respond correctly

## Database Schema

The crawler inserts into the `subcontractors` table with these fields:

- `name` - Business name
- `email` - Contact email
- `phone` - Phone number
- `trade_category` - Category (plumber, electrician, etc.)
- `location` - City or region
- `website_url` - Business website
- `created_at` - Timestamp

## How It Works

1. **Smart Search:** Randomly selects from 15+ weighted search patterns per category to find diverse contractors
2. **Google Reviews:** Searches and extracts Google review scores when not found on website
3. **Deduplication:** Checks if website URL or email already exists in Supabase
4. **Extraction:** Uses Firecrawl extract API to get structured business data
5. **Insertion:** Saves new subcontractors with comprehensive fields and error handling

### Search Strategy

The crawler uses **weighted randomization** to ensure diverse coverage:
- **Weight 1:** Common searches (e.g., "Utah plumber contractor") - run most often
- **Weight 2:** City-specific (e.g., "Provo electrician contractor") - moderate frequency
- **Weight 3:** Niche (e.g., "small roofer Utah") - less frequent
- **Weight 4:** Specialty (e.g., "hvac specialist Utah") - least frequent

This ensures you find both well-known contractors AND obscure local businesses.

## Scheduling

The crawler runs automatically every day at 6:00 AM using `node-cron`. The first crawl runs immediately on startup for testing purposes.

To modify the schedule, edit the cron expression in `src/index.js`:

```javascript
cron.schedule("0 6 * * *", async () => {
  // Runs daily at 6 AM
});
```

## File Structure

```
bidi-crawler/
├── src/
│   ├── index.js            # Entry point with cron scheduler
│   ├── crawler.js          # Main crawl logic
│   ├── firecrawlClient.js  # Firecrawl API wrapper
│   └── supabaseClient.js   # Database utilities
├── package.json
├── .env.example
└── README.md
```

## Logs

The crawler provides detailed console output:
- 🔎 Search progress per category
- ✅ Successfully added subcontractors
- ⏩ Skipped duplicates
- ❌ Errors encountered
- 📊 Final summary statistics
