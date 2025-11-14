# Grok Integration Notes

## Overview

This document contains comprehensive notes on the Grok (xAI) integration for plan review analysis. Grok is integrated as a third provider alongside GPT and Claude for redundancy and alternative perspectives.

## Supported Models

| Model ID | Name | Context Window | JSON Mode | Vision | Streaming | Status |
|----------|------|----------------|-----------|--------|-----------|--------|
| `grok-2-1212` | Grok-2-1212 | 131,072 tokens (128k) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Active |
| `grok-2-vision-beta` | Grok-2 Vision Beta | 131,072 tokens (128k) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Active |
| `grok-beta` | Grok Beta | 131,072 tokens (128k) | ✅ Yes | ❌ No | ✅ Yes | ⚠️ Deprecated (2025-09-15) |

**Recommended Model**: `grok-2-1212` (current production model)

## API Configuration

### Environment Variables

- `XAI_API_KEY` or `GROK_API_KEY`: Required. Your xAI API key.
- `GROK_BASE_URL`: Optional. Defaults to `https://api.x.ai/v1`

### Base URL

- **Production**: `https://api.x.ai/v1`
- **Region**: Global (no region-specific endpoints)

### Authentication

- **Header**: `Authorization: Bearer <API_KEY>`
- **Organization ID**: Optional. Set via `X-Organization-Id` header if using org-scoped keys.

## Limits & Constraints

### Token Limits

- **Context Window**: 128,000 tokens (input + output)
- **Max Completion Tokens**: 4,096 tokens per request
- **Input Tokens**: Up to 128k tokens (context window - completion tokens)

### Rate Limits

- **Rate Limits**: Vary by tier (check xAI dashboard)
- **Common Limits**: 
  - 60 requests/minute (free tier)
  - Higher limits for paid tiers
- **429 Response**: Includes `Retry-After` header

### Request Limits

- **Max Images**: No explicit limit, but each image consumes tokens
- **Image Detail**: Supports `low`, `high`, `auto` (similar to OpenAI)
- **Request Size**: Limited by context window (128k tokens)

## JSON Mode & Structured Output

### JSON Mode Behavior

Grok does **not** have native `response_format: { type: 'json_object' }` like OpenAI. Instead:

1. **Prompt Engineering**: We inject JSON schema instructions into the system prompt
2. **Post-Processing**: JSON repair step handles any formatting quirks
3. **Consistency**: Grok generally follows JSON instructions well when explicitly requested

### Best Practices for JSON Prompts

```
System Prompt:
"You must respond with valid JSON only.

IMPORTANT: Respond with ONLY a valid JSON object matching this schema: {...}
Do not include markdown code blocks or any other text."
```

### Common JSON Quirks

1. **Trailing Commas**: Grok may include trailing commas in arrays/objects
2. **Markdown Wrapping**: Sometimes wraps JSON in ```json code blocks
3. **Incomplete Objects**: May truncate large JSON responses near token limit
4. **Escaped Quotes**: Generally handles escaping correctly

### JSON Repair Strategy

Our adapter includes JSON repair logic that:
- Removes markdown code blocks
- Fixes trailing commas
- Closes incomplete objects/arrays
- Handles truncated responses gracefully

## Function/Tool Calling

### Native Support

Grok does **not** have native function calling like OpenAI/Claude. We use a **shim approach**:

### Tool-Calling Shim

```typescript
// Tools are converted to JSON schema instructions
const toolsInstruction = `
You have access to these functions: ${JSON.stringify(tools)}
When you need to call a function, respond with:
{"function_name": "func_name", "arguments": {...}}
`
```

### Limitations

- **No Native Function Calling**: Requires prompt engineering
- **Manual Parsing**: Function calls must be extracted from JSON response
- **No Guaranteed Format**: Relies on model following instructions
- **Error-Prone**: May produce invalid function call formats

### Recommendation

For complex function calling scenarios, prefer GPT or Claude. Use Grok for:
- Simple JSON extraction
- Alternative analysis perspectives
- Fallback when other providers fail

## Image/Vision Support

### Supported Formats

- **Data URLs**: `data:image/jpeg;base64,...` or `data:image/png;base64,...`
- **Base64 Strings**: Raw base64 (automatically wrapped in data URL)
- **Detail Levels**: `low`, `high`, `auto` (similar to OpenAI)

### Image Processing

- **High Detail**: Full resolution analysis (recommended for plan drawings)
- **Token Cost**: Images consume significant tokens (estimate ~85 tokens per image for high detail)
- **Batch Processing**: Multiple images per request supported

### Best Practices for Plan Drawings

1. **Use High Detail**: Essential for reading dimensions and annotations
2. **Limit Batch Size**: Start with 1-5 images per request
3. **Combine with Text**: Send extracted text alongside images for better accuracy
4. **Page-by-Page**: Process complex plans page-by-page rather than all at once

## Prompt Optimization

### For Plan Text Analysis

```
System: "You are a construction plan analysis expert. Extract takeoff items with:
- Precise quantities and units
- Accurate category classification
- Location references
- Bounding box coordinates when visible"

