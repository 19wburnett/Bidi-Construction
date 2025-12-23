# Troubleshooting AI Gateway Setup

## 🔴 Error: "AI Gateway call failed" or "No LLM providers available"

This means the AI Gateway API call failed. Here's how to fix it:

## Step 1: Check Your .env File

Make sure you have a `.env.local` file in your project root with the AI Gateway API key:

```bash
# AI Gateway (Required)
AI_GATEWAY_API_KEY=your_ai_gateway_api_key

# Optional: Model configuration
OPENAI_MODEL=gpt-4o
```

### Get AI Gateway API Key:

1. Go to [Vercel AI Gateway Dashboard](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai&title=Go+to+AI+Gateway)
2. Select "API keys" in the left sidebar
3. Click "Create key" and follow the dialog
4. Copy the API key to your `.env.local` file

### Provider Configuration (Optional):

AI Gateway works in two modes:

1. **Automatic Mode (Default)**: Just add `AI_GATEWAY_API_KEY` - that's it! AI Gateway uses Vercel's provider keys automatically.

2. **BYOK Mode (Optional)**: If you want to use your own provider API keys for cost control:
   - Go to AI Gateway dashboard
   - Configure each provider with their respective API keys
   - Set up fallback chains if desired

**You don't need to configure providers** - AI Gateway will work automatically with just the `AI_GATEWAY_API_KEY`!

## Step 2: Verify AI Gateway API Key

Test the AI Gateway API key:

### Test AI Gateway:
```bash
# Test with a simple request
curl https://ai-gateway.vercel.sh/v1/chat/completions \
  -H "Authorization: Bearer YOUR_AI_GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4o","messages":[{"role":"user","content":"Hello"}],"max_tokens":10}'
```

Or use the test script:
```bash
node test-api-keys.js
```

## Step 3: Check Terminal Logs

After running an analysis, check your terminal for detailed error messages. You should now see:

```
🚀 Running 3 models in PARALLEL for takeoff: [ 'gpt-4o', 'claude-sonnet-4-20250514', 'grok-2-1212' ]
AI Gateway API Key: ✅ Configured
✅ gpt-4o succeeded: 5234 chars in 1234ms
✅ claude-sonnet-4-20250514 succeeded: 4821 chars in 1456ms
✅ grok-2-1212 succeeded: 5102 chars in 1678ms
```

## Common Issues:

### 1. Missing AI Gateway API Key
**Error**: `AI_GATEWAY_API_KEY is required` or `AI Gateway API key not configured`
**Fix**: Add `AI_GATEWAY_API_KEY` to your `.env.local` file. Get it from the [Vercel AI Gateway dashboard](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai&title=Go+to+AI+Gateway)

### 2. Invalid AI Gateway API Key
**Error**: `401 Unauthorized` or `Authentication error`
**Fix**: Generate a new API key from the AI Gateway dashboard

### 3. Providers Not Configured in AI Gateway
**Error**: `Model not found` or `Provider not configured`
**Fix**: 
- If using **Automatic Mode**: This shouldn't happen - AI Gateway provides keys automatically. Check that your `AI_GATEWAY_API_KEY` is valid.
- If using **BYOK Mode**: Configure the individual provider API keys (OpenAI, Anthropic, Google, XAI) in the AI Gateway dashboard.

### 4. Rate Limiting
**Error**: `429 Rate limit exceeded`
**Fix**: AI Gateway handles rate limiting automatically. Check your AI Gateway dashboard for rate limit settings and usage.

### 5. Model Not Available
**Error**: `Model not found` or `Model not supported`
**Fix**: Ensure the model is configured in your AI Gateway dashboard and that the provider API key is valid

## Step 4: Check Environment Variable Loading

Verify Next.js is loading your `.env.local` file:

1. Restart your dev server: `npm run dev`
2. Add a test log in your API route:

```typescript
console.log('AI Gateway API Key loaded:', !!process.env.AI_GATEWAY_API_KEY)
```

Should output:
```
AI Gateway API Key loaded: true
```

## Step 5: Verify AI Gateway Setup

1. Go to [AI Gateway Dashboard](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai&title=Go+to+AI+Gateway)
2. Check that your `AI_GATEWAY_API_KEY` is valid
3. **Optional (BYOK mode)**: If using your own provider keys, verify each provider has a valid API key set in the dashboard
4. Note: In automatic mode, you don't need to configure providers - AI Gateway handles it automatically

## Expected Successful Output

When everything works, you should see:

```
🚀 Running 3 models in PARALLEL for takeoff: [ 'gpt-4o', 'claude-sonnet-4-20250514', 'grok-2-1212' ]
AI Gateway API Key: ✅ Configured
✅ gpt-4o succeeded: 5234 chars in 1234ms
✅ claude-sonnet-4-20250514 succeeded: 4821 chars in 1456ms
✅ grok-2-1212 succeeded: 5102 chars in 1678ms

📊 Parallel analysis completed: 3/3 models succeeded in 1678ms
✅ All 3 model(s) completed - combining ALL findings (not just consensus)
Items before cleanup: 65
Items after cleanup: 65
POST /api/plan/analyze-enhanced 200 in 42301ms
```

## Still Having Issues?

1. Check the browser console for client-side errors
2. Check the terminal for server-side errors
3. Verify your `.env.local` file is in the project root (not in a subdirectory)
4. Make sure `.env.local` is in `.gitignore` (it should be)
5. Verify AI Gateway API key is set correctly
6. Check AI Gateway dashboard to ensure providers are configured
7. Try deleting `node_modules` and running `npm install` again

## Quick Test

Run the test script to verify your setup:

```bash
node test-api-keys.js
```

This will test AI Gateway connectivity and show which providers are configured.

