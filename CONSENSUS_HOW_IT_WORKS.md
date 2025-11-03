# How Multi-Model Consensus Works - Simple Explanation

## The Answer to Your Question:

**Both analyses are combined, not just one!** Here's how:

## Your Test Results:

**4 models succeeded:**
- `gpt-4o`: 5 items
- `claude-sonnet-4-20250514`: 22 items  
- `o4-mini`: 6 items
- `gpt-4.1-nano`: 6 items

**Total items found:** ~39 items

**Final result:** 29 items saved

## How They're Combined:

### Step 1: Similarity Matching
The system groups items that look the same:

```
Example:
- gpt-4o finds: "2x6 Exterior Wall Framing", 600 LF
- o4-mini finds: "2x6 Exterior Wall Framing", 650 LF
→ Grouped together! (names match >70%)
```

### Step 2: Merging
Similar items are merged:
- **Quantity**: Average of both (625 LF)
- **Confidence**: Average of both (0.925)
- **Provider**: Set to "consensus" 
- **Consensus count**: 2 (both models found it)

### Step 3: Filtering
Items need ≥30% consensus:

With 4 models:
- ✅ Keeps: Found by ≥2 models
- ✅ Also keeps: Found by 1 model (only if confidence >15%)

**Result:**
- Items found by 2+ models → **merged with higher confidence**
- Items found by 1 model → **kept as unique finding**

## Why 29 Items vs ~39 Total?

Some items were dropped because:
1. Confidence <15% (weak confidence)
2. Or they were exact duplicates merged into groups

## Your Final 29 Items:

Looking at your data:
- 2 items with `consensus_count: 2` (2+ models agreed)
- 27 items with `consensus_count: 1` (unique findings kept)

**Example of consensus item:**
```json
{
  "name": "2x6 Exterior Wall Framing",
  "quantity": 600,
  "consensus_count": 2,  ← 2 models found this
  "notes": "Consensus from unknown, unknown",
  "confidence": 0.915
}
```

**Example of unique item:**
```json
{
  "name": "Foundation Concrete",
  "quantity": 15,
  "consensus_count": 1,  ← Only 1 model found this
  "confidence": 0.9
}
```

## Bottom Line:

**ALL successful models contribute to the final result!**
- Not just the "best" one
- All findings are combined
- Duplicates are merged
- Unique findings are kept
- Consensus items get higher confidence scores

This is why the overall confidence is **86.67%** - it's the average of all 4 models.

