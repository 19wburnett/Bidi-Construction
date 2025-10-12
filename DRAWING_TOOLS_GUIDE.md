# Drawing Tools - User Guide

## How to Use the Plan Editor

### Navigation & Panning

1. **Select Tool (Default)**
   - Click the **Move icon** (top button in left toolbar) or press **V** or **Esc**
   - When active, you can **drag to pan** around the plan
   - The cursor changes to a **hand icon** (grab when ready, grabbing when dragging)
   - Great for navigating large plans after zooming in

2. **Zoom Controls**
   
   **Button Controls:**
   - Use the **+ and -** buttons in the top toolbar
   - Or use the **percentage display** to see current zoom level
   - Zoom range: 25% to 300%
   - Default: 50% for comfortable viewing
   
   **Trackpad/Mouse Gestures:**
   - **Pinch to Zoom** (trackpad): Use two fingers to pinch/spread for zooming in/out
   - **Ctrl/Cmd + Scroll** (mouse wheel): Hold Ctrl (Windows/Linux) or Cmd (Mac) and scroll
   - **Two-Finger Scroll** (trackpad): Natural scrolling for panning through pages
   - **Visual Feedback**: A blue zoom indicator appears showing the current zoom percentage
   - **Note**: Browser zoom is disabled on this page - all zoom gestures control the PDF viewer only
   
   - After zooming in, switch to Select tool to pan around

### Drawing Tools

#### Line Tool
- Click the **Line icon** or press **L**
- Click and drag to draw a straight line
- Release to finish
- Automatically returns to Select tool after drawing

#### Rectangle Tool
- Click the **Rectangle icon** or press **R**
- Click and drag to draw a rectangle
- Release to finish
- Automatically returns to Select tool after drawing

#### Measurement Tool
- Click the **Ruler icon** or press **M**
- Similar to line tool, but intended for measurements
- Future enhancement: will show actual measurements based on scale
- Automatically returns to Select tool after drawing

### Visual Feedback

1. **Active Tool Indicator** (top-left overlay)
   - Shows which tool is currently active
   - Displays helpful instructions
   - Animated blue dot when drawing tools are active

2. **Zoom Indicator** (center-top overlay, appears when zooming)
   - Shows current zoom percentage in large blue badge
   - Appears temporarily when using zoom controls or gestures
   - Auto-hides after 1 second

3. **Drawings Counter** (top-right overlay, when drawings exist)
   - Shows how many drawings are on all pages
   - **Trash icon**: Clear all drawings from all pages (with confirmation)

4. **Cursor Changes**
   - **Hand (grab/grabbing)**: Select tool - drag to pan
   - **Crosshair**: Drawing tools - click and drag to draw

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **V** or **Esc** | Switch to Select tool / Cancel current drawing |
| **L** | Activate Line tool |
| **R** | Activate Rectangle tool |
| **M** | Activate Measurement tool |
| **A** | Toggle analysis sidebar (show/hide) |

### Drawing Persistence

- All drawings are **automatically saved** to the database
- Drawings are **page-specific** (each page has its own set)
- Drawings **persist across sessions** - they'll be there when you return
- Use the trash icon to clear all drawings from all pages

### Multi-Page PDFs

- **All pages display at once** in a vertical scroll layout
- Each page has a label showing "Page X of Y"
- Scroll through pages naturally - no pagination needed
- Each page maintains its own drawings independently
- Zoom affects all pages simultaneously

## Analysis Sidebar

The right sidebar provides AI-powered analysis tools that can be hidden for a larger workspace.

### Hiding/Showing the Sidebar
- **Hide**: Click the chevron button (→) in the top-right corner of the sidebar
- **Show**: Click the floating round button on the right edge when hidden
- **Keyboard**: Press **A** to toggle the sidebar visibility
- **Benefit**: Maximize PDF viewing space when not actively analyzing

### Analysis Modes

