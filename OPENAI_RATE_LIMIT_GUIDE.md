# OpenAI Rate Limit Troubleshooting Guide

## Understanding the Error
The `429 You exceeded your current quota` error can occur even when you have credits available. This is because OpenAI has TWO types of limits:

1. **Spending Limits** (credits/billing) - You have this covered
2. **Rate Limits** (RPM/TPM) - This is likely what you're hitting

## Where to Check in OpenAI Dashboard

### 1. Check Rate Limits
1. Go to [OpenAI Platform Dashboard](https://platform.openai.com/)
2. Navigate to **Settings** → **Rate Limits** (or **Organization Settings** → **Limits**)
3. Look for these limits:
   - **RPM** (Requests Per Minute)
   - **TPM** (Tokens Per Minute)
   - **RPD** (Requests Per Day)

### 2. Check Usage Dashboard
1. Go to [Usage Dashboard](https://platform.openai.com/usage)
2. Check:
   - Current usage vs limits
   - Recent API calls
   - Which models are being used
   - Time-based usage patterns

### 3. Check Billing Settings
1. Go to **Settings** → **Billing**
2. Verify:
   - Payment method is valid
   - Spending limits aren't set too low
   - Account tier/plan limits

## Common Causes

### 1. Free Tier Limits
- If on free tier, you have very low rate limits (3 RPM, 40k TPM)
- Solution: Upgrade to paid tier

### 2. Model-Specific Limits
- `gpt-4o` and `gpt-4-turbo` have different rate limits
- Higher-tier models have lower limits
- Check limits per model in your dashboard

### 3. Concurrent Requests
- Our system uses multiple models in parallel
- This multiplies the requests/minute
- We're calling `gpt-4o` and `gpt-4-turbo` simultaneously

## Solutions

### Immediate Fix: Reduce Model Count
Currently, the system tries to use 5 models. You can reduce this:

1. Set environment variable:
   ```bash
   MAX_MODELS_PER_ANALYSIS=2
   ```

2. This will only use 2 models instead of 5, reducing rate limit pressure

### Long-term Fix: Request Limit Increase
1. Go to [OpenAI Help Center](https://help.openai.com/)
2. Submit a request to increase rate limits
3. Explain your use case (construction plan analysis with multiple models)

### Alternative: Stagger Model Calls
We could modify the code to call models sequentially instead of in parallel, which would reduce peak RPM.

## Quick Check Commands

Check your current rate limits via API (if you want to programmatically check):
```bash
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

## Next Steps

1. **Check your dashboard** for current rate limits
2. **Set `MAX_MODELS_PER_ANALYSIS=2`** to reduce concurrent requests
3. **Request limit increase** from OpenAI support if needed
4. **Consider using only Claude + Grok** temporarily if OpenAI limits are too restrictive

