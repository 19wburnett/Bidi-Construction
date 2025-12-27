# Interactive Takeoff Chat Feature

## Overview

The Plan Chat now supports interactive takeoff editing, allowing users to chat with the AI about their takeoff, add/remove items, and get guidance on missing measurements.

## Features

### 1. **Takeoff Modification**
- **Add items**: "Add concrete footings", "Include HVAC ductwork"
- **Remove items**: "Remove that door", "Delete the extra window"
- **Update items**: "Update the roof quantity to 2500 SF"

### 2. **Takeoff Analysis**
- **Missing scope**: "What scope is missing?", "What should be in the takeoff?"
- **Missing measurements**: "What measurements do I need?", "How do I calculate the quantity?"

### 3. **Measurement Guidance**
When the AI doesn't have measurements needed for a takeoff item, it will:
- Explain what measurements are needed (length, width, height, area, etc.)
- Tell the user where to find them (which pages, what to look for)
- Provide guidance on how to calculate quantities from measurements

## How It Works

### Classification
The system detects takeoff modification requests through enhanced classification:
- `TAKEOFF_MODIFY`: User wants to add/remove/update items
- `TAKEOFF_ANALYZE`: User wants to analyze what's missing

### Modification Flow
1. User asks: "Add concrete footings to the takeoff"
2. System classifies as `TAKEOFF_MODIFY` with intent `add`
3. AI analyzes blueprint content and current takeoff
4. AI suggests items to add with details
5. System applies modifications automatically (or prompts for confirmation)
6. User sees updated takeoff

### Analysis Flow
1. User asks: "What scope is missing?"
2. System classifies as `TAKEOFF_ANALYZE`
3. AI compares blueprint content with current takeoff items
4. AI identifies:
   - Missing categories mentioned in plans
   - Items missing quantity measurements
   - What measurements are needed
5. AI provides recommendations

## API Endpoints

### POST `/api/plan-chat/takeoff-modify`
Apply modifications to takeoff items.

**Request:**
```json
{
  "planId": "uuid",
  "modifications": [
    {
      "action": "add",
      "item": {
        "category": "Concrete",
        "description": "Concrete footing 24x24x12",
        "quantity": 10,
        "unit": "each",
        "location": "Foundation",
        "page_number": 3
      },
      "reason": "User requested to add this item"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "modifications": [...],
  "updatedItems": [...],
  "message": "Successfully applied 1 modification(s)",
  "warnings": []
}
```

## Example Conversations

### Adding Items
**User**: "Add the concrete footings mentioned on page 3"
**AI**: "I found concrete footing specifications on page 3. Adding: Concrete footing 24"x24"x12" deep - 10 each @ Foundation. ✅ Successfully added to takeoff."

### Analyzing Missing Scope
**User**: "What scope is missing from this takeoff?"
**AI**: "Comparing the plans with your current takeoff, I found:
- **Missing**: HVAC ductwork (mentioned on pages 5-7)
- **Missing**: Electrical panel (specified on page 8)
- **Needs measurements**: Roof area (currently listed but no quantity)

To calculate the roof area, measure the roof dimensions from the roof plan (page 4) and multiply length × width."

### Measurement Guidance
**User**: "I need to add drywall but don't know the quantity"
**AI**: "To calculate drywall quantity, I need:
1. **Wall dimensions**: Length and height of each wall (found on floor plans)
2. **Room areas**: Square footage of each room (can calculate from dimensions)
3. **Ceiling area**: If including ceiling drywall

Look for:
- Wall dimensions on the floor plans (pages 2-3)
- Room labels with dimensions
- Section details showing wall heights

Once you have these, I can help calculate the total square footage needed."

## Technical Implementation

### Files Created/Modified

1. **`lib/plan-chat-v3/takeoff-modifier.ts`**
   - `loadTakeoffItems()`: Loads current takeoff
   - `applyTakeoffModifications()`: Applies modifications
   - `analyzeMissingScope()`: Analyzes what's missing

2. **`lib/plan-chat-v3/modification-parser.ts`**
   - `parseModificationRequest()`: Parses AI responses for modifications
   - `formatModificationInstructions()`: Formats instructions for AI

3. **`app/api/plan-chat/takeoff-modify/route.ts`**
   - API endpoint for applying modifications

4. **`lib/planChat/classifier.ts`**
   - Added `TAKEOFF_MODIFY` and `TAKEOFF_ANALYZE` question types
   - Added `modification_intent` field

5. **`lib/plan-chat-v3/prompts.ts`**
   - Added `TAKEOFF_MODIFY_MODE_SYSTEM_PROMPT` for modification mode

6. **`lib/plan-chat-v3/answer-engine.ts`**
   - Enhanced to handle modification requests
   - Automatically applies modifications when user intent is clear

## Usage Tips

1. **Be specific**: "Add concrete footings" is better than "add stuff"
2. **Reference pages**: "Add the windows from page 5" helps AI find the right items
3. **Ask for analysis**: "What's missing?" or "What measurements do I need?"
4. **Review changes**: The AI will confirm what it added/removed

## Future Enhancements

- Confirmation dialog before applying modifications
- Undo/redo functionality
- Batch modifications
- Measurement calculator integration
- Visual highlighting of modified items

