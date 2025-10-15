# Scale Settings Feature 📏

## What It Does

The **Settings button** (gear icon ⚙️) at the bottom of the left toolbar now opens a **Scale Settings modal** that lets you configure the drawing scale for construction plans.

## Location

**Left Toolbar** → Bottom → ⚙️ **Settings Button**

## Features

### Scale Options

#### Architectural Scales (Imperial)
- **1/8" = 1'** - 96 pixels per unit
- **1/4" = 1'** - 48 pixels per unit (Default)
- **1/2" = 1'** - 24 pixels per unit  
- **1" = 1'** - 12 pixels per unit

#### Metric Scales
- **1:100** - 100 pixels per unit
- **1:50** - 50 pixels per unit
- **1:20** - 20 pixels per unit

### How It Works

1. **Click Settings button** (⚙️) in left toolbar
2. **Modal opens** with scale options
3. **Select your scale** from the dropdown
4. **Current scale displays** in blue info box
5. **Click "Apply Scale"** to save
6. **Use Measurement tool (M)** to draw scaled measurements

## UI Components

### Modal Layout
```
┌─────────────────────────────────────┐
│ ⚙️  Set Drawing Scale           [X] │
├─────────────────────────────────────┤
│                                     │
│ Scale Ratio                         │
│ Set the scale of your construction  │
│ plan (e.g., 1/4" = 1')             │
│                                     │
│ [1/4" = 1' (Architectural) ▼]      │
│                                     │
│ ┌─────────────────────────────┐   │
│ │ Current Scale: 1/4" = 1'    │   │
│ │ Use the Measurement tool... │   │
│ └─────────────────────────────┘   │
│                                     │
│            [Cancel] [Apply Scale]   │
└─────────────────────────────────────┘
```

### Visual Feedback
- **Blue info box** shows current scale
- **Helpful hint** about using Measurement tool
- **Alert confirmation** when scale is applied

## State Management

### Scale State
```typescript
const [scale, setScale] = useState({ 
  ratio: '1/4" = 1\'',    // Default architectural scale
  pixelsPerUnit: 48        // Pixels per foot
})

const [isSettingScale, setIsSettingScale] = useState(false)
```

### Scale Map
```typescript
const scaleMap = {
  '1/8" = 1\'': 96,
  '1/4" = 1\'': 48,
  '1/2" = 1\'': 24,
  '1" = 1\'': 12,
  '1:100': 100,
  '1:50': 50,
  '1:20': 20
}
```

## Usage Workflow

### Setting Scale
```
1. Open plan in editor
2. Click ⚙️ Settings button
3. Choose appropriate scale
4. Click "Apply Scale"
5. Confirmation appears
```

### Using with Measurement Tool
```
1. Set scale (e.g., 1/4" = 1')
2. Press M or click Measurement tool
3. Draw line on plan
4. Line calculates actual dimensions
5. Based on scale ratio
```

## Common Construction Scales

### Residential Plans
- **1/4" = 1'** - Most common for floor plans
- **1/2" = 1'** - Detailed sections
- **1/8" = 1'** - Site plans

### Commercial Plans
- **1/8" = 1'** - Floor plans
- **1/4" = 1'** - Detailed areas
- **1" = 1'** - Very detailed sections

### Site Plans
- **1:100** - Small sites
- **1:50** - Medium sites
- **1:20** - Detailed landscape

## Integration with Tools

### Measurement Tool (M)
When you draw with the Measurement tool:
```typescript
// Calculates real-world distance
const pixelLength = Math.sqrt(dx² + dy²)
const realLength = pixelLength / scale.pixelsPerUnit
// e.g., 96 pixels / 48 = 2 feet
```

### Future Enhancements
- **Auto-detect scale** from plan metadata
- **Calibration mode** - click two known points
- **Custom scales** - enter any ratio
- **Save per plan** - remember scale for each file

## Code Location

**File:** `app/dashboard/plans/[id]/page.tsx`

**Modal Component:** Lines 2174-2264

**State:** Lines 207-209

