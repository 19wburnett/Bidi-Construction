# Figma-Style Canvas Architecture

## The Difference Between Current Implementation and Figma

### Current Implementation (Event-Based)
```
User zooms → Update state → Re-render PDF → Resize canvas → Convert coords → Redraw
```
- Multiple state updates
- Coordinate conversion on every draw
- Redraw triggered by React state changes
- Canvas size tied to PDF size

### Figma Implementation (Transform-Based)
```
User zooms → Update viewport transform → Next frame renders with new transform
```
- Single transform matrix
- Original coordinates preserved
- Continuous 60fps rendering loop
- Independent canvas coordinate system

## Key Techniques Figma Uses

### 1. Transform Matrix (The Big One)

Instead of converting coordinates, apply a transformation to the entire canvas:

```typescript
const [viewport, setViewport] = useState({
  zoom: 1,
  panX: 0,
  panY: 0
})

const render = useCallback(() => {
  const ctx = canvas.getContext('2d')
  
  // Clear entire canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // Apply viewport transform
  ctx.save()
  ctx.translate(viewport.panX, viewport.panY)
  ctx.scale(viewport.zoom, viewport.zoom)
  
  // Draw PDF (as image at 0,0)
  ctx.drawImage(pdfImage, 0, 0)
  
  // Draw all shapes using ORIGINAL coordinates
  drawings.forEach(drawing => {
    ctx.strokeStyle = drawing.style.color
    ctx.lineWidth = drawing.style.strokeWidth / viewport.zoom // Adjust line width
    ctx.beginPath()
    ctx.moveTo(drawing.x1, drawing.y1) // Original coords!
    ctx.lineTo(drawing.x2, drawing.y2)
    ctx.stroke()
  })
  
  ctx.restore()
}, [viewport, drawings, pdfImage])
```

**Benefits:**
- ✅ No coordinate conversion
- ✅ GPU-accelerated
- ✅ Smooth at any zoom level
- ✅ Line widths stay consistent

### 2. RequestAnimationFrame Loop

Continuous rendering at 60fps:

```typescript
useEffect(() => {
  let animationId: number
  
  const renderLoop = () => {
    render()
    animationId = requestAnimationFrame(renderLoop)
  }
  
  animationId = requestAnimationFrame(renderLoop)
  
  return () => cancelAnimationFrame(animationId)
}, [render])
```

**Benefits:**
- ✅ Buttery smooth
- ✅ Synchronized with browser refresh
- ✅ Automatic throttling when tab inactive

### 3. Multi-Layer Canvas System

```typescript
// Layer 1: Static background (PDF)
<canvas ref={backgroundRef} className="absolute" />

// Layer 2: Saved drawings
<canvas ref={drawingsRef} className="absolute" />

// Layer 3: Active drawing being created
<canvas ref={activeRef} className="absolute" />

// Layer 4: UI overlays (selection boxes, handles)
<canvas ref={uiRef} className="absolute" />
```

**Benefits:**
- ✅ Only redraw what changed
- ✅ UI updates don't affect drawings
- ✅ Better performance

### 4. Viewport-Based Coordinates

Store shapes in absolute "world" coordinates:

```typescript
interface Drawing {
  // World coordinates (never change)
  x1: number  // e.g., 100
  y1: number  // e.g., 200
  x2: number  // e.g., 300
  y2: number  // e.g., 400
}

interface Viewport {
  // Camera position in world space
  x: number      // Where camera is looking
  y: number      // Where camera is looking
  zoom: number   // How zoomed in (1 = 100%)
}
```

When drawing to screen:
```typescript
// Canvas transform handles the mapping automatically
ctx.setTransform(zoom, 0, 0, zoom, -viewport.x * zoom, -viewport.y * zoom)
```

### 5. Smooth Wheel Zooming

```typescript
const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  
  // Get mouse position in canvas
  const rect = canvas.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  
  // Calculate zoom change
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = viewport.zoom * zoomFactor
  
  // Zoom toward mouse cursor
  setViewport(prev => ({
    zoom: newZoom,
    panX: mouseX - (mouseX - prev.panX) * (newZoom / prev.zoom),
    panY: mouseY - (mouseY - prev.panY) * (newZoom / prev.zoom)
  }))
}
```

**Benefits:**
- ✅ Zooms toward cursor position
- ✅ Smooth, no jumping
- ✅ Feels natural

## Complete Example: Figma-Style Canvas

