# Bid Package Email System - Complete Implementation Plan

## Overview
Build out complete email functionality for bid packages with all enhancements: send emails via Resend with plan PDF attachments, track all email statuses, process inbound responses with attachments, display everything in modals, and include 10 advanced features for a comprehensive email management system.

## Core Database Schema Changes

### 1. Create `bid_package_recipients` table
Track individual email sends, statuses, and responses:
- `id` (UUID, primary key)
- `bid_package_id` (UUID, FK to bid_packages)
- `subcontractor_id` (UUID, FK to subcontractors, nullable)
- `subcontractor_email` (TEXT, required)
- `subcontractor_name` (TEXT)
- `resend_email_id` (TEXT, Resend email ID for tracking)
- `status` (TEXT: 'pending', 'sent', 'delivered', 'opened', 'bounced', 'failed', 'responded')
- `sent_at` (TIMESTAMPTZ)
- `delivered_at` (TIMESTAMPTZ, nullable)
- `opened_at` (TIMESTAMPTZ, nullable)
- `bounced_at` (TIMESTAMPTZ, nullable)
- `responded_at` (TIMESTAMPTZ, nullable)
- `response_text` (TEXT, nullable - stores response content)
- `has_clarifying_questions` (BOOLEAN, default false - flagged by AI)
- `clarifying_questions` (TEXT[], nullable - extracted questions)
- `bid_id` (UUID, FK to bids, nullable - links to bid if they submitted one)
- `reminder_count` (INTEGER, default 0)
- `last_reminder_sent_at` (TIMESTAMPTZ, nullable)
- `reminder_schedule` (JSONB, nullable) - stores reminder days [3, 7, 14]
- `thread_id` (TEXT, nullable) - groups related emails
- `parent_email_id` (UUID, FK to bid_package_recipients, nullable) - for threading
- `created_at` (TIMESTAMPTZ)

### 2. Create `bid_attachments` table
Store file attachments from subcontractor email replies:
- `id` (UUID, primary key)
- `bid_id` (UUID, FK to bids)
- `file_name` (TEXT)
- `file_path` (TEXT, storage path)
- `file_size` (BIGINT)
- `file_type` (TEXT, MIME type)
- `created_at` (TIMESTAMPTZ)

### 3. Create `email_templates` table
User-customizable email templates:
- `id` (UUID, primary key)
- `user_id` (UUID, FK to users)
- `template_name` (TEXT)
- `template_type` (TEXT: 'bid_package', 'reminder', 'response')
- `subject` (TEXT)
- `html_body` (TEXT)
- `text_body` (TEXT, nullable)
- `variables` (JSONB) - available variables like {jobName}, {tradeCategory}, etc.
- `is_default` (BOOLEAN, default false)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 4. Create `quick_reply_templates` table
Quick reply templates for common responses:
- `id` (UUID, primary key)
- `user_id` (UUID, FK to users)
- `name` (TEXT) - e.g., "Deadline Extension", "Plan Update"
- `subject` (TEXT)
- `body` (TEXT)
- `created_at` (TIMESTAMPTZ)

### 5. Create `email_threads` table
Group related emails in conversation:
- `id` (UUID, primary key)
- `bid_package_id` (UUID, FK to bid_packages)
- `subcontractor_email` (TEXT)
- `thread_id` (TEXT, unique)
- `created_at` (TIMESTAMPTZ)

### 6. Update `bid_packages` table
Add fields for enhanced features:
- `auto_reminder_enabled` (BOOLEAN, default true)
- `reminder_schedule` (JSONB, default [3, 7, 14]) - days after send to remind
- `auto_close_enabled` (BOOLEAN, default true)
- `final_reminder_sent` (BOOLEAN, default false)
- `template_id` (UUID, FK to email_templates, nullable)

### 7. Update `notifications` table
Extend to support bid package events:
- `notification_type` (TEXT: 'bid_received', 'email_opened', 'clarifying_question', 'email_bounced')
- `bid_package_id` (UUID, FK to bid_packages, nullable)
- `recipient_id` (UUID, FK to bid_package_recipients, nullable)

### 8. Create storage bucket
- `bid-attachments` bucket in Supabase storage with RLS policies

## Core API Endpoints

### 1. `/app/api/bid-packages/send/route.ts`
Send bid package emails via Resend:
- Accepts: `bidPackageId`, `subcontractorIds[]`, `planId`, `templateId` (optional)
- Downloads plan PDF from Supabase storage
- If file size > 25MB: generate secure signed URL instead
- Uses custom template if provided, else default
- Creates email template with variables replaced
- Reply-to: `bids+{bidPackageId}@bidicontracting.com`
- Sends emails via Resend
- Creates `bid_package_recipients` records
- Updates `bid_packages.status` to 'sent'
- Returns email IDs for tracking

### 2. `/app/api/resend/webhook/route.ts` (Updated)
Handle both inbound emails and outbound status events:
- **Inbound emails** (`email.received`):
  - Extract `bid_package_id` from reply-to address
  - Process attachments (save to storage, create `bid_attachments` records)
  - Extract bid data using AI
  - Detect clarifying questions using AI
  - Create `bid` record if bid submitted
  - Update `bid_package_recipients` with response info
  - Create notifications for events
- **Outbound events** (`email.sent`, `email.delivered`, `email.opened`, `email.bounced`):
  - Update `bid_package_recipients` status
  - Update timestamps
  - Create notifications for opens/bounces

### 3. `/app/api/bid-packages/[id]/recipients/route.ts`
GET endpoint to fetch recipients and their email statuses for a bid package

