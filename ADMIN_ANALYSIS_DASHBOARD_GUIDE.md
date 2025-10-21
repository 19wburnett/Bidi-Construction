# Admin Analysis Dashboard Guide

## Overview

The admin analysis dashboard allows you to manually review construction plans and provide takeoff and quality analyses with visual markers that users can see on their plans.

## Setup

### 1. Database Migration

First, run this SQL in your Supabase dashboard to extend the plan_drawings table:

```sql
ALTER TABLE plan_drawings 
ADD COLUMN IF NOT EXISTS note_data JSONB,
ADD COLUMN IF NOT EXISTS analysis_item_id TEXT,
ADD COLUMN IF NOT EXISTS analysis_type TEXT CHECK (analysis_type IN ('takeoff', 'quality', NULL));

CREATE INDEX IF NOT EXISTS idx_plan_drawings_analysis ON plan_drawings(analysis_item_id, analysis_type) 
WHERE analysis_item_id IS NOT NULL;
```

## Workflow

### Step 1: View Pending Plans

1. Navigate to `/admin/analyze-plans`
2. You'll see a table of all plans with their analysis status
3. Filter by:
   - **All Plans**: Shows everything
   - **Pending Only**: Shows plans waiting for analysis
   - **Completed Only**: Shows finished analyses
4. Search by plan name, project name, or user email

### Step 2: Analyze a Plan

1. Click **Analyze** button or click the row
2. Opens the analysis page with:
   - **Left side**: Full PDF viewer with zoom/pan controls
   - **Right side**: Analysis panel with Takeoff and Quality tabs

### Step 3: Add Takeoff Items

1. Switch to **Takeoff** tab
2. Fill in the form:
   - **Item Name**: e.g., "Foundation Slab"
   - **Category**: Select from dropdown (Concrete, Framing, etc.)
   - **Quantity**: Enter number
   - **Unit**: Select unit (sq ft, linear ft, etc.)
   - **Unit Cost**: Optional pricing
   - **Notes**: Optional additional details
3. **Place Marker** (optional but recommended):
   - Click "Place Marker on Plan" button
   - Click on the PDF where this item is located
   - A blue numbered pin appears at that location
4. Click **Add Item**
5. Item appears in the list below with its marker number

### Step 4: Add Quality Issues

1. Switch to **Quality** tab
2. Fill in the form:
   - **Severity**: Critical, Warning, or Info
   - **Category**: Dimensions, Annotations, etc.
   - **Description**: Describe the issue
   - **Location**: Optional text location (e.g., "Floor 2, Room A")
   - **Recommendation**: Optional suggested fix
3. **Place Marker** (optional):
   - Click "Place Marker on Plan"
   - Click on the PDF where the issue is
   - An orange numbered pin appears
4. Click **Add Issue**

### Step 5: Edit or Delete Items

- Click **Edit** icon on any item to modify it
- Click **Delete** icon to remove it (removes marker too)
- Click on an item card to highlight its marker on the plan

### Step 6: Save or Submit

Two buttons at the bottom:

**Save Draft**:
- Saves your progress to the database
- Status stays "pending"
- You can come back later to continue
- No email sent

**Submit & Notify User**:
- Finalizes the analysis
- Updates status to "completed"
- Sends email to the user
- User can now view results
- Returns you to the plans list

## User Experience

When you submit an analysis, the user:

1. Receives an email: "Your [Takeoff Analysis/Quality Check] is Ready!"
2. Clicks the link in the email
3. Opens their plan in the plan viewer
4. Sees analysis results in the sidebar
5. Sees numbered markers on the PDF:
   - **Blue pins (#1, #2, ...)**: Takeoff items
   - **Orange pins (#1, #2, ...)**: Quality issues
6. Can click markers or items to see what each refers to
7. Markers are read-only (users cannot delete them)

## Database Structure

### Finding Pending Plans

```sql
SELECT 
  p.id,
  p.title,
  p.file_name,
  p.takeoff_requested_at,
  p.quality_requested_at,
  u.email
FROM plans p
JOIN auth.users u ON p.user_id = u.id
WHERE p.takeoff_analysis_status = 'pending'
   OR p.quality_analysis_status = 'pending'
ORDER BY p.takeoff_requested_at ASC NULLS LAST;
```

### Analysis Results Structure

**Takeoff Analysis** (`plan_takeoff_analysis` table):
```json
{
  "items": [
    {
      "id": "item-123",
      "name": "Foundation Slab",
      "category": "Concrete",
      "quantity": 1200,
      "unit": "sq ft",
      "unit_cost": 6.50,
      "notes": "4-inch slab with rebar",
      "marker": { "x": 150, "y": 200, "page": 1 }
    }
  ],
  "summary": {
    "total_items": 5,
    "categories": ["Concrete", "Framing"],
    "total_cost": 12500.00
  }
}
```

**Quality Analysis** (`plan_quality_analysis` table):
```json
{
  "overall_score": 0.85,
  "issues": [
    {
      "id": "issue-456",
      "severity": "warning",
      "category": "Dimensions",
      "description": "Missing room dimensions on 2nd floor",
      "location": "Sheet 3",
      "recommendation": "Add dimensions to all rooms",
      "marker": { "x": 300, "y": 150, "page": 3 }
    }
  ],
  "recommendations": ["Add scale legend", "Include electrical schedule"]
}
```

### Markers Structure

Markers are stored in `plan_drawings` table:
```json
{
  "id": "marker-xyz",
  "plan_id": "plan-123",
  "page_number": 1,
  "drawing_type": "note",
  "geometry": { "x1": 150, "y1": 200, "isRelative": false },
  "style": { "color": "#3b82f6", "strokeWidth": 3, "opacity": 1 },
  "analysis_item_id": "item-123",
  "analysis_type": "takeoff"
}
```

## Tips

- **Be specific**: Provide detailed descriptions and accurate quantities
- **Use markers**: They help users understand exactly where you're referring to
- **Save frequently**: Use "Save Draft" to avoid losing work
- **Review before submitting**: Once submitted, the user is notified immediately
- **Editing later**: You can reopen and edit analyses before submitting

## Email Notification

Users receive a branded email with:
- Subject: "[Takeoff Analysis/Quality Check] Complete: [Plan Name]"
- Summary of what was analyzed
- Direct link to view results
- Sent from: notifications@bidicontracting.com

Make sure `RESEND_API_KEY` is set in your environment variables.


