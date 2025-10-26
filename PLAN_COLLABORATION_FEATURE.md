# Plan Collaboration Feature

## Overview
The Plan Collaboration feature allows users to share construction plans with external collaborators (subcontractors, consultants, clients, etc.) via secure, shareable links. Guests can view plans and add comments/drawings without requiring a Bidi account.

## Features

### 1. **Shareable Links**
- Generate unique, secure links for any plan
- Configurable expiration (7 days, 30 days, never, etc.)
- Control permissions (allow comments, allow drawings)
- Track link access (view count, last accessed)
- Deactivate links at any time

### 2. **Guest User System**
- Guests enter their name on first visit
- Session saved via cookies (7 days)
- Optional email for notifications
- All comments/drawings tied to guest name
- No account creation required

### 3. **Real-time Collaboration**
- Guests can add comments on specific plan locations
- Support for multiple comment types:
  - 📝 Note - General observations
  - ❓ Question - Questions that need answers
  - ⚠️ Concern - Issues or problems
  - 💡 Suggestion - Improvement ideas
  - 🎨 Highlight - Important areas
- View all comments from all collaborators
- See who made each comment and when

### 4. **Cookie-based Session Management**
- Guest sessions persist for 7 days
- No re-entering name on return visits
- Secure, HTTP-only cookies
- Automatic session cleanup

## User Guide

### For Plan Owners (Generating Links)

1. **Navigate to Plans Page** (`/dashboard/plans`)
2. **Click "Share" button** on any plan card
3. **Configure share settings:**
   - Set expiration period (0 = never expires)
   - Enable/disable comments
   - Enable/disable drawings
4. **Click "Generate Share Link"**
5. **Copy the link** and share it with collaborators
6. The link format: `https://your-domain.com/share/abc123...`

### For Guests (Accessing Shared Plans)

1. **Click the shared link** sent by the plan owner
2. **Enter your name** (and optional email)
3. **View the plan** and existing comments
4. **Add comments:**
   - Click anywhere on the plan
   - Select comment type
   - Enter your comment
   - Click "Save Comment"
5. **Your comments appear** with your name attached

## Technical Architecture

### Database Schema

#### New Tables

**guest_users**
```sql
- id: UUID (primary key)
- session_token: TEXT (unique)
- guest_name: TEXT
- email: TEXT (optional)
- created_at: TIMESTAMP
- last_seen_at: TIMESTAMP
```

**plan_shares**
```sql
- id: UUID (primary key)
- plan_id: UUID (foreign key → plans)
- share_token: TEXT (unique, 32 characters)
- created_by: UUID (foreign key → users)
- expires_at: TIMESTAMP (nullable)
- allow_comments: BOOLEAN
- allow_drawings: BOOLEAN
- is_active: BOOLEAN
- access_count: INTEGER
- last_accessed_at: TIMESTAMP
```

#### Updated Tables

**plan_annotations** (added guest support)
- Added `guest_user_id` column (foreign key → guest_users)
- Constraint: Either `created_by` OR `guest_user_id` must be set

**plan_annotation_responses** (added guest support)
- Added `guest_user_id` column (foreign key → guest_users)
- Constraint: Either `created_by` OR `guest_user_id` must be set

**plan_drawings** (added guest support)
- Added `guest_user_id` column (foreign key → guest_users)
- Constraint: Either `user_id` OR `guest_user_id` must be set

### API Routes

#### `POST /api/plan/share`
Create a new shareable link for a plan.

**Request:**
```json
{
  "planId": "uuid",
  "expiresInDays": 7,
  "allowComments": true,
  "allowDrawings": true
}
```

**Response:**
```json
{
  "success": true,
  "shareUrl": "https://domain.com/share/abc123...",
  "token": "abc123...",
  "expiresAt": "2024-10-28T00:00:00Z"
}
```

#### `GET /api/plan/share/[token]`
Validate a share token and get plan information.

**Response:**
```json
{
  "valid": true,
  "plan": {
    "id": "uuid",
    "title": "Construction Plan",
    "fileName": "plan.pdf",
    "fileUrl": "https://..."
  },
  "permissions": {
    "allowComments": true,
    "allowDrawings": true
  },
  "ownerName": "owner@email.com"
}
```

#### `POST /api/plan/share/guest-session`
Create or validate a guest user session.

**Request:**
```json
{
  "guestName": "John Doe",
  "email": "john@example.com",
  "sessionToken": "guest_123..." // Optional, for validation
}
```

**Response:**
```json
{
  "success": true,
  "guestUser": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "sessionToken": "guest_123..."
  }
}
```

### Frontend Components

