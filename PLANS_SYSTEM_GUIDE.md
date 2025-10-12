# Plans System - Complete Implementation Guide

## Overview

The application has been restructured to focus on a **plans-first workflow** with a Figma-like drawing tool and dual-mode AI analysis. The old takeoffs system has been replaced with a comprehensive plan management and analysis system.

## Key Changes

### 1. Navigation Updates

- ✅ **"Takeoffs" renamed to "Plans"** in the sidebar
- ✅ **Plans is now the primary feature** (positioned first after Dashboard)
- ✅ Quick actions updated: "Upload Plan" is now the primary action
- ✅ Dashboard restructured to show overview stats instead of just jobs

### 2. Database Schema

**New Tables Created** (see `supabase-migration-plans-system.sql`):

- **`plans`** - Stores uploaded plan files with metadata
- **`plan_drawings`** - Stores Figma-like drawing annotations
- **`plan_takeoff_analysis`** - AI-generated takeoff analysis results
- **`plan_quality_analysis`** - AI-generated quality/completeness analysis
- **`plan_scale_settings`** - Scale calibration for accurate measurements
- **`plan_comments`** - Comments and collaboration features

**Storage Bucket**:
- `plans` bucket created for file storage

### 3. New Pages & Routes

#### Dashboard (`/dashboard`)
- **Custom overview page** with stats cards
- Recent plans and recent jobs sections
- Quick actions for uploading plans and posting jobs
- No longer just displays the jobs list

#### Plans Listing (`/dashboard/plans`)
- Grid view of all user plans
- Search functionality
- Plan cards showing:
  - Title and project info
  - Status badges
  - Analysis completion indicators (Takeoff, Quality)
  - Number of pages
  - Upload date
- Delete functionality

#### Upload Plan (`/dashboard/plans/new`)
- **File upload interface** for PDFs, PNGs, JPEGs
- File validation (type, size max 50MB)
- Form fields:
  - Title (required)
  - Description
  - Project Name
  - Project Location
- Auto-populates title from filename
- Redirects to plan editor after upload

#### Plan Editor (`/dashboard/plans/[id]`)
The main feature - a comprehensive plan editor with drawing tools and AI analysis.

**Layout**:
- Top toolbar: Back button, plan title, zoom controls
- Left toolbar: Drawing tools (Select, Line, Rectangle, Measurement, Scale settings)
- Main canvas: PDF viewer with drawing overlay
- Right sidebar: Dual-mode analysis (Takeoff / Quality)
- Bottom toolbar: Page navigation (for multi-page PDFs)

**Drawing Tools**:
- **Select Tool**: Navigate and select existing drawings
- **Line Tool**: Draw straight lines
- **Rectangle Tool**: Draw rectangular areas
- **Measurement Tool**: Draw lines with scale-based measurements
- **Scale Settings**: Calibrate the scale for accurate measurements

**Drawing Features**:
- Real-time drawing on PDF overlay
- Drawings saved to database automatically
- Zoom in/out controls
- Multi-page support with page navigation
- All drawings persist across sessions

**Analysis Sidebar** (Dual Mode):

1. **Takeoff Analysis Mode**
   - AI-powered quantity takeoff
   - Extracts:
     - Materials with quantities
     - Labor items
     - Square footage/area calculations
     - Linear measurements
     - Cost estimates
   - Uses OpenAI Vision API (gpt-4o)
   - Results saved to `plan_takeoff_analysis` table
   - Can reference user-drawn measurements

2. **Quality Analysis Mode**
   - AI-powered plan quality assessment
   - Evaluates:
     - Clarity & Readability
     - Completeness
     - Detail Level
     - Standards Compliance
   - Identifies:
     - Missing details
     - Unclear specifications
     - Potential issues
     - Recommendations
   - Categorizes findings by severity (critical, warning, info)
   - Provides overall quality score (0-100%)
   - Uses OpenAI Vision API (gpt-4o)
   - Results saved to `plan_quality_analysis` table

### 4. API Endpoints

#### `/api/plan/analyze-takeoff` (POST)
- Analyzes uploaded plan for quantity takeoff
- Input: `{ planId, planUrl, drawings }`
- Returns: Structured takeoff data with items, quantities, costs
- Saves results to database

#### `/api/plan/analyze-quality` (POST)
- Analyzes uploaded plan for quality and completeness
- Input: `{ planId, planUrl }`
- Returns: Quality score, issues, missing details, recommendations
- Categorizes findings by severity and category
- Saves results to database

## Workflow

### User Journey

1. **Dashboard**: User sees overview of their plans and jobs
2. **Upload Plan**: User clicks "Upload Plan" and uploads a PDF/image
3. **Plan Editor Opens**: After upload, user is taken to the full-screen editor
4. **Draw on Plan**: User can draw measurements, mark areas, add annotations
5. **Run Analysis**: User switches between Takeoff and Quality analysis modes:
   - **Takeoff**: Get quantities, materials, costs
   - **Quality**: Check for missing details, unclear specs