#### Takeoff Mode
- Click "Analyze" to run AI-powered takeoff analysis
- Extracts quantities, materials, and measurements
- Provides cost estimates based on your drawings
- Results include item lists, material requirements, and cost breakdowns

#### Quality Mode
- Click "Analyze" to run AI plan quality check
- Identifies missing details and potential issues
- References industry standards
- Provides recommendations for improvement

## Technical Details

### Canvas Rendering

- Drawings are rendered on an HTML5 canvas overlay
- Canvas automatically resizes to match the PDF page dimensions
- Blue color (#3b82f6) with 80% opacity
- Stroke width: 3 pixels for visibility

### Drawing Coordinates

- Stored as absolute pixel coordinates relative to the PDF page
- Works consistently across zoom levels
- Calculated from canvas position, not screen position

### Performance

- Canvas updates in real-time during drawing
- Efficient redrawing only when needed
- Smooth drawing experience even on large PDFs

## Troubleshooting

### Drawing Not Appearing
1. Make sure you're using a drawing tool (not Select)
2. Click and drag - single clicks won't create drawings
3. Minimum size threshold: 5 pixels in either direction
4. Check the Active Tool Indicator to confirm tool selection

### Can't Pan Around
1. Switch to Select tool (V or Esc)
2. Click and drag on the plan
3. Make sure you're not trying to pan while a drawing tool is active

### Drawings Disappeared After Page Change
- Drawings are page-specific
- Check the page counter to confirm you're on the right page
- Navigate back to the page where you drew

### Canvas Positioning Issues
- The canvas automatically sizes to match the PDF
- If issues persist, try refreshing the page
- Check browser console for any errors

## Future Enhancements

Planned features for drawing tools:

1. **Scale-Based Measurements**
   - Set scale ratio (e.g., "1/4" = 1'")
   - Measurements will show actual dimensions

2. **More Drawing Tools**
   - Circle/Ellipse tool
   - Polygon tool
   - Text annotation tool
   - Freehand drawing tool

3. **Drawing Management**
   - Select and delete individual drawings
   - Edit drawing properties (color, thickness)
   - Layers for organizing drawings
   - Show/hide all drawings

4. **Advanced Features**
   - Area calculations for rectangles
   - Length totals for measurements
   - Export drawings as separate layer
   - Drawing templates and symbols

5. **Collaboration**
   - See other users' drawings in real-time
   - Color-coded by user
   - Drawing permissions and sharing

## Tips for Best Results

1. **Use trackpad gestures** for the fastest navigation - pinch to zoom, two-finger scroll to pan
2. **Zoom in** before drawing for more precision (Ctrl/Cmd + Scroll or use buttons)
3. **Use Select tool** to pan around when zoomed in, or just two-finger scroll
4. **Press Esc** any time to cancel and return to Select tool
5. **Save frequently** - drawings auto-save, but analysis results should be re-run if needed
6. **One tool at a time** - tools auto-return to Select after each drawing
7. **Check Active Tool Indicator** if unsure what mode you're in
8. **Watch the Zoom Indicator** to see your current zoom level when using gestures

## Summary

The drawing tools provide a Figma-like experience for annotating construction plans:
- ✅ **Trackpad/Mouse Gestures** - Pinch to zoom, Ctrl/Cmd+Scroll, smooth scrolling
- ✅ **Pan and Zoom** - 25%-300% with visual feedback indicator
- ✅ **Drawing Tools** - Lines, rectangles, and measurements
- ✅ **Auto-save** - All drawings persist to database automatically
- ✅ **Keyboard Shortcuts** - Fast workflow with V, L, R, M, A, Esc
- ✅ **Multi-page Support** - All pages visible, draw on any page
- ✅ **Hideable Sidebar** - Toggle analysis panel for more space
- ✅ **Visual Feedback** - Tool indicators, zoom display, drawing counter
- ✅ **AI Analysis** - Takeoff and quality checking modes

Perfect for marking up areas, highlighting issues, adding measurements, and preparing plans for AI analysis!