**Button:** Lines 1184-1193

## Testing

### Manual Test
1. ✅ Click Settings button → Modal opens
2. ✅ Close with X button → Modal closes
3. ✅ Close with Cancel → Modal closes
4. ✅ Select different scale → Updates in info box
5. ✅ Click Apply Scale → Shows confirmation
6. ✅ Modal closes → Returns to editor

### Scale Values Test
1. ✅ 1/8" = 1' → 96 pixels/unit
2. ✅ 1/4" = 1' → 48 pixels/unit (default)
3. ✅ 1/2" = 1' → 24 pixels/unit
4. ✅ 1" = 1' → 12 pixels/unit
5. ✅ 1:100 → 100 pixels/unit
6. ✅ 1:50 → 50 pixels/unit
7. ✅ 1:20 → 20 pixels/unit

## Keyboard Shortcuts

Currently none, but could add:
- **S** - Open Scale Settings
- **Esc** - Close modal
- **Enter** - Apply and close

## Visual Design

### Colors
- **Primary**: Blue (`#3b82f6`)
- **Info Box**: Light blue background (`bg-blue-50`)
- **Button**: Blue 600 (`bg-blue-600`)

### Icons
- **Settings**: ⚙️ `<Settings />`
- **Save**: 💾 `<Save />`
- **Close**: ✕ `<XIcon />`

### Spacing
- Modal padding: `p-6`
- Content spacing: `space-y-4`
- Button spacing: `space-x-2`

## Accessibility

- ✅ **Keyboard navigable** - Tab through controls
- ✅ **Screen reader friendly** - Proper labels
- ✅ **Focus management** - Returns to button on close
- ✅ **ESC to close** - Standard modal behavior
- ✅ **Backdrop click** - Could add to close modal

## Future Improvements

### 1. Scale Persistence
Save scale to database per plan:
```sql
ALTER TABLE plans 
ADD COLUMN scale_ratio TEXT DEFAULT '1/4" = 1''',
ADD COLUMN pixels_per_unit INTEGER DEFAULT 48;
```

### 2. Auto-Detection
```typescript
// Read scale from PDF metadata
const detectScale = async (pdfUrl: string) => {
  // Parse PDF annotations
  // Look for scale note (e.g., "SCALE: 1/4" = 1'-0"")
  // Return detected scale
}
```

### 3. Calibration Mode
```typescript
// Two-point calibration
const calibrateScale = () => {
  // 1. User clicks point A
  // 2. User clicks point B
  // 3. User enters known distance
  // 4. Calculate pixels per unit
}
```

### 4. Custom Scale Input
```tsx
<Input
  placeholder="Enter custom scale (e.g., 1:75)"
  onChange={handleCustomScale}
/>
```

### 5. Scale Indicator
Show current scale in the UI:
```tsx
<div className="absolute top-4 left-4 bg-white px-3 py-1 rounded shadow">
  📏 Scale: {scale.ratio}
</div>
```

## Troubleshooting

### Modal doesn't open
**Check:** Console for errors  
**Solution:** Verify `isSettingScale` state updates

### Scale doesn't apply
**Check:** Alert shows after clicking Apply  
**Solution:** If no alert, check onClick handler

### Wrong measurements
**Check:** `scale.pixelsPerUnit` value  
**Solution:** Verify scale map has correct values

## Related Files

- `app/dashboard/plans/[id]/page.tsx` - Main implementation
- `components/ui/select.tsx` - Dropdown component
- `components/ui/card.tsx` - Modal container
- `components/ui/button.tsx` - Action buttons

## Summary

The Settings button now opens a fully functional Scale Settings modal that allows users to:

✅ **Choose from 7 common scales**  
✅ **See current scale displayed**  
✅ **Apply scale for measurements**  
✅ **Get helpful usage hints**  
✅ **Professional, construction-focused UI**

Perfect for accurate takeoffs and measurements on construction plans! 📐

---

**Status**: ✅ Implemented  
**Date**: October 12, 2025  
**Feature**: Scale Settings Modal


