# Zoom Drawing Persistence Fix

## The Problem

User reported that drawings disappear when zooming in and out on the PDF.

## Root Cause

When zoom level changes, the PDF pages re-render at a new size. The canvas overlays need to:
1. Be resized to match the new PDF page dimensions
2. Redraw all existing drawings using the updated canvas dimensions

The issue was that:
- Canvas resizing had a single 200ms delay that might miss the PDF render
- `redrawCanvas` wasn't properly re-running when zoom changed
- The function wasn't using `useCallback`, so dependencies weren't tracked
- There was a typo: `geom.y2 * canvasWidth` instead of `canvasHeight`

## The Solution

### 1. **Multiple Resize Attempts**

Changed from single 200ms timeout to three staggered timeouts:

```typescript
// Update on mount and when zoom/pages change
// Use multiple timeouts to catch the canvas at different stages
const timer1 = setTimeout(updateCanvasSizes, 100)
const timer2 = setTimeout(updateCanvasSizes, 300)
const timer3 = setTimeout(updateCanvasSizes, 500)
```

This ensures we catch the canvas at the right moment even if PDF rendering is slow.

### 2. **Wrapped redrawCanvas in useCallback**

Moved `redrawCanvas` function to use `useCallback` with proper dependencies:

```typescript
const redrawCanvas = useCallback(() => {
  // ... drawing logic ...
}, [drawings, currentDrawing])
```

This ensures:
- Function is recreated when `drawings` or `currentDrawing` changes
- Can be safely used in useEffect dependencies
- React knows when to re-run effects that depend on it

### 3. **Added Redraw on Drawings Change**

Added a dedicated useEffect to redraw when drawings change:

```typescript
// Redraw whenever drawings change
useEffect(() => {
  if (drawings.length > 0) {
    console.log('Drawings changed, redrawing...', drawings.length)
    const timer = setTimeout(redrawCanvas, 50)
    return () => clearTimeout(timer)
  }
}, [drawings.length, redrawCanvas])
```

### 4. **Added Safety Check for Canvas Size**

Only resize canvas if dimensions are valid:

```typescript
const rect = pdfPageElement.getBoundingClientRect()
if (rect.width > 0 && rect.height > 0) {
  canvas.width = rect.width
  canvas.height = rect.height
}
```

### 5. **Fixed Y-Coordinate Bug**

Corrected typo in coordinate conversion:

```diff
- const y2 = geom.y2 ? geom.y2 * canvasWidth : y1
+ const y2 = geom.y2 ? geom.y2 * canvasHeight : y1
```

### 6. **Added Debug Logging**

Added console logs to help diagnose issues:

```typescript
console.log('Redrawing canvas. Number of drawings:', drawings.length)
console.log(`Canvas ${pageNum}: ${canvas.width}x${canvas.height}`)
console.log('Drawings changed, redrawing...', drawings.length)
```

## How It Works Now

1. **User Zooms In/Out**
   - `zoom` state changes
   - PDF pages start re-rendering at new scale

2. **Canvas Resize Loop**
   - Three timeouts fire at 100ms, 300ms, and 500ms
   - Each attempts to resize all canvases
   - Only resizes if parent has valid dimensions (>0)

3. **Automatic Redraw**
   - After canvas resize, `redrawCanvas()` is called
   - Iterates through all drawings
   - Converts relative coordinates (0-1) to absolute pixels based on current canvas size
   - Draws lines/rectangles at scaled positions

4. **Drawings Stay in Sync**
   - Because coordinates are stored as relative (0-1 range)
   - They automatically scale with canvas size
   - No need to update drawing data itself

## Debug Checklist

If drawings still disappear after zooming, check console for:

### Normal Behavior:
```
Redrawing canvas. Number of drawings: 2
Canvas 1: 612x792
Canvas 2: 612x792
```

### Problem: Canvas Size is 0
```
Canvas 1: 0x0  ❌ BAD
```
**Solution**: Wait longer for PDF to render, increase timeout delays

### Problem: No Drawings Found
```
Redrawing canvas. Number of drawings: 0  ❌ BAD
```
**Solution**: Check if drawings are loading from database correctly

### Problem: Redraw Not Triggering
If you don't see "Redrawing canvas" logs after zoom:
- Check that zoom state is actually changing
- Verify useEffect dependencies include `zoom`
- Try manually clicking a drawing tool to trigger redraw

## Testing

To verify the fix:

1. **Draw a line** on the PDF
2. **Zoom in** using + button or Ctrl+scroll
3. **Check**: Line should stay in same relative position
4. **Zoom out** 
5. **Check**: Line should still be visible and properly positioned
6. **Draw another line** at zoomed-in level
7. **Zoom back to 100%**
8. **Check**: Both lines should be visible

## Technical Details

### Why Relative Coordinates?

Drawings use coordinates in 0-1 range (percentage of canvas):
- `{ x1: 0.5, y1: 0.3, x2: 0.7, y2: 0.5 }`

When canvas resizes from 612x792 to 1224x1584 (2x zoom):
- Old absolute: (306, 237) → (428, 396)
- New absolute: (612, 475) → (857, 792)
- Same relative: (0.5, 0.3) → (0.7, 0.5) ✅

### Conversion Formula

**Relative → Absolute:**
```typescript
const absoluteX = relativeX * canvas.width
const absoluteY = relativeY * canvas.height
```

**Absolute → Relative:**
```typescript
const relativeX = absoluteX / canvas.width
const relativeY = absoluteY / canvas.height
```

## Files Modified

- `app/dashboard/plans/[id]/page.tsx`:
  - Wrapped `redrawCanvas` in `useCallback` with dependencies
  - Added multiple timeout attempts for canvas resizing
  - Added safety check for valid canvas dimensions
  - Added dedicated useEffect for drawing changes
  - Fixed y2 coordinate typo
  - Added debug logging
  - Removed duplicate `redrawCanvas` function

## Related Issues

- **Initial Drawing System**: [DRAWING_TOOLS_GUIDE.md](./DRAWING_TOOLS_GUIDE.md)
- **Canvas Not Sizing**: [DRAWING_TOOLS_DEBUG_FIX.md](./DRAWING_TOOLS_DEBUG_FIX.md)
- **Relative Coordinates**: [RELATIVE_COORDINATES_FIX.md](./RELATIVE_COORDINATES_FIX.md)

---

**Status**: ✅ Fixed  
**Last Updated**: October 12, 2025