User: "Analyze this plan page and extract all construction items..."
```

### For Drawing Analysis

```
System: "Analyze construction drawings and extract:
- Material quantities from dimensions
- Measurements from scale references
- Item counts from schedules
- Notes and annotations"

User: [Image + text prompt]
```

### Temperature Settings

- **Default**: `0.2` (recommended for structured extraction)
- **Range**: `0.0 - 2.0`
- **For Creative Tasks**: Increase to `0.7-1.0`
- **For Precision**: Keep at `0.1-0.3`

### Top-P Settings

- **Default**: Not set (uses temperature)
- **Range**: `0.0 - 1.0`
- **Use When**: You want more deterministic output (set `top_p: 0.9`)

## Pricing & Speed

### Pricing (Estimated, verify with xAI docs)

- **Input**: ~$0.10 per 1M tokens
- **Output**: ~$0.40 per 1M tokens
- **Note**: Pricing may vary by model and tier

### Cost Estimation

Our adapter calculates estimated cost:
```typescript
cost_est = (prompt_tokens / 1M) * 0.10 + (completion_tokens / 1M) * 0.40
```

### Speed Characteristics

- **Latency**: ~2-5 seconds for typical requests
- **Throughput**: Good for parallel requests
- **Timeout**: Recommended 120s for large prompts with images

### Comparison with Other Providers

| Provider | Speed | Cost | Quality |
|----------|-------|------|---------|
| Grok | Medium (2-5s) | Low-Medium | High |
| GPT-4o | Fast (1-3s) | Medium-High | Very High |
| Claude Sonnet | Medium (2-4s) | Medium | Very High |

## Error Handling & Failure Patterns

### Error Types

#### 1. Authentication Error (401/403)

**Symptoms**:
- `401 Unauthorized`
- `403 Forbidden`

**Causes**:
- Invalid API key
- Expired API key
- Missing API key

**Resolution**:
- Verify `XAI_API_KEY` is set correctly
- Check key hasn't expired
- Verify key has necessary permissions

#### 2. Model Not Found (404)

**Symptoms**:
- `404 Not Found`
- Error message mentions model name

**Causes**:
- Using deprecated model (`grok-beta`)
- Model ID typo
- Model not available in your region/tier

**Resolution**:
- Use `grok-2-1212` (current model)
- Verify model ID spelling
- Check xAI dashboard for available models

#### 3. Rate Limit (429)

**Symptoms**:
- `429 Too Many Requests`
- `Retry-After` header present

**Causes**:
- Exceeding requests per minute
- Exceeding tokens per minute
- Tier limits reached

**Resolution**:
- Wait for `Retry-After` seconds
- Implement exponential backoff
- Upgrade tier if persistent
- Use provider fallback (GPT/Claude)

#### 4. Context Overflow (400/413)

**Symptoms**:
- `400 Bad Request` with context/token error
- `413 Payload Too Large`

**Causes**:
- Prompt + images exceeds 128k tokens
- Completion tokens set too high (>4096)
- Too many images in single request

**Resolution**:
- Reduce prompt size
- Use fewer images per request
- Set `max_tokens` to 4096 or less
- Split into multiple requests

#### 5. Unknown Errors (500/502/503)

**Symptoms**:
- Server errors (5xx)
- Timeout errors

**Causes**:
- xAI service issues
- Network problems
- Request timeout

**Resolution**:
- Retry with exponential backoff
- Check xAI status page
- Fallback to other providers
- Verify network connectivity

### Error Normalization

Our adapter normalizes all errors into:

```typescript
{
  type: 'rate_limit' | 'auth_error' | 'model_not_found' | 'context_overflow' | 'unknown',
  message: string, // Actionable error message
  statusCode?: number,
  retry_after?: number // For rate limits
}
```

### Common Failure Patterns

1. **Empty Responses**: 
   - **Cause**: Token limit reached before completion
   - **Fix**: Increase `max_tokens` or reduce prompt size

2. **Invalid JSON**:
   - **Cause**: Model didn't follow JSON instructions
   - **Fix**: Strengthen JSON instructions in system prompt

3. **Truncated Responses**:
   - **Cause**: Response exceeded `max_completion_tokens`
   - **Fix**: Increase limit (up to 4096) or split request

4. **Timeout Errors**:
   - **Cause**: Large prompts with images take too long
   - **Fix**: Increase timeout (120s recommended) or reduce images

5. **Inconsistent Formatting**:
   - **Cause**: Model interpretation of JSON schema
   - **Fix**: Use JSON repair step in adapter

## Integration with Orchestration

### Adapter Interface

The Grok adapter implements a standardized interface:

```typescript
// Initialize
initGrok({ apiKey, baseUrl?, orgId? })

