# Note Commenting Feature

## Overview

The note commenting feature has been integrated into the plan editor as one of the drawing tools. You can now place notes/comments directly on your construction plans alongside lines, rectangles, and measurements.

## Features

### 1. **Note Tool**
- Added to the left toolbar with a MessageSquare icon
- Keyboard shortcut: **N**
- Click anywhere on the plan to place a note

### 2. **Note Types**
- 📄 **Requirement** - For requirements and specifications
- ⚠️ **Concern** - For concerns and issues
- 💡 **Suggestion** - For suggestions and improvements
- ⏰ **Timeline** - For timeline and scheduling notes
- 📦 **Material** - For material-related notes
- 📝 **Other** - For general notes

Each type has a distinct color coding:
- Requirement: Blue
- Concern: Red
- Suggestion: Green
- Timeline: Yellow
- Material: Purple
- Other: Gray

### 3. **Creating Notes**
1. Select the Note tool (click icon or press **N**)
2. Click on the plan where you want to place the note
3. A modal will appear with the following fields:
   - **Note Type** (required) - Select from dropdown
   - **Category** (optional) - e.g., "Electrical", "Plumbing"
   - **Location** (optional) - e.g., "Floor 2", "Room A"
   - **Content** (required) - The note text
4. Click "Create Note" to save

### 4. **Note Pins**
- Notes appear as circular pins with emoji icons on the plan
- Pin color matches the note type
- Hover over a pin to see a preview tooltip
- Click a pin to see the full note details in a popup card

### 5. **Note Popup Cards**
When you click a note pin, a detailed card appears showing:
- Note type and icon
- Full content
- Category and location (if specified)
- Confidence score (100% for user-created notes)
- Delete button

### 6. **Notes Sidebar Tab**
Added a third tab to the analysis sidebar:
- **Takeoff** - AI takeoff analysis
- **Quality** - AI quality analysis  
- **Notes** - View all notes

The Notes tab shows:
- Total note count
- List of all notes on all pages
- Each note card shows type, page number, content, category, and location
- Click a note card to highlight it and scroll to its location
- Delete notes directly from the list

### 7. **Database Storage**
- Notes are stored in the existing `plan_drawings` table
- The `note_data` field (JSONB) stores:
  ```json
  {
    "note_type": "requirement",
    "category": "Electrical",
    "location": "Floor 2",
    "content": "Verify outlet placement",
    "confidence_score": 1.0
  }
  ```

## How to Use

### Quick Start
1. Open a plan in the plan editor
2. Press **N** or click the MessageSquare icon in the toolbar
3. Click anywhere on the plan to place a note
4. Fill out the note form and click "Create Note"
5. The note pin will appear on the plan

### Managing Notes
- **View all notes**: Click the "Notes" tab in the right sidebar
- **View note details**: Click any note pin on the plan
- **Delete a note**: Click the trash icon in the note popup or in the sidebar list
- **Navigate to a note**: Click a note in the sidebar list to scroll to its location

### Best Practices
- Use **Requirement** for must-have specifications
- Use **Concern** for potential issues or problems
- Use **Suggestion** for optional improvements
- Use **Timeline** for schedule-related notes
- Add **Category** to group related notes (e.g., all electrical notes)
- Add **Location** to specify where on the building the note applies

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **N** | Activate Note tool |
| **V** or **Esc** | Cancel and return to Select tool |
| **A** | Toggle analysis sidebar |

## Technical Details

### Type System
```typescript
interface Drawing {
  type: 'line' | 'rectangle' | 'circle' | 'measurement' | 'note'
  note_data?: {
    note_type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
    category: string | null
    location: string | null
    content: string
    confidence_score: number
  }
}
```

### Coordinate System
- Notes use the same relative coordinate system (0-1) as other drawings
- Positions are stored as percentages of the page dimensions
- Works consistently across zoom levels

### Features Inherited from Plan Annotator Modal
- ✅ Color-coded note types
- ✅ Category and location metadata
- ✅ Confidence scoring
- ✅ Rich popup cards with formatting
- ✅ Badge-based metadata display
- ✅ Delete functionality
- ✅ Page-specific notes

## Future Enhancements

Potential features for the future:
- Edit existing notes
- Drag-to-reposition note pins
- Filter notes by type in sidebar
- Export notes to PDF or CSV
- Note threads/replies
- @mentions for collaboration
- Note templates
- Attach photos to notes
- Link notes to takeoff items

## Summary

The note commenting feature brings the powerful annotation capabilities from the plan annotator modal directly into your everyday plan editing workflow. Now you can:
- 📝 Add notes while reviewing plans
- 📊 Track concerns and requirements
- 🔍 View all notes in one place
- 🎯 Click to navigate to specific notes
- 🎨 Organize notes by type, category, and location

All notes are automatically saved and persist across sessions!

