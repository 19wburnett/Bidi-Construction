# Plan Annotator Feature

## Overview
The Plan Annotator allows users to view project plans in a large modal and drag bidder notes onto specific locations on the PDF, creating an annotated plan that can be downloaded.

## Features Implemented

### 1. **Large Modal with Split View**
- Left side: PDF viewer with zoom controls (50% - 300%)
- Right side: Panel showing all bidder notes organized by contractor
- Full-screen modal (95% viewport width and height)

### 2. **Drag-and-Drop Note Placement**
- Drag notes from the right panel onto specific locations on the PDF
- Visual pin markers show placed notes on the plan
- Color-coded pins based on note type:
  - 🔵 Blue: Requirements
  - 🔴 Red: Concerns
  - 🟢 Green: Suggestions
  - 🟡 Yellow: Timeline notes
  - 🟣 Purple: Material notes
  - ⚫ Gray: Other notes

### 3. **Interactive Note Markers**
- Hover over placed notes to see full details
- Shows bidder name, note type, category, content, and confidence score
- Remove button appears on hover to un-place notes
- Notes can be dragged on the PDF (currently places at drop location)

### 4. **Note Tracking**
- Real-time counter showing placed vs. remaining notes
- Visual indication in notes panel showing which notes are already placed
- Per-contractor tracking of placed/unplaced notes

### 5. **User Interface**
- Zoom in/out controls with percentage display
- Download button (placeholder for full implementation)
- Close dialog button
- Footer with statistics

## How to Use

1. **Navigate to Job Details Page** with plan files uploaded
2. **Click the Edit (pencil) icon** on any plan file in the Plans Viewer section
3. **The Plan Annotator Modal opens** showing:
   - Plan on the left
   - All bidder notes on the right
4. **Drag notes** from the right panel onto relevant locations on the plan
5. **Hover over placed markers** to see note details
6. **Click the X** on a marker to remove it from the plan
7. **Use zoom controls** to adjust view scale
8. **Click "Download Annotated Plan"** to export (requires full implementation)

## Files Modified/Created

### New Files
- `components/plan-annotator-modal.tsx` - Main annotator component
- `components/ui/dialog.tsx` - Dialog/modal UI component
- `PLAN_ANNOTATOR_FEATURE.md` - This documentation

### Modified Files
- `components/plans-viewer.tsx` - Added "Annotate" button and modal integration
- `app/dashboard/jobs/[id]/page.tsx` - Updated to pass bid notes to PlansViewer

## Technical Implementation

### Component Structure
```
PlanAnnotatorModal
├── Dialog (Modal Container)
├── Header (Title, Zoom Controls, Download Button)
├── Main Content
│   ├── PDF Viewer (Left - with iframe)
│   │   └── Note Markers (Absolute positioned pins)
│   └── Notes Panel (Right - scrollable list)
│       └── Bid Notes (Organized by contractor)
└── Footer (Statistics)
```

### State Management
- `placedNotes`: Array of notes that have been placed on the plan with x,y coordinates
- `zoom`: Current zoom level (0.5 to 3.0)
- `draggingNote`: Currently dragging note ID for visual feedback

### Data Flow
1. Bids with bid_notes passed from job details page
2. Notes displayed in right panel, organized by contractor
3. Drag event captures note data
4. Drop event calculates relative position on PDF
5. Note added to placedNotes array with coordinates
6. Marker rendered on PDF at calculated position

## Future Enhancements Needed

### 1. **Full PDF Download with Annotations**
Currently, the download button shows an alert. To fully implement:
- Install `pdf-lib` or `jsPDF` library
- Load original PDF as bytes
- Overlay text/annotations at specified coordinates
- Generate new PDF blob
- Trigger browser download

Example implementation:
```javascript
import { PDFDocument, rgb } from 'pdf-lib'

async function downloadAnnotatedPlan() {
  const pdfBytes = await fetch(planFile).then(r => r.arrayBuffer())
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  
  placedNotes.forEach(note => {
    const x = (note.x / 100) * firstPage.getWidth()
    const y = firstPage.getHeight() - ((note.y / 100) * firstPage.getHeight())
    
    firstPage.drawText(note.content, {
      x, y,
      size: 10,
      color: rgb(0, 0, 0)
    })
  })
  
  const pdfBytesOut = await pdfDoc.save()
  // Download pdfBytesOut
}
```

### 2. **PDF Rendering Enhancement**
- Replace iframe with proper PDF renderer (e.g., `react-pdf` or `pdfjs-dist`)
- Better page navigation for multi-page plans
- Improved zoom and pan controls
- Canvas-based rendering for better annotation overlay

### 3. **Note Persistence**
- Save placed note positions to database (plan_annotations table exists)
- Load previously placed annotations when opening modal
- Allow editing of placed note content

### 4. **Advanced Annotation Tools**
- Drawing tools (lines, arrows, shapes)
- Text annotations (user-created notes)
- Highlighting areas
- Measurement tools

### 5. **Collaboration Features**
- Real-time updates when multiple users annotate
- Comment threads on specific annotations
- Version history of annotated plans

### 6. **Export Options**
- Export as PNG/JPEG image
- Export annotations as separate JSON file
- Print-optimized version

## Known Limitations

1. **PDF Display**: Currently uses iframe which has limitations:
   - Some PDF files may not render properly
   - Limited control over PDF viewer features
   - May not work with all browsers consistently

2. **Multi-Page Plans**: Current implementation assumes single-page PDFs
   - Need to add page navigation for multi-page documents
   - Note placement needs page number tracking

3. **Mobile Support**: Modal is optimized for desktop
   - Touch events need separate handling for mobile drag-drop
   - Responsive layout may need adjustment for tablets/phones

4. **Performance**: Large plans or many notes may impact performance
   - Consider lazy loading notes
   - Optimize re-renders when dragging
   - Add virtualization for large note lists

## Database Schema

The existing `plan_annotations` table can store placed notes:
```sql
CREATE TABLE plan_annotations (
  id UUID PRIMARY KEY,
  job_request_id UUID REFERENCES job_requests(id),
  plan_file_url TEXT,
  bid_id UUID REFERENCES bids(id),
  annotation_type TEXT, -- 'note', 'concern', 'suggestion', etc.
  x_coordinate FLOAT, -- Percentage position (0-100)
  y_coordinate FLOAT, -- Percentage position (0-100)
  content TEXT,
  created_at TIMESTAMP,
  created_by UUID
)
```

To persist annotations, call the Supabase API when notes are placed/moved/removed.

## Testing Checklist

- [ ] Modal opens when clicking Edit button on plan
- [ ] Notes appear in right panel organized by contractor
- [ ] Drag and drop works to place notes on PDF
- [ ] Note markers appear at correct positions
- [ ] Hover shows note details in popup
- [ ] Remove button works to un-place notes
- [ ] Zoom controls work (in/out)
- [ ] Close button closes modal
- [ ] Statistics update correctly
- [ ] Works with multiple bids/contractors
- [ ] Works with plans that have no notes
- [ ] Works when no bids have notes

## Dependencies

Current dependencies used:
- React (useState, useRef, useEffect)
- Tailwind CSS for styling
- Lucide React for icons
- Custom UI components (Dialog, Button, Badge, Card)

Recommended additions for full functionality:
```json
{
  "pdf-lib": "^1.17.1",
  "react-pdf": "^7.5.1",
  "pdfjs-dist": "^3.11.174"
}
```

