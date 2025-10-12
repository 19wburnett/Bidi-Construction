# Relative Coordinates System - Drawing Zoom Fix

## Problem

Drawings were not staying in the correct position when zooming in/out on PDFs. The issue was that drawings were being stored in **absolute pixel coordinates** which didn't scale with the PDF zoom level.

### What was happening:
1. User draws a line at 50% zoom → stored as (100, 200) to (300, 400) pixels
2. User zooms to 100% → PDF doubles in size
3. Drawing stays at the same pixel coordinates → appears in wrong location
4. ❌ Drawings appear to "float" and don't stick to the PDF

## Solution

Implemented a **relative coordinate system** where all drawings are stored as values between 0 and 1 (representing percentage of canvas size).

### How it works now:
1. User draws a line at 50% zoom → converted to relative coordinates (0.25, 0.4) to (0.75, 0.8)
2. User zooms to 100% → PDF doubles in size
3. Relative coordinates are converted back: (0.25 × 800, 0.4 × 1000) = (200, 400)
4. ✅ Drawing scales perfectly with the PDF

## Implementation

### 1. Updated Drawing Interface

```typescript
interface Drawing {
  id: string
  type: 'line' | 'rectangle' | 'circle' | 'measurement'
  geometry: {
    x1: number  // Stored as relative coordinates (0-1)
    y1: number  // Stored as relative coordinates (0-1)
    x2?: number // Stored as relative coordinates (0-1)
    y2?: number // Stored as relative coordinates (0-1)
  }
  // ... other properties
  canvas_width?: number  // Reference canvas size
  canvas_height?: number // Reference canvas size
  page_number?: number
}
```

### 2. Coordinate Conversion on Draw

**When user starts drawing (mouseDown):**
```typescript
// Get absolute pixel coordinates
const absoluteX = e.clientX - rect.left
const absoluteY = e.clientY - rect.top

// Convert to relative (0-1 range)
const relativeX = absoluteX / canvas.width
const relativeY = absoluteY / canvas.height
```

**When user moves mouse (mouseMove):**
```typescript
// Same conversion for x2, y2
const relativeX = absoluteX / canvas.width
const relativeY = absoluteY / canvas.height
```

### 3. Coordinate Conversion on Render

**When redrawing on canvas:**
```typescript
// Convert relative coordinates back to absolute for current zoom
const x1 = geometry.x1 * canvasWidth  // 0.25 * 800 = 200
const y1 = geometry.y1 * canvasHeight // 0.4 * 1000 = 400
const x2 = geometry.x2 * canvasWidth
const y2 = geometry.y2 * canvasHeight

// Draw with absolute coordinates
ctx.moveTo(x1, y1)
ctx.lineTo(x2, y2)
```

### 4. Backward Compatibility

**Loading old drawings (absolute coordinates):**
```typescript
// Detect old format (coordinates > 1)
if (geometry.x1 > 1 || geometry.y1 > 1) {
  // Convert from absolute to relative
  geometry = {
    x1: geometry.x1 / canvasWidth,
    y1: geometry.y1 / canvasHeight,
    x2: geometry.x2 / canvasWidth,
    y2: geometry.y2 / canvasHeight
  }
}
```

### 5. Database Storage

**Saving to Supabase:**
```typescript
const geometryWithMeta = {
  ...drawing.geometry,  // Relative coordinates
  canvas_width: drawing.canvas_width,   // Reference size
  canvas_height: drawing.canvas_height  // Reference size
}

await supabase.from('plan_drawings').insert({
  geometry: geometryWithMeta, // JSONB column
  // ... other fields
})
```

## Benefits

✅ **Zoom Independent** - Drawings stay in correct position at any zoom level
✅ **Resolution Independent** - Works across different screen sizes
✅ **Backward Compatible** - Automatically converts old absolute coordinates
✅ **Database Efficient** - No migration needed (JSONB is flexible)
✅ **Future Proof** - Scales to any canvas size

## Technical Details

### Coordinate Range
- **Relative**: 0.0 to 1.0 (0% to 100% of canvas)
- **Absolute**: 0 to canvasWidth/Height (actual pixels)

### Minimum Size Threshold
- Changed from **5 pixels** to **0.005 relative units** (0.5% of canvas)
- Scales proportionally with zoom level

### Precision
- Floating point coordinates (0.123456)
- Adequate precision for construction plans
- No perceptible rounding errors

## Example

**User draws a line from top-left quarter to bottom-right three-quarters:**

```
At 50% zoom (400×500 canvas):
- User clicks at pixel (100, 125)
- Stored as relative (0.25, 0.25)
- User drags to pixel (300, 375)
- Stored as relative (0.75, 0.75)

At 100% zoom (800×1000 canvas):
- Relative (0.25, 0.25) → Pixel (200, 250)
- Relative (0.75, 0.75) → Pixel (600, 750)
- Drawing appears in same visual position! ✅

At 200% zoom (1600×2000 canvas):
- Relative (0.25, 0.25) → Pixel (400, 500)
- Relative (0.75, 0.75) → Pixel (1200, 1500)
- Still in the correct position! ✅
```

## Migration Path

1. **No database migration needed** - JSONB handles both formats
2. **Automatic conversion** - Old drawings detected and converted on load
3. **New drawings** - Stored in relative format from day one
4. **Mixed usage** - Can have both old and new drawings in same plan

## Testing

To verify the fix works:

1. Draw a line on a PDF at 50% zoom
2. Zoom in to 100%
3. Line should stay in the exact same position on the PDF
4. Zoom out to 25%
5. Line should still be in the correct position
6. Refresh the page
7. All drawings should persist with correct positions

**Before fix:** Drawings would "float" or jump to different locations ❌
**After fix:** Drawings stick perfectly to the PDF at any zoom level ✅

