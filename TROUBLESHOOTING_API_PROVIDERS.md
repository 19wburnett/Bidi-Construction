# Troubleshooting Multi-AI Provider Setup

## 🔴 Error: "Received 0 responses from AI providers"

This means all 3 AI API calls failed. Here's how to fix it:

## Step 1: Check Your .env File

Make sure you have a `.env` file in your project root with these keys:

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...your-actual-key...
OPENAI_MODEL=gpt-4o

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...your-actual-key...

# Google (Gemini)
GOOGLE_GEMINI_API_KEY=...your-actual-key...
```

### Get API Keys:

1. **OpenAI**: https://platform.openai.com/api-keys
2. **Anthropic (Claude)**: https://console.anthropic.com/settings/keys
3. **Google (Gemini)**: https://aistudio.google.com/app/apikey

## Step 2: Verify API Keys Are Valid

Test each API key individually:

### Test OpenAI:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY"
```

### Test Anthropic:
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20250514","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Test Gemini:
```bash
curl "https://generativelanguage.googleapis.com/v1/models?key=YOUR_GEMINI_API_KEY"
```

## Step 3: Check Terminal Logs

After running an analysis, check your terminal for detailed error messages. You should now see:

```
OpenAI analysis failed: Error message here
Claude analysis failed: Error message here  
Gemini analysis succeeded: 5234 chars
Successfully completed 1/3 provider analyses
```

## Common Issues:

### 1. Missing API Keys
**Error**: `TypeError: Cannot read properties of undefined`
**Fix**: Add the missing API key to your `.env` file

### 2. Invalid API Keys
**Error**: `401 Unauthorized` or `Authentication error`
**Fix**: Generate new API keys from the provider's dashboard

### 3. Insufficient Credits/Quota
**Error**: `429 Rate limit exceeded` or `Insufficient quota`
**Fix**: Add payment method or upgrade your plan with the provider

### 4. Model Not Available
**Error**: `Model not found` or `Model not supported`
**Fix**: Check if your account has access to the model (GPT-4o, Claude 3.5, Gemini 1.5)

### 5. Claude Model Deprecation
**Error**: `The model 'claude-3-5-sonnet-20241022' is deprecated`
**Fix**: Already fixed! Updated to `claude-3-5-sonnet-20250514`

## Step 4: Test with One Provider

If you want to test with just one provider while debugging, temporarily comment out the others:

In `lib/ai-providers.ts`, modify `analyzeWithAllProviders`:

```typescript
const results = await Promise.allSettled([
  analyzeWithOpenAI(images, options),  // Test OpenAI only
  // analyzeWithClaude(images, options),   // Commented out
  // analyzeWithGemini(images, options)    // Commented out
])
```

## Step 5: Check Environment Variable Loading

Verify Next.js is loading your `.env` file:

1. Restart your dev server: `npm run dev`
2. Add a test log in your API route:

```typescript
console.log('API Keys loaded:', {
  openai: !!process.env.OPENAI_API_KEY,
  anthropic: !!process.env.ANTHROPIC_API_KEY,
  gemini: !!process.env.GOOGLE_GEMINI_API_KEY
})
```

Should output:
```
API Keys loaded: { openai: true, anthropic: true, gemini: true }
```

## Step 6: Fallback to Single Provider

If you can't get all 3 providers working, you can use just OpenAI by modifying the route:

In `app/api/plan/analyze-multi-takeoff/route.ts`:

```typescript
// Instead of:
const responses = await analyzeWithAllProviders(images, options)

// Use just OpenAI:
const openaiResponse = await analyzeWithOpenAI(images, options)
const responses = [openaiResponse]
```

## Expected Successful Output

When everything works, you should see:

```
Starting multi-provider analysis...
OpenAI analysis succeeded: 5234 chars
Claude analysis succeeded: 4821 chars
Gemini analysis succeeded: 5102 chars
Successfully completed 3/3 provider analyses
openai: 45 items
claude: 52 items
gemini: 48 items
Merged to 65 unique items (removed 30 duplicates)
POST /api/plan/analyze-multi-takeoff 200 in 42301ms
```

## Still Having Issues?

1. Check the browser console for client-side errors
2. Check the terminal for server-side errors
3. Verify your `.env` file is in the project root (not in a subdirectory)
4. Make sure `.env` is not in `.gitignore` locally (it should be, but you need a copy)
5. Try deleting `node_modules` and running `npm install` again

## Quick Fix: Use Only OpenAI

If you just want to get it working now with a single provider:

1. Make sure you have `OPENAI_API_KEY` in your `.env`
2. Change `analyzeWithAllProviders` to only call OpenAI
3. The system will work with just one provider (no merging needed)

This will still give you improved analysis compared to your old single-call system because of the enhanced prompts!

