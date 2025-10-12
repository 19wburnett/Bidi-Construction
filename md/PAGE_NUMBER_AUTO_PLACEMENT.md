# Page Number Auto-Placement Feature

This feature allows subcontractors to specify page numbers in their bid notes, enabling automatic placement on the corresponding plan pages. General contractors can then fine-tune the exact position.

## Features Implemented

### 1. Database Schema Update
- **New field**: `page_number` (INTEGER, nullable) added to `bid_notes` table
- **Index**: Created for better query performance
- **Migration file**: `supabase-migration-add-page-number.sql`

### 2. Auto-Placement Logic
- **Automatic placement**: When the Plan Annotator Modal opens, notes with `page_number` specified are automatically placed on the corresponding page
- **Default position**: Notes are placed at 20% from left, 50% from top (center-left of page)
- **Validation**: Page numbers are validated against the actual number of pages in the PDF
- **Works for both**: Bidder notes and custom notes

### 3. User Interface Enhancements

#### Custom Note Form
- **Page # field**: Added optional page number input in the custom note creation form
- **Grid layout**: Location and Page # fields are side-by-side for better space usage
- **Validation**: Real-time validation with min/max constraints based on PDF page count
- **Placeholder**: Shows valid range (e.g., "1-5" for a 5-page document)

#### Visual Indicators
- **Page badges**: Notes with page numbers display a blue badge showing "Page X"
- **Consistent styling**: Badge appears before category and location badges
- **Both sections**: Visible in both "Your Notes" and bidder notes sections

### 4. Workflow

#### For Subcontractors (Future Enhancement)
When submitting bids via email, subcontractors can include page references in their notes:
```
"Concern about electrical panel placement on page 3"
"Timeline issue with HVAC installation shown on page 2"
```

The AI can extract these page numbers and populate the `page_number` field.

#### For General Contractors
1. **Open Plan Annotator**: Notes with page numbers are automatically placed
2. **Review placement**: Check if the auto-placed notes are in the right area
3. **Fine-tune position**: Drag notes to the exact location on the plan
4. **Add custom notes**: Can specify page numbers for their own notes
5. **Download**: Annotated PDF includes all notes in their final positions

### 5. Technical Details

#### Auto-Placement Trigger
```typescript
useEffect(() => {
  if (!open || !numPages || placedNotes.length > 0) return
  // Auto-place notes with page_number specified
}, [open, numPages, bids, customNotes])
```

#### Page Number Validation
- Must be an integer
- Must be between 1 and the total number of pages
- Invalid page numbers show an error message

#### Custom Note Creation
- If page number is specified, note is immediately placed on that page
- If no page number, note remains in the panel for manual drag-and-drop

## Benefits

### For Subcontractors
- **Precise communication**: Can reference specific plan pages in their notes
- **Less ambiguity**: Clear indication of which page their concern/suggestion applies to
- **Better documentation**: Page references are preserved in the system

### For General Contractors
- **Time savings**: Notes are pre-placed on the correct pages
- **Better organization**: Easy to see which notes apply to which pages
- **Flexibility**: Can still adjust exact positions as needed
- **Clear overview**: Page badges make it easy to scan notes by page

## Future Enhancements

### AI Page Number Extraction
Enhance the email parsing AI to automatically extract page numbers from bid content:
- "on page 3" → `page_number: 3`
- "see page 2" → `page_number: 2`
- "pages 4-5" → Multiple notes with respective page numbers

### Smart Positioning
Instead of always placing at 20%, 50%, use AI to:
- Analyze the note content
- Identify the relevant area on the page
- Place the note near the referenced element

### Multi-Page Notes
Support notes that span multiple pages:
- `page_range: [2, 3, 4]`
- Place the same note on multiple pages
- Link them visually

## Usage Example

### Creating a Custom Note with Page Number
1. Click "Add Note" in the Plan Annotator
2. Fill in note details
3. Enter page number (e.g., "3")
4. Click "Create Note"
5. Note is automatically placed on page 3
6. Drag to fine-tune position if needed

### Working with Auto-Placed Bidder Notes
1. Open Plan Annotator Modal
2. Notes with page numbers are already on the plans
3. Scroll through pages to review all auto-placed notes
4. Drag notes to adjust their exact positions
5. Add additional notes as needed
6. Download annotated PDF with all notes