6. **View Results**: AI analysis results display in the right sidebar
7. **Save & Return**: All work auto-saves, user can return anytime from Plans list

### Plans-First Philosophy

The system is now designed for users to:
1. Start by uploading construction plans
2. Analyze and annotate the plans
3. THEN create job requests based on the analyzed plans (future feature)

This is the opposite of the old flow where job requests came first.

## Technical Details

### PDF Rendering
- Uses `react-pdf` library
- Worker configured at `/pdf.worker.min.js`
- Supports multi-page PDFs
- Zoom range: 50% to 300%
- Text layer disabled for performance
- Annotation layer disabled

### Drawing Implementation
- Canvas overlay on top of PDF
- Drawings stored as JSON geometry objects
- Coordinates are percentage-based for scalability
- Style properties: color, strokeWidth, opacity
- Drawing types: line, rectangle, circle, measurement

### Scale Calibration
- Users can set scale ratio (e.g., "1/4\" = 1'")
- Calculates pixels per unit for measurements
- Calibration line reference points stored
- Per-page scale settings supported

### AI Analysis
- Uses OpenAI GPT-4o with Vision
- Processes plan images/PDFs
- Structured JSON responses
- Confidence scores provided
- Results cached in database
- Versioning supported

### Real-time Features (Planned)
- Tables are set up for collaboration
- `plan_comments` supports threaded discussions
- Presence tracking can be added
- Real-time updates via Supabase subscriptions

## Installation Steps

1. **Run Database Migration**:
   ```bash
   # Copy the SQL from supabase-migration-plans-system.sql
   # Run it in your Supabase SQL Editor
   ```

2. **Verify Storage Bucket**:
   - Ensure `plans` bucket exists in Supabase Storage
   - Check RLS policies are in place

3. **Environment Variables**:
   ```
   OPENAI_API_KEY=your_key_here
   ```

4. **Deploy**:
   ```bash
   npm run build
   npm start
   ```

## Files Changed

### New Files
- `app/dashboard/page.tsx` - New custom dashboard
- `app/dashboard/plans/page.tsx` - Plans listing
- `app/dashboard/plans/new/page.tsx` - Upload page
- `app/dashboard/plans/[id]/page.tsx` - Plan editor
- `app/api/plan/analyze-takeoff/route.ts` - Takeoff API
- `app/api/plan/analyze-quality/route.ts` - Quality API
- `supabase-migration-plans-system.sql` - Database schema

### Modified Files
- `components/dashboard-sidebar.tsx` - Updated navigation
- `components/dashboard-layout.tsx` - Removed top navbar

### Removed References
- Old takeoffs system removed from navigation
- `activeTakeoffs` stat changed to `activePlans`
- Old takeoff tables dropped in migration

## Features Summary

✅ **Upload Plans**: PDF, PNG, JPEG support (max 50MB)
✅ **View Plans**: Grid view with search and filtering
✅ **Edit Plans**: Full-screen editor with drawing tools
✅ **Draw on Plans**: Lines, rectangles, measurements
✅ **Scale Calibration**: Set scale for accurate measurements
✅ **Takeoff Analysis**: AI-powered quantity takeoff
✅ **Quality Analysis**: AI-powered completeness check
✅ **Multi-page Support**: Navigate through PDF pages
✅ **Zoom Controls**: 50% to 300% zoom
✅ **Auto-save**: All drawings and analyses auto-save
✅ **Organized Storage**: User-specific file organization

## Next Steps & Future Enhancements

### Immediate Priorities
1. Test upload flow with various PDF sizes
2. Test drawing tools on different browsers
3. Verify AI analysis results quality
4. Add loading states and error handling

### Future Features
- Export annotated PDFs with drawings
- Share plans with team members
- Real-time collaboration (multiple users)
- More drawing tools (circle, polygon, text)
- Layer management (show/hide drawings)
- Drawing colors and styles customization
- Measurement totals and summary
- Link plans to job requests
- Version history for plans
- Compare plan versions
- Template libraries for common measurements

## Troubleshooting

### PDF Won't Load
- Check file size (max 50MB)
- Verify signed URL generation
- Check browser console for errors
- Ensure `/pdf.worker.min.js` exists in public folder

### Drawings Not Saving
- Check Supabase RLS policies
- Verify user authentication
- Check browser console for API errors

### AI Analysis Failing
- Verify OpenAI API key is set
- Check API quota/billing
- Review API error messages
- Ensure plan URL is accessible

### Storage Issues
- Verify `plans` bucket exists
- Check RLS policies on storage
- Confirm user has upload permissions

## Summary

The Plans system is now the centerpiece of the application, providing a comprehensive tool for construction plan management, annotation, and AI-powered analysis. Users can upload plans, draw measurements, and get instant AI feedback on quantities and quality - all in one integrated workspace.

The system is built to scale with features like real-time collaboration, version control, and advanced drawing tools ready to be implemented as needed.

