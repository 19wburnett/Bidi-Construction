# AI Gateway Setup Instructions

## Quick Start

1. **Get your AI Gateway API key**:
   - Go to [Vercel AI Gateway Dashboard](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai&title=Go+to+AI+Gateway)
   - Click "API keys" in the left sidebar
   - Click "Create key"
   - Copy the API key

2. **Add to `.env.local`**:
   ```bash
   AI_GATEWAY_API_KEY=your_ai_gateway_api_key_here
   ```

3. **Optional: Configure providers (BYOK mode)**:
   - If you want to use your own provider API keys for cost control, go to AI Gateway dashboard
   - Add your OpenAI API key (optional - for BYOK)
   - Add your Anthropic API key (optional - for BYOK)
   - Add your Google Gemini API key (optional - for BYOK)
   - Add your XAI API key (optional - for BYOK)
   - **Note**: If you don't configure provider keys, AI Gateway will use Vercel's automatic provider keys (subject to AI Gateway credits)

4. **Test the setup**:
   ```bash
   node test-api-keys.js
   ```

## Important Notes

- **Individual provider API keys** (OpenAI, Anthropic, etc.) are configured in the AI Gateway dashboard, NOT in your `.env.local` file
- You only need `AI_GATEWAY_API_KEY` in your environment variables
- The AI Gateway handles all provider routing, fallbacks, and rate limiting automatically

## Verification

After adding the API key, run:
```bash
node test-api-keys.js
```

You should see:
```
✅ AI_GATEWAY_API_KEY (Required)
🧪 Testing AI Gateway...
  ✅ AI Gateway working: [response text]
```

## Troubleshooting

If you see `❌ AI_GATEWAY_API_KEY (Required)`, make sure:
1. The key is in `.env.local` (not `.env`)
2. You've restarted your dev server after adding it
3. The key is correct (copy-paste from Vercel dashboard)

For more help, see `TROUBLESHOOTING_API_PROVIDERS.md`



