# Reasoning Model Token Limit Fix

## Problem
OpenAI's reasoning models (`gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `o3`, `o4-mini`) were returning **empty responses** even though they were using all 4096 tokens.

## Root Cause
These models use **reasoning tokens** that count against `max_completion_tokens`. The models were spending all 4096 tokens on internal reasoning, leaving **0 tokens for actual output**.

From the logs:
- `gpt-5-mini`: 14545 prompt tokens, 4096 completion tokens (all reasoning), 0 output tokens → empty response
- `gpt-5-nano`: 16730 prompt tokens, 4096 completion tokens (all reasoning), 0 output tokens → empty response

## Solution
1. **Increased token limits for reasoning models**: 16k-32k tokens (instead of 4k)
   - Reasoning models need much higher limits because reasoning consumes tokens before output
   - Cap at 32k to avoid excessive costs, but allow models to actually produce content

2. **Better error handling**: Throw error for empty responses instead of creating fake data
   - Previously: Empty responses were treated as "success" and created fallback structures with 0 items
   - Now: Empty responses throw errors, forcing fallback to other models

3. **Enhanced logging**: Show reasoning vs output token breakdown
   - Log: `Token usage: X completion tokens (Y reasoning + Z output)`
   - This helps diagnose when models exhaust their token budget

## Changes Made
- `lib/enhanced-ai-providers.ts`:
  - Detect reasoning models and increase their `max_completion_tokens` to 16k-32k
  - Throw error for empty responses instead of returning fake data
  - Enhanced logging for token usage

## Expected Results
- Reasoning models should now produce actual output (not empty responses)
- Better fallback to Claude/Grok when reasoning models fail
- More accurate error messages when models genuinely fail