```typescript
const FigmaStylePlanEditor = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState({ zoom: 1, x: 0, y: 0 })
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [pdfImage, setPdfImage] = useState<HTMLImageElement | null>(null)
  
  // Continuous render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Apply viewport transform
    ctx.save()
    ctx.translate(viewport.x, viewport.y)
    ctx.scale(viewport.zoom, viewport.zoom)
    
    // Draw PDF
    if (pdfImage) {
      ctx.drawImage(pdfImage, 0, 0)
    }
    
    // Draw all shapes
    drawings.forEach(drawing => {
      ctx.strokeStyle = drawing.style.color
      ctx.lineWidth = drawing.style.strokeWidth / viewport.zoom
      ctx.beginPath()
      ctx.moveTo(drawing.x1, drawing.y1)
      ctx.lineTo(drawing.x2, drawing.y2)
      ctx.stroke()
    })
    
    ctx.restore()
  }, [viewport, drawings, pdfImage])
  
  // RAF loop
  useEffect(() => {
    let animationId: number
    const loop = () => {
      render()
      animationId = requestAnimationFrame(loop)
    }
    animationId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animationId)
  }, [render])
  
  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const zoomDelta = -e.deltaY * 0.001
      const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * (1 + zoomDelta)))
      
      setViewport(prev => ({
        zoom: newZoom,
        x: mouseX - (mouseX - prev.x) * (newZoom / prev.zoom),
        y: mouseY - (mouseY - prev.y) * (newZoom / prev.zoom)
      }))
    }
  }, [viewport])
  
  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      onWheel={handleWheel}
      className="block"
    />
  )
}
```

## Comparison Table

| Feature | Our Current Approach | Figma-Style Approach |
|---------|---------------------|---------------------|
| **Coordinate System** | Relative (0-1) converted to pixels | Absolute world coords + transform |
| **Rendering** | Event-based (on state change) | Continuous 60fps loop |
| **Zoom** | Resize canvas, convert coords | Update transform matrix |
| **Performance** | Good for few drawings | Excellent for thousands |
| **Smoothness** | Can stutter on zoom | Always smooth |
| **Line Width** | Scales with zoom | Stays constant |
| **Complexity** | Lower | Higher |
| **Memory** | Lower (events) | Higher (continuous) |

## When to Use Each Approach

### Current Approach (Good for):
- ✅ Simple drawing apps
- ✅ Few drawings (<100)
- ✅ Infrequent zooming
- ✅ Lower memory usage
- ✅ Easier to understand/maintain

### Figma-Style (Better for):
- ✅ Professional CAD/design tools
- ✅ Many drawings (>100)
- ✅ Frequent zooming/panning
- ✅ Smooth 60fps required
- ✅ Complex interactions

## Hybrid Approach (Best of Both Worlds)

For our construction plan viewer:

```typescript
// Use transform matrix for rendering
// But trigger renders on events (not RAF)
const redrawCanvas = useCallback(() => {
  const ctx = canvas.getContext('2d')
  ctx.save()
  ctx.setTransform(zoom, 0, 0, zoom, panX, panY)
  
  // Draw PDF pages
  pdfPages.forEach(page => {
    ctx.drawImage(page.canvas, 0, page.offsetY)
  })
  
  // Draw shapes using original coordinates
  drawings.forEach(drawing => {
    ctx.strokeStyle = drawing.style.color
    ctx.lineWidth = drawing.style.strokeWidth / zoom // Keep lines thin
    ctx.beginPath()
    ctx.moveTo(drawing.x1, drawing.y1)
    ctx.lineTo(drawing.x2, drawing.y2)
    ctx.stroke()
  })
  
  ctx.restore()
}, [zoom, panX, panY, drawings, pdfPages])

// Trigger on zoom change (not continuous)
useEffect(() => {
  redrawCanvas()
}, [zoom, panX, panY, redrawCanvas])
```

**Benefits:**
- ✅ Smooth rendering like Figma
- ✅ Event-based (saves battery)
- ✅ Simpler than full RAF loop
- ✅ Works great with React

## Implementation Plan

To upgrade our current system to Figma-style:

### Phase 1: Switch to Transform Matrix
1. Change drawings from relative (0-1) to absolute coordinates
2. Use `ctx.setTransform()` instead of coordinate conversion
3. Keep event-based rendering

### Phase 2: Add RAF Loop
1. Implement requestAnimationFrame loop
2. Make rendering independent of React state
3. Use state only for data, not rendering

### Phase 3: Multi-Layer Canvas
1. Split into background, drawings, active, UI layers
2. Optimize redraws per layer

### Phase 4: Advanced Features
1. Zoom toward cursor
2. Smooth interpolation
3. Dirty region optimization

## Quick Win: Transform Matrix Only

We can get 80% of the smoothness with 20% of the work by just switching to transform matrix:

```diff
- // Convert coordinates
- const x = relativeX * canvas.width
- const y = relativeY * canvas.height

+ // Use transform
+ ctx.save()
+ ctx.scale(zoom, zoom)
+ // Use original coordinates directly
+ ctx.moveTo(drawing.x1, drawing.y1)
+ ctx.restore()
```

Would you like me to implement this transform matrix approach for a smoother experience?

---

**Author**: AI Assistant  
**Date**: October 12, 2025  
**Purpose**: Explain professional canvas rendering architecture

