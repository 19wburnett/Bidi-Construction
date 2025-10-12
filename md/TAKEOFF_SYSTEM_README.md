# AI-Powered Takeoff System

## Overview

This is a collaborative AI-powered construction takeoff system that automatically analyzes construction plans (PDFs, images) and extracts measurable quantities like walls, doors, windows, electrical outlets, and more. Users can edit quantities, costs, collaborate in real-time, and use an AI assistant to answer questions about their takeoffs.

## Features

### 🤖 AI-Powered Analysis
- **Automatic Detection**: Uses OpenAI's GPT-4 Vision to analyze plans and detect:
  - Structural elements (walls, floors, ceilings)
  - Electrical components (outlets, switches, fixtures)
  - Plumbing fixtures and pipes
  - HVAC systems
  - Finishes (drywall, paint, flooring)
  - Concrete elements
  - Doors and windows
- **Confidence Scoring**: Each detected item includes an AI confidence score
- **Smart Parsing**: Automatically converts AI responses into structured data

### 📊 Interactive Takeoff Table
- **Editable Items**: Add, edit, or delete items manually
- **Categorization**: Organize by trade (Electrical, Plumbing, HVAC, etc.)
- **Cost Tracking**: Unit costs and automatic total calculations
- **Search & Filter**: Quickly find specific items
- **Bulk Export**: Export to CSV for further analysis

### 🗺️ Visual PDF Viewer
- **Overlay Annotations**: See detected items directly on the plan
- **Interactive Highlights**: Click items to highlight their location
- **Zoom & Rotate**: Full control over plan viewing
- **Page Navigation**: Multi-page PDF support
- **Fullscreen Mode**: Focus on plan details

### 💬 AI Chat Assistant
- **Contextual Answers**: Ask questions about your takeoff data
- **Material Suggestions**: Get recommendations for missing items
- **Cost Analysis**: Calculate subtotals by category or trade
- **Historical Context**: Chat maintains conversation history

### 👥 Real-Time Collaboration
- **Live Presence**: See who's viewing the takeoff
- **Concurrent Editing**: Multiple users can edit simultaneously
- **Auto-Save**: Changes saved automatically
- **Conflict Resolution**: Supabase handles concurrent updates

### 📝 Version Control
- **Save Versions**: Create snapshots of your takeoff
- **Version History**: Track changes over time
- **Compare Versions**: (Future feature) Compare different versions
- **Rollback**: Restore previous versions if needed

## Architecture

### Database Schema

The system uses **Supabase** with the following main tables:

1. **`takeoffs`** - Main takeoff records
   - Links to projects and users
   - Stores AI analysis status and results
   - Tracks version numbers
   - Manages locking for concurrent editing

2. **`takeoff_items`** - Individual line items
   - Item type, category, description
   - Quantity, unit, costs
   - Detection metadata (AI coordinates, confidence)
   - Location references (page number, plan location)

3. **`takeoff_comments`** - Collaboration comments
   - General comments and questions
   - Item-specific discussions
   - Threaded replies support

4. **`takeoff_presence`** - Real-time presence tracking
   - Who's viewing the takeoff
   - Current view (PDF, table, chat)
   - Cursor position

5. **`cost_templates`** - Reusable pricing templates
   - Global system templates
   - User-specific templates
   - Organized by trade category

6. **`takeoff_ai_chat`** - Chat history
   - User and AI messages
   - References to specific items

### Tech Stack

- **Frontend**: React, Next.js 15, TypeScript
- **UI Components**: Shadcn UI [[memory:7850712]], Tailwind CSS [[memory:6860563]]
- **PDF Viewing**: react-pdf (pdfjs-dist)
- **Backend**: Next.js API Routes (serverless) [[memory:7420523]]
- **Database**: Supabase (PostgreSQL + Real-time)
- **AI**: OpenAI GPT-4 Vision API
- **File Storage**: Supabase Storage

## File Structure

```
app/
  api/
    takeoff/
      analyze/route.ts         # AI plan analysis endpoint
      chat/route.ts           # AI chat assistant endpoint
      create/route.ts         # Create/list takeoffs
  dashboard/
    takeoff/
      page.tsx                # List all takeoffs
      new/page.tsx            # Create new takeoff
      [id]/page.tsx           # Individual takeoff viewer

components/
  takeoff-viewer.tsx          # PDF viewer with overlays
  takeoff-sidebar.tsx         # Editable table + AI chat

lib/
  supabase.ts                 # Database types and client

supabase-migration-takeoffs.sql  # Database schema
```

