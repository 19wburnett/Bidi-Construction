# Vercel Crawler Setup Guide

## Problem
Puppeteer cannot find Chrome on Vercel serverless functions because browsers are not available in the serverless environment.

## Solution: Use a Headless Browser Service

### Option 1: Browserless.io (Recommended)

1. **Sign up for Browserless.io**
   - Go to https://www.browserless.io/
   - Create an account (free tier available)
   - Get your API key from the dashboard

2. **Add to Vercel Environment Variables**
   - Go to your Vercel project settings
   - Navigate to Environment Variables
   - Add:
     ```
     BROWSERLESS_API_KEY=your_api_key_here
     ```
   - Optionally, set a custom endpoint (defaults to `production-sfo.browserless.io`):
     ```
     BROWSERLESS_ENDPOINT=production-sfo.browserless.io
     ```
   - Redeploy your application

**Alternative:** If you prefer to use a full WebSocket URL instead:
```
BROWSERLESS_URL=wss://production-sfo.browserless.io?token=YOUR_TOKEN
```

### Option 2: Self-Hosted Browserless

If you have your own server, you can self-host Browserless:

```bash
docker run -p 3000:3000 browserless/chrome
```

Then set:
```
BROWSERLESS_URL=ws://your-server:3000
```

### Option 3: Alternative Services

- **ScrapingBee**: https://www.scrapingbee.com/
- **ScraperAPI**: https://www.scraperapi.com/
- **Apify**: https://apify.com/

### Option 4: Move to AWS Lambda

If you prefer to keep using `@sparticuz/chromium`, move the crawler to AWS Lambda where it works natively.

## Testing

After setting up the browser service, test the crawler:

```bash
# Test locally (if you have BROWSERLESS_URL set)
curl http://localhost:3000/api/cron/find-subcontractors
```

## Current Status

The crawler will now:
- ✅ Use Browserless service if `BROWSERLESS_API_KEY` or `BROWSERLESS_URL` is set (works on Vercel)
- ✅ Use `@sparticuz/chromium` on AWS Lambda
- ✅ Use regular Puppeteer in development (if Chrome is installed)
- ❌ Fail gracefully with helpful error messages if no browser is available

## Cost Considerations

- **Browserless.io**: Free tier includes 6 hours/month, then $0.10/hour
- **AWS Lambda**: Pay per execution, very cost-effective for cron jobs
- **Self-hosted**: Server costs only

## Next Steps

1. Set up Browserless.io (or alternative)
2. Add `BROWSERLESS_API_KEY` to Vercel environment variables (or use `BROWSERLESS_URL`)
3. Redeploy your application
4. Test the cron job

The crawler should now work on Vercel! 🎉