### 4. `/app/api/bid-packages/[id]/bids/route.ts`
GET endpoint to fetch all bids for a bid package

### 5. `/app/api/jobs/[jobId]/email-statuses/route.ts`
GET endpoint to fetch all email statuses for all bid packages in a job

### 6. `/app/api/bid-packages/[id]/respond/route.ts`
POST endpoint for responding to clarifying questions:
- Accepts: `recipientId`, `responseText`, `quick_reply_id` (optional)
- Sends response email via Resend
- Updates `bid_package_recipients` record
- Tracks response thread

## Enhanced Feature API Endpoints

### 7. `/app/api/bid-packages/test-email/route.ts`
Send test email to authenticated user:
- Accepts: `bidPackageId`, `planId`, `templateId` (optional)
- Generates email exactly as it would be sent
- Sends to user's email address

### 8. `/app/api/email-templates/route.ts`
CRUD operations for email templates:
- GET: List user's templates
- POST: Create new template
- PUT: Update template
- DELETE: Delete template

### 9. `/app/api/quick-replies/route.ts`
CRUD operations for quick reply templates:
- GET: List user's quick replies
- POST: Create quick reply
- PUT: Update quick reply
- DELETE: Delete quick reply

### 10. `/app/api/bid-packages/send-reminder/route.ts`
Send reminder emails:
- Accepts: `recipientId` or `bidPackageId` (for bulk)
- Checks if reminder is due based on schedule
- Sends reminder email
- Updates reminder tracking fields
- Prevents sending if already responded

### 11. `/app/api/cron/check-reminders/route.ts`
Background job for automatic reminders and auto-close:
- Runs daily (via Vercel Cron or external service)
- Finds recipients due for reminder
- Sends reminders automatically
- Checks for packages with deadline in 24 hours → send final reminder
- Checks for packages past deadline → auto-close
- Sends summary email to GC

### 12. `/app/api/bid-packages/[id]/bulk-actions/route.ts`
Bulk operations:
- POST with action: 'resend', 'remind', 'mark_read', 'mark_unread', 'export_csv'
- Accepts: `recipientIds[]` or `all: true`
- Handles bulk operations efficiently

### 13. `/app/api/bid-packages/[id]/analytics/route.ts`
Email analytics for a bid package:
- Returns: open_rate, response_rate, avg_response_time, total_sent, total_opened, total_responded

### 14. `/app/api/jobs/[jobId]/email-analytics/route.ts`
Email analytics across all bid packages in job:
- Returns analytics across all packages
- Best performing trade categories
- Overall metrics

### 15. `/app/api/bid-packages/[id]/threads/[threadId]/route.ts`
Get email thread:
- GET: Returns all emails in thread (chronological)
- Shows full conversation history

### 16. `/app/api/bid-packages/[id]/suggestions/route.ts`
AI-powered smart suggestions:
- Uses AI to analyze bid package status
- Returns actionable suggestions
- Analyzes historical data for patterns

## Component Updates

### 1. Update `components/bid-package-modal.tsx`
- **Step 1**: Add reminder settings, auto-close toggle, template selector
- **Step 3**: Replace console.log with actual send API call, add "Send Test Email" button
- **Step 4**: Add email status display, clarifying questions panel, quick reply selector, bulk actions, analytics tab, smart suggestions panel

### 2. Update `components/bid-comparison-modal.tsx`
- Add email status loading from `/api/jobs/[jobId]/email-statuses`
- Display email status badges/icons next to each bid
- Show clarifying questions indicators
- Add filter/sort by email status
- Show response previews
- Add "View Thread" button

### 3. Create `components/email-template-editor.tsx`
Rich text editor for HTML body:
- Variable picker/insertion
- Preview mode
- Save as template

### 4. Create `components/email-thread-viewer.tsx`
Shows all emails sent/received in chronological order:
- Email content, attachments, timestamps
- Easy context when responding

### 5. Create `components/email-analytics-panel.tsx`
Show metrics cards:
- Open rate, response rate, etc.
- Charts/graphs for trends
- Best performing trades

### 6. Update notification system
- Update `components/notification-bell.tsx` to show bid package notifications
- Add notification badge in plan viewer when bids arrive
- Click notification → navigate to bid package/bid

## Implementation Phases

### Phase 1: Core Email Functionality
1. Create database migrations for core tables
2. Create storage bucket and policies
3. Implement send email API endpoint
4. Update Resend webhook handler
5. Create recipient/bids API endpoints
6. Update bid package modal UI
7. Update bid comparison modal
8. Update notification system

### Phase 2: Enhanced Features (Priority)
9. Create database migrations for enhanced features
10. Implement test email functionality
11. Implement email template system
12. Implement quick reply templates
13. Implement automatic reminders
14. Implement bulk actions

### Phase 3: Advanced Features
15. Implement auto-close after deadline
16. Implement email analytics
17. Implement email thread view
18. Implement smart suggestions

### Phase 4: Testing & Polish
19. Test all core functionality
20. Test all enhanced features
21. End-to-end workflow testing
22. Performance optimization
23. Documentation

## Key Features Summary

✅ PDF attachments (< 25MB) or secure links (>= 25MB)
✅ Complete email status tracking (sent, delivered, opened, bounced, responded)
✅ Clarifying questions detection and flagging
✅ Response system with quick replies
✅ Email status display in bids view
✅ Real-time notifications
✅ Test email before sending
✅ Customizable email templates
✅ Automatic follow-up reminders
✅ Bulk actions (resend, remind, export)
✅ Auto-close after deadline
✅ Email analytics dashboard
✅ Email thread view
✅ AI-powered smart suggestions