#### `/app/share/[token]/page.tsx`
Public page for viewing shared plans.
- Validates share token
- Manages guest session
- Shows name entry form for first-time visitors
- Renders plan annotator for authenticated guests

#### `/components/guest-plan-annotator.tsx`
Main annotation component for guests.
- Full-page PDF viewer with zoom controls
- Click-to-comment functionality
- Real-time annotation display
- Comment panel with filters
- Read-only mode if comments disabled

#### `/app/dashboard/plans/page.tsx` (updated)
Plans list page with share functionality.
- Added "Share" button to each plan card
- Share modal with configuration options
- Link generation and copying
- Display of share permissions

### Row Level Security (RLS) Policies

#### Guest Access Policies
- Guests can view annotations on shared plans
- Guests can create annotations if permissions allow
- Guests can update/delete their own annotations
- Plan owners can view all annotations on their plans

#### Share Link Policies
- Users can only create shares for their own plans
- Users can view/update/delete their own shares
- Share validation bypasses auth for public access

## Security Considerations

### 1. **Token Generation**
- 32-character random tokens
- Cryptographically secure generation
- Unique constraint enforced at database level

### 2. **Session Management**
- HTTP-only cookies prevent XSS
- Secure flag in production
- 7-day expiration
- SameSite=Lax for CSRF protection

### 3. **Access Control**
- Share links can be deactivated instantly
- Expiration dates enforced
- Access tracking for audit trail
- RLS policies prevent unauthorized access

### 4. **Guest User Isolation**
- Guests can only access shared plans
- Cannot view other users' data
- Cannot modify plan files
- Limited to permitted actions (comments/drawings)

## Usage Metrics

Track the following for each share link:
- **access_count**: Total number of times link was accessed
- **last_accessed_at**: Most recent access timestamp
- Query guest_users table to see unique collaborators
- Query plan_annotations to see collaboration activity

## Migration Instructions

### 1. **Run Database Migration**
```bash
# Apply the migration
psql -U postgres -d your_db -f supabase/migrations/20241021_plan_collaboration.sql
```

### 2. **Verify Tables Created**
```sql
-- Check new tables
SELECT * FROM guest_users LIMIT 1;
SELECT * FROM plan_shares LIMIT 1;

-- Check updated columns
\d plan_annotations
\d plan_annotation_responses
\d plan_drawings
```

### 3. **Test the Feature**
1. Upload a plan
2. Click "Share" button
3. Generate a link
4. Open link in incognito window
5. Enter guest name
6. Add a comment
7. Verify comment appears with guest name

## Environment Variables

Ensure these are set:
```env
NEXT_PUBLIC_BASE_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Future Enhancements

### Planned Features
1. **Drawing Tools** - Allow guests to draw on plans
2. **Real-time Updates** - Use Supabase Realtime for live collaboration
3. **Email Notifications** - Notify users of new comments
4. **Comment Threads** - Reply to specific comments
5. **File Attachments** - Attach images to comments
6. **Version History** - Track changes over time
7. **Mobile App Support** - Native mobile experience
8. **Offline Mode** - Work offline, sync later
9. **Export Comments** - Download all comments as PDF
10. **Analytics Dashboard** - View collaboration metrics

### Nice-to-Have
- Bulk share generation
- Share link templates
- Custom branding for shared pages
- QR code generation for links
- Comment moderation tools
- Guest user management dashboard

## Troubleshooting

### Common Issues

**Issue: "Link Not Available" error**
- Check if link has expired
- Verify link is still active (is_active = true)
- Ensure plan still exists

**Issue: Guest session not persisting**
- Check cookie settings in browser
- Verify cookies are enabled
- Check if in private/incognito mode

**Issue: Comments not saving**
- Verify allowComments permission is enabled
- Check RLS policies are correct
- Ensure guest_user_id is being set

**Issue: Cannot generate share link**
- Verify user owns the plan
- Check plan ID is valid
- Review API error logs

## Files Modified/Created

### New Files
- `supabase/migrations/20241021_plan_collaboration.sql` - Database migration
- `app/api/plan/share/route.ts` - Share link management API
- `app/api/plan/share/[token]/route.ts` - Share validation API
- `app/api/plan/share/guest-session/route.ts` - Guest session API
- `app/share/[token]/page.tsx` - Public share page
- `components/guest-plan-annotator.tsx` - Guest annotation component
- `PLAN_COLLABORATION_FEATURE.md` - This documentation

### Modified Files
- `app/dashboard/plans/page.tsx` - Added share button and modal
- `lib/supabase.ts` - Updated TypeScript types

## Support

For questions or issues:
1. Check this documentation
2. Review database logs
3. Check browser console for errors
4. Contact development team

## License

Part of Bidi Construction platform.





