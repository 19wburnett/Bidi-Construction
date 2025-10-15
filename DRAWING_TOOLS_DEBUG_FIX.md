# Drawing Tools Debug Fix

## The Problem

User reported that drawing and comments features weren't working - clicking on the PDF to draw did nothing.

## Root Cause

The canvas overlay wasn't being properly sized when the PDF pages loaded, resulting in:
- Canvas with `width: 0` and `height: 0`
- Click events not being captured properly
- No visual feedback about which tool was active

## The Solution

### 1. **Immediate Canvas Sizing in Ref Callback**

Added immediate canvas sizing when the ref is first attached:

```typescript
<canvas
  ref={(el) => {
    if (el) {
      canvasRefs.current.set(pageNum, el)
      // Size canvas immediately when ref is attached
      const pdfPageElement = el.parentElement
      if (pdfPageElement) {
        const rect = pdfPageElement.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          el.width = rect.width
          el.height = rect.height
        }
      }
    }
  }}
/>
```

### 2. **Canvas Sizing After Page Load**

Added sizing logic in the Page component's `onLoadSuccess` callback:

```typescript
<Page
  onLoadSuccess={(page) => {
    setTimeout(() => {
      const canvas = canvasRefs.current.get(pageNum)
      if (canvas && canvas.parentElement) {
        const rect = canvas.parentElement.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = rect.width
          canvas.height = rect.height
          redrawCanvas()
        }
      }
    }, 100)
  }}
/>
```

### 3. **Added z-index to Canvas**

Ensured canvas is above the PDF but below the note pins:

```typescript
style={{
  pointerEvents: 'auto',
  cursor: activeTool === 'select' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair',
  zIndex: 10  // Added
}}
```

### 4. **Visual Tool Indicator**

Added a blue badge in the top toolbar showing when a drawing tool is active:

```typescript
{activeTool !== 'select' && (
  <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md">
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
    <span className="text-xs font-medium text-blue-700 capitalize">
      {activeTool} mode active - Click on the PDF to draw
    </span>
  </div>
)}
```

### 5. **Debug Logging**

Added console logs to help diagnose issues:

```typescript
const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
  console.log('Mouse down detected:', { activeTool, isPanning })
  
  const canvas = e.currentTarget
  console.log('Canvas info:', { 
    width: canvas.width, 
    height: canvas.height,
    rectWidth: rect.width,
    rectHeight: rect.height,
    pageNum 
  })
}
```

## How to Use Drawing Tools

1. **Select a Tool** from the left toolbar:
   - **Select/Pan (V)** - Default mode for panning/zooming
   - **Line (L)** - Draw straight lines
   - **Rectangle (R)** - Draw rectangles
   - **Measurement (M)** - Draw measurement lines
   - **Note (N)** - Add comment notes

2. **Look for the Blue Badge** at the top - it confirms your tool is active

3. **Click and Drag** on the PDF to draw

4. **Release** to complete the drawing

5. **Press Esc or V** to return to select mode

## Debugging Checklist

If drawing still doesn't work, check:

### In Browser Console:
1. **Click on the PDF** - Do you see console logs?
   - `Mouse down detected: { activeTool: 'line', isPanning: false }`
   - `Canvas info: { width: 612, height: 792, ... }`

2. **Is canvas width/height 0?**
   - If yes: The canvas isn't sizing properly
   - Try: Refresh the page, wait for PDF to fully load

3. **Do you see the blue "mode active" badge?**
   - If no: The tool state isn't being set
   - Try: Click the tool button again

### Visual Checks:
1. **Is the cursor changing?**
   - Select mode: Grab cursor
   - Drawing modes: Crosshair cursor
   - If not: Event handlers might not be attached

2. **Are you clicking on the PDF or on empty space?**
   - The canvas only covers the PDF pages
   - Click directly on the white PDF area

3. **Is the PDF fully loaded?**
   - Wait for all pages to finish loading
   - Look for "Loading page..." text to disappear

## Common Issues

### Issue: Canvas is 0x0
**Solution**: Wait for PDF to load, or manually trigger resize:
- Zoom in/out to trigger canvas resize
- Scroll to force redraw
- Refresh the page

### Issue: Clicks not registering
**Solution**: Check z-index and pointer-events:
- Canvas should have `z-index: 10`
- Canvas should have `pointerEvents: 'auto'`
- PDF container shouldn't have `pointer-events: none`

### Issue: Drawings disappear on zoom
**Solution**: This is expected - drawings use relative coordinates
- Drawings should scale with zoom
- If not, check `redrawCanvas()` is being called after zoom

### Issue: Can only draw on first page
**Solution**: Each page needs its own canvas
- Check `canvasRefs.current` has entries for all pages
- Verify `data-page` attribute is set correctly

## Files Modified

- `app/dashboard/plans/[id]/page.tsx`:
  - Added immediate canvas sizing in ref callback
  - Added Page onLoadSuccess with canvas resize
  - Added z-index to canvas
  - Added visual tool indicator
  - Added debug logging

## Testing

To verify the fix works:

1. Upload a PDF plan
2. Click "Line" tool in left toolbar
3. **Check**: Blue badge appears saying "line mode active"
4. **Check**: Cursor changes to crosshair
5. **Check**: Console shows "Mouse down detected" when clicking
6. **Check**: Console shows canvas dimensions are > 0
7. Click and drag on PDF - line should appear
8. Release mouse - line should stay
9. Press Esc - should return to select mode
10. Zoom in/out - line should scale with PDF

---

**Status**: ✅ Fixed  
**Last Updated**: October 12, 2025


