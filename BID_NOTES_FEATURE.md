# Plan & Bid Notes Feature

This feature adds intelligent note categorization and pattern recognition to the bid management system.

## Features Implemented

### 1. Database Schema
- **`bid_notes` table**: Stores categorized notes extracted from bid emails
- **Fields**: note_type, category, location, content, confidence_score
- **Types**: requirement, concern, suggestion, timeline, material, other

### 2. AI-Powered Note Extraction
- **Enhanced email processing**: Automatically extracts and categorizes notes from bid emails
- **Smart categorization**: Groups notes by type (requirement, concern, etc.) and category (shower, electrical, etc.)
- **Location awareness**: Identifies specific locations mentioned in notes
- **Confidence scoring**: AI provides confidence scores for extracted notes

### 3. Visual Note Display
- **Categorized notes**: Each bid now shows categorized notes with visual indicators
- **Color-coded badges**: Different colors for different note types and categories
- **Confidence indicators**: Shows AI confidence in note extraction
- **Location tags**: Displays specific locations mentioned in notes

### 4. Pattern Recognition
- **Cross-bid analysis**: Identifies recurring themes across multiple bids
- **Smart grouping**: Groups similar notes from different contractors
- **Pattern summary**: Shows which requirements/concerns are mentioned by multiple contractors
- **Contractor attribution**: Shows which contractors mentioned each pattern

### 5. Email Draft Generation
- **Pre-filled templates**: Generates email drafts with project summary and key findings
- **Organized content**: Groups requirements, concerns, and suggestions by category
- **Bid summary**: Includes all bid amounts and timelines
- **Copy functionality**: Allows copying email content to clipboard

## Usage

### For General Contractors
1. **View categorized notes**: Each bid card now shows extracted notes organized by type
2. **Identify patterns**: The pattern summary shows common themes across all bids
3. **Generate emails**: Use the "Email Draft" button to create pre-filled emails for architects
4. **Copy content**: Use "Copy Text" to copy email content to clipboard

### For the System
1. **Automatic processing**: New bid emails are automatically processed for note extraction
2. **Database storage**: Notes are stored in the `bid_notes` table with full categorization
3. **Pattern analysis**: The system automatically identifies recurring themes

## Database Migration

Run the following SQL to add the required tables:

```sql
-- See supabase-migration-bid-notes.sql for the complete migration
```

## Components Added

- `components/bid-notes-display.tsx`: Displays categorized notes for individual bids
- `components/pattern-summary.tsx`: Shows pattern analysis across all bids
- `components/email-draft-button.tsx`: Generates email drafts with project information

## API Changes

- Enhanced `app/api/resend/webhook/route.ts` to extract and store categorized notes
- Added `extractCategorizedNotes()` function for AI-powered note extraction

## Future Enhancements

- Plan annotation interface for marking up PDFs
- Export functionality for annotated plans
- Advanced filtering and search for notes
- Integration with project management tools