// Healthcheck
await grokHealthcheck() // Returns { ok, models, error? }

// Call
await callGrok({
  system?: string,
  user: string | Array<{ type, text?, image_url? }>,
  tools?: Array<...>,
  json_schema?: Record<string, any>,
  max_tokens?: number,
  temperature?: number,
  top_p?: number
})
```

### Integration Points

1. **Enhanced AI Provider** (`lib/enhanced-ai-providers.ts`):
   - Replaces `analyzeWithXAI` method
   - Uses adapter for all Grok calls
   - Handles normalized errors

2. **Model Orchestrator** (`lib/model-orchestrator.ts`):
   - Grok included in model list
   - Treated as equal provider alongside GPT/Claude
   - Participates in consensus analysis

3. **Fallback Chain**:
   - Primary: GPT-4o
   - Secondary: Claude Sonnet
   - Tertiary: Grok-2-1212

### Zero-Code-Change Integration

The adapter is designed to work with existing orchestration without changes:
- Same interface as other providers
- Normalized responses
- Compatible error handling
- Standard usage tracking

## Testing

### Acceptance Tests

#### AT1: Healthcheck
- ✅ Returns `ok: true` when API key valid
- ✅ Enumerates expected Grok models
- ✅ Returns `ok: false` with error when API key invalid

#### AT2: JSON Echo
- ✅ Minimal JSON prompt returns valid JSON
- ✅ 3 consecutive runs produce consistent format
- ✅ JSON repair handles any quirks

#### AT3: Plan Page Analysis
- ✅ Real plan page produces ≥90% field coverage vs GPT baseline
- ✅ Items extracted match expected structure
- ✅ Quantities and units are accurate

#### AT4: Error Normalization
- ✅ 401 errors → `auth_error` with actionable message
- ✅ 404 errors → `model_not_found` with model suggestions
- ✅ 429 errors → `rate_limit` with retry_after

#### AT5: Orchestrator Integration
- ✅ Adapter swaps under orchestrator with zero code changes
- ✅ Grok appears in model list
- ✅ Results included in consensus analysis

### Running Tests

```bash
# Integration test
npx tsx lib/providers/test-grok-integration.ts

# Manual healthcheck
# Use the adapter's healthcheck() method
```

## Best Practices Summary

### DO

✅ Use `grok-2-1212` for production  
✅ Set `max_tokens` to 4096 or less  
✅ Use high detail for plan images  
✅ Include JSON schema in prompts  
✅ Implement retry logic for rate limits  
✅ Use JSON repair for responses  
✅ Monitor token usage and costs  

### DON'T

❌ Use deprecated `grok-beta` model  
❌ Exceed 4096 completion tokens  
❌ Send too many images in one request  
❌ Rely on native function calling  
❌ Ignore rate limit headers  
❌ Skip JSON validation  
❌ Use without error handling  

## Troubleshooting

### Issue: "Model not found"

**Solution**: Use `grok-2-1212` instead of `grok-beta`

### Issue: "Context window exceeded"

**Solution**: Reduce prompt size or split into multiple requests

### Issue: "Rate limit exceeded"

**Solution**: Implement exponential backoff, check `Retry-After` header

### Issue: "Invalid JSON response"

**Solution**: Strengthen JSON instructions, use JSON repair step

### Issue: "Empty response"

**Solution**: Increase `max_tokens` or reduce prompt/images

## References

- **xAI API Docs**: https://x.ai/api
- **Grok Models**: https://x.ai/models
- **Pricing**: https://x.ai/pricing
- **Status Page**: Check xAI status for service issues

## Changelog

- **2025-01-XX**: Initial Grok adapter implementation
- **2025-01-XX**: Integrated into enhanced-ai-providers.ts
- **2025-01-XX**: Added JSON mode support via prompt engineering
- **2025-01-XX**: Added tool-calling shim
- **2025-01-XX**: Added comprehensive error normalization