## API Endpoints

### POST `/api/takeoff/create`
Create a new takeoff for a project.

**Body:**
```json
{
  "projectId": "uuid",
  "planFileUrl": "https://...",
  "name": "Electrical Takeoff - Floor 1",
  "autoAnalyze": true
}
```

**Response:**
```json
{
  "success": true,
  "takeoff": { /* takeoff object */ }
}
```

### GET `/api/takeoff/create?projectId=uuid`
List all takeoffs for a project (or all user's takeoffs).

### POST `/api/takeoff/analyze`
Run AI analysis on a plan file.

**Body:**
```json
{
  "planFileUrl": "https://...",
  "projectId": "uuid",
  "takeoffId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "item_type": "duplex_outlet",
      "category": "Electrical",
      "description": "Standard duplex outlet",
      "quantity": 12,
      "unit": "units",
      "confidence_score": 0.85,
      "location_reference": "Floor 1, Grid A-3"
    }
  ],
  "metadata": {
    "total_items": 45,
    "confidence_score": 0.78,
    "categories": ["Electrical", "Plumbing", "Structural"]
  }
}
```

### POST `/api/takeoff/chat`
Send a message to the AI assistant.

**Body:**
```json
{
  "takeoffId": "uuid",
  "message": "How many square feet of drywall?",
  "includeHistory": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Based on the takeoff data, you have approximately 2,450 square feet of drywall across all rooms...",
  "context": {
    "items_referenced": 8,
    "categories": ["Finishes"]
  }
}
```

### GET `/api/takeoff/chat?takeoffId=uuid`
Retrieve chat history for a takeoff.

## Setup Instructions

### 1. Database Migration

Run the migration script in your Supabase SQL editor:

```bash
# Copy contents of supabase-migration-takeoffs.sql
# Paste into Supabase SQL Editor and run
```

This creates:
- All required tables
- Indexes for performance
- Row Level Security policies
- Triggers for auto-updating timestamps
- Default cost templates

### 2. Environment Variables

Ensure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### 3. PDF Worker Setup

The PDF viewer requires a worker file. Ensure you have:

```
public/
  pdf.worker.min.js  # Downloaded from pdfjs-dist
```

Or set up the worker dynamically in the component.

### 4. Storage Bucket

Ensure your Supabase storage bucket allows:
- Public read access for plan files
- Authenticated write access for uploads

## Usage Guide

### Creating a Takeoff

1. Navigate to `/dashboard/takeoff/new`
2. Select a project with plan files
3. Choose a specific plan file
4. Name your takeoff
5. Toggle "Run AI Analysis" if desired
6. Click "Create Takeoff"

### Viewing a Takeoff

The takeoff page has three main areas:

1. **PDF Viewer (Left 2/3)**
   - View the plan with zoom, rotation controls
   - See AI-detected items highlighted as overlays
   - Click highlights to select items
   - Toggle overlays on/off

2. **Sidebar (Right 1/3)**
   - **Items Tab**: 
     - View all detected/manual items
     - Edit quantities, costs, descriptions
     - Add new items manually
     - Delete items
     - Search and filter
   - **Chat Tab**:
     - Ask AI questions
     - Get cost breakdowns
     - Identify missing materials

3. **Header**
   - Save versions
   - Run/re-run AI analysis
   - Share with team
   - Archive takeoff

### Using the AI Chat

Example questions:
- "How many square feet of drywall are on this floor plan?"
- "What's the total cost for electrical work?"
- "Am I missing any common materials for a kitchen renovation?"
- "What's the breakdown by category?"
- "How many outlets are in the living room?"

### Collaboration

- Multiple users can view and edit the same takeoff simultaneously
- Live presence indicators show who's viewing
- Changes auto-save and sync in real-time
- Comments can be added to specific items (future enhancement)

### Version Control

1. Click "Save Version" in the header
2. Enter a version name
3. The system creates a snapshot of:
   - Current takeoff data
   - All items and their values
   - Metadata

To restore a version (future feature):
1. View version history
2. Select a previous version
3. Click "Restore"

## AI Analysis Details

### How It Works

1. **Plan Upload**: User uploads a plan PDF/image to Supabase Storage
2. **Trigger Analysis**: User creates takeoff with "Auto Analyze" enabled
3. **Vision API Call**: System sends plan to OpenAI GPT-4 Vision
4. **Structured Extraction**: AI returns JSON array of detected items
5. **Data Validation**: System validates and normalizes the response
6. **Database Insert**: Items are inserted into `takeoff_items`
7. **User Review**: User can review, edit, or delete AI-detected items

### AI Prompt Engineering

The system uses a detailed system prompt that:
- Specifies exactly what to look for (7 categories of items)
- Defines the required output structure
- Requests confidence scores
- Asks for location references
- Emphasizes accuracy and completeness

### Confidence Scoring

Each AI-detected item includes a confidence score (0.0 to 1.0):
- **0.9-1.0**: Very confident
- **0.7-0.9**: Confident
- **0.5-0.7**: Moderate confidence (review recommended)
- **0.0-0.5**: Low confidence (likely needs correction)

Users can see which items are AI-detected with the "AI" badge.

## Cost Templates

The system includes pre-populated cost templates for common trades:

- **Framing**: Wall framing, ceiling joists, floor joists
- **Electrical**: Outlets, switches, fixtures, panels
- **Drywall**: Installation, finishing, texture
- **Concrete**: Slabs, footings, walls
- **Plumbing**: Water/drain lines, toilet/sink installation

### Using Templates

1. Navigate to the sidebar
2. Add a new item manually
3. Select a category (e.g., "Electrical")
4. The system suggests common items with preset costs
5. Adjust quantities and costs as needed

## Real-Time Collaboration

### How It Works

- Uses Supabase Real-time subscriptions
- Listens for changes on `takeoff_items` and `takeoffs` tables
- Updates UI automatically when others make changes
- Presence tracking via `takeoff_presence` table

### Presence Indicators

- Shows avatar initials of active users
- Displays "N users viewing" in the PDF viewer
- Updates every 10 seconds
- Users are considered "active" if seen in last 30 seconds

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Items load on demand
2. **Pagination**: Large takeoffs paginate item lists
3. **Debounced Search**: Search input is debounced
4. **Optimistic Updates**: UI updates before server confirms
5. **Real-time Throttling**: Presence updates limited to 10s intervals

### Scaling

- API routes are serverless (Vercel-compatible) [[memory:7420523]]
- Database queries use indexes
- Real-time channels scoped to specific takeoffs
- AI analysis runs asynchronously

## Future Enhancements

### Planned Features

1. **Export Options**
   - Export to Excel with formatting
   - Generate PDF reports
   - Integration with accounting software

2. **Advanced Collaboration**
   - @mentions in comments
   - Task assignments
   - Approval workflows

3. **Enhanced AI**
   - Multi-page plan analysis
   - Dimension extraction from plans
   - Material supplier integration

4. **Mobile App**
   - Field takeoff capture
   - Voice-to-text item entry
   - Camera-based plan upload

5. **Version Comparison**
   - Visual diff between versions
   - Track who changed what
   - Audit trail

## Troubleshooting

### AI Analysis Fails

**Issue**: Analysis status shows "failed"

**Solutions**:
1. Check OpenAI API key is valid
2. Verify plan file URL is accessible
3. Check plan file format (PDF, JPG, PNG)
4. Review API error logs in Vercel/console
5. Ensure plan file is under 20MB

### Items Not Showing Overlays

**Issue**: AI-detected items don't show on PDF

**Solutions**:
1. Ensure `detection_coordinates` field has data
2. Check if overlays are toggled on (eye icon)
3. Verify coordinates are normalized (0-1 range)
4. Ensure `plan_page_number` matches current page

### Real-Time Updates Not Working

**Issue**: Changes from other users not appearing

**Solutions**:
1. Check Supabase real-time is enabled
2. Verify RLS policies allow SELECT access
3. Check browser console for connection errors
4. Ensure subscription channel is active
5. Try refreshing the page

### Chat Assistant Not Responding

**Issue**: AI chat returns errors

**Solutions**:
1. Verify OpenAI API key and quota
2. Check takeoff has items to reference
3. Ensure chat history isn't too long (20 msg limit)
4. Review API error logs

## Support

For issues or questions:
1. Check this README
2. Review database logs in Supabase
3. Check API logs in Vercel
4. Review browser console for errors
5. Contact the development team

## License

This system is part of the Bidi Construction platform and is proprietary software.

