# AI Gateway Quick Start

## It Just Works! 🎉

AI Gateway works automatically - you **don't need to configure individual providers**!

## Setup (2 steps)

1. **Get your AI Gateway API key**:
   - Go to [Vercel AI Gateway Dashboard](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai&title=Go+to+AI+Gateway)
   - Click "API keys" → "Create key"
   - Copy the key

2. **Add to `.env.local`**:
   ```bash
   AI_GATEWAY_API_KEY=your_key_here
   ```

That's it! 🎉

## How It Works

AI Gateway has two modes:

### Automatic Mode (Default) ✅
- **Just works** with `AI_GATEWAY_API_KEY`
- AI Gateway uses Vercel's provider keys automatically
- No provider configuration needed
- Usage is billed to your AI Gateway credits

### BYOK Mode (Optional)
- Configure your own provider API keys in the dashboard
- Use your existing provider credits
- More cost control
- Still optional - automatic mode works fine!

## Test It

```bash
node test-api-keys.js
```

Or try the example:
```bash
tsx index.ts
```

## That's It!

You can now use any model:
- `openai/gpt-4o`
- `anthropic/claude-sonnet-4-20250514`
- `google/gemini-2.5-flash`
- `xai/grok-2-1212`

All through the same `AI_GATEWAY_API_KEY` - no individual provider configuration needed!




