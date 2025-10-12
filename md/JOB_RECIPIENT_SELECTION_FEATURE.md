# Job Recipient Selection Feature

This feature allows General Contractors (GCs) to control who receives their bid requests when posting a new job. They can choose to send requests to:
- All their personal contacts
- All Bidi network subcontractors
- Both their contacts and the Bidi network (default)
- **Select specific subcontractors** from BOTH networks (new modal-based approach)

The feature includes a beautiful modal interface that allows GCs to browse and select specific subcontractors from both their personal contacts and the Bidi network, viewing detailed profile cards for each.

## Features

### 1. Recipient Type Selection
GCs can select one of four recipient types when posting a job:

- **All My Contacts & Bidi Network** (Recommended): Sends to all matching contacts in both networks
- **All My Contacts Only**: Sends only to all matching GC's imported personal contacts
- **All Bidi Network Only**: Sends only to all matching Bidi network subcontractors
- **Select Specific Subcontractors**: Opens a modal to hand-pick individual subcontractors from both networks

### 2. Subcontractor Selection Modal (New!)
When "Select Specific Subcontractors" is chosen:
- A beautiful modal opens showing profile cards for all available subcontractors
- **Two Tabs**: Switch between "My Contacts" and "Bidi Network"
- **Profile Cards**: Each subcontractor is displayed as a detailed card showing:
  - Name and company
  - Email address
  - Phone number (if available)
  - Location
  - Notes (for personal contacts)
  - Badge indicating source (My Contact vs Bidi Network)
- **Interactive Selection**: Click any card to select/deselect that subcontractor
- **Search**: Real-time search across name, email, company, and location
- **Bulk Actions**: "Select All" / "Deselect All" buttons for each tab
- **Selection Summary**: Shows total selected count and breakdown by source
- All matching subcontractors are selected by default for convenience

### 3. Smart Email Distribution
The email sending logic intelligently handles different recipient types:
- **All types**: Fetch all matching subcontractors from the appropriate tables
- **Selected type**: Fetch only the specifically selected emails from both sources
- Fetch GC contacts from the `gc_contacts` table when needed
- Fetch Bidi network subcontractors from the `subcontractors` table when needed
- Remove duplicate recipients (if someone appears in both lists)
- Send emails only to the final filtered list

## Database Changes

### Migration Required
Run the migration file: `supabase-migration-job-recipient-preferences.sql`

This adds three new columns to the `job_requests` table:
- `recipient_type`: TEXT field with CHECK constraint ('contacts_only', 'network_only', 'both', 'selected')
  - Default: 'both'
  - New 'selected' option for manual subcontractor selection
- `selected_network_subcontractors`: TEXT[] array
  - Stores email addresses of selected Bidi network subcontractors
  - Used when recipient_type is 'selected'
- `selected_contact_subcontractors`: TEXT[] array
  - Stores email addresses of selected personal contacts
  - Used when recipient_type is 'selected'

### TypeScript Types
The Database types in `lib/supabase.ts` have been updated to include these new fields.

## User Interface

### New Job Page (`app/dashboard/new-job/page.tsx`)
Added UI components for:

1. **Recipient Type Selector**
   - Radio buttons to choose between: all contacts, all network, both, or select specific
   - Clear explanation of what each option does
   - New "Select Specific Subcontractors" option with hand icon
   - Styled with Tailwind CSS for consistency [[memory:6860563]]

2. **Subcontractor Selection Button & Summary**
   - Appears only when "Select Specific" is chosen
   - Button opens the selection modal
   - Shows count of selected subcontractors
   - Displays breakdown: X from contacts, Y from network
   - Green checkmark when subcontractors are selected
   - Requires trade category and location to be filled first

### Subcontractor Selection Modal (`components/subcontractor-selection-modal.tsx`)
A new reusable modal component featuring:

1. **Tab-Based Interface**
   - "My Contacts" tab with count badge
   - "Bidi Network" tab with count badge
   - Clean, modern design using shadcn Dialog component [[memory:7850712]]

2. **Profile Cards**
   - Large, clickable cards with visual feedback
   - Blue border and background when selected
   - Checkmark icon in top-right when selected
   - All contact details displayed beautifully
   - Badge showing source (My Contact vs Bidi Network)

3. **Search & Filter**
   - Real-time search bar
   - Searches across name, email, company, and location
   - Instant results as you type

4. **Bulk Selection**
   - "Select All" / "Deselect All" per tab
   - Smart button label based on current state

5. **Footer Actions**
   - Selection summary showing total and breakdown
   - Cancel and Confirm buttons
   - Confirm disabled when no subcontractors selected

## API Changes

### `/api/send-job-emails` Endpoint
Updated to respect recipient preferences with conditional logic:

**For 'selected' recipient type:**
1. Fetches only the specified GC contacts by email (from `selected_contact_subcontractors`)
2. Fetches only the specified Bidi network subs by email (from `selected_network_subcontractors`)
3. No filtering by trade category or location (already filtered during selection)

**For other recipient types ('contacts_only', 'network_only', 'both'):**
1. Fetches all matching GC contacts by trade category and location
2. Fetches all matching Bidi network subs by trade category and location
3. Respects the recipient type to determine which sources to use

**All types:**
- Removes duplicate recipients (same email in both lists)
- Sends emails to the final unique list
- Returns success/failure counts

## Usage Flow

1. **GC starts creating a new job**
   - Fills in trade category, location, description, and budget range

2. **GC selects recipient type**
   - Chooses one of four options:
     - All contacts & network (send to everyone)
     - All contacts only (send to all my contacts)
     - All network only (send to all Bidi network)
     - **Select specific** (hand-pick individuals)

3. **If "Select Specific" is chosen:**
   - GC clicks "Select Subcontractors" button
   - Beautiful modal opens with profile cards
   - GC switches between "My Contacts" and "Bidi Network" tabs
   - GC clicks profile cards to select/deselect individuals
   - GC can search to find specific people
   - GC uses "Select All" / "Deselect All" for convenience
   - All subcontractors are selected by default
   - GC clicks "Confirm Selection"
   - Modal closes, showing summary (e.g., "12 Subcontractors Selected")

4. **GC submits the job**
   - Job request is created with recipient preferences stored
   - Emails are sent only to selected recipients
   - System handles duplicate removal automatically

## Benefits

- **Maximum Control**: GCs can choose exactly who receives their bid requests, down to the individual
- **Beautiful UX**: Modern modal interface with profile cards makes selection intuitive and enjoyable
- **Unified Selection**: Select from both personal contacts and Bidi network in one interface
- **Network Flexibility**: GCs can leverage Bidi's network while maintaining full control
- **Contact Privacy**: GCs who prefer to work only with known contacts can do so
- **Targeted Distribution**: GCs can hand-pick specific subcontractors based on relationship, past performance, or project needs
- **Cost Efficiency**: Prevents sending unnecessary emails to subcontractors who aren't a good fit
- **Time Savings**: Search and bulk select features make it quick to manage large lists

## Future Enhancements

Potential improvements for future versions:
- **Save Selection Templates**: Save common subcontractor groups for reuse
- **Favorite Subcontractors**: Star favorite subs for quick filtering
- **Rating & History**: Show past bid performance and ratings in profile cards
- **Block List**: Allow GCs to permanently block specific subcontractors
- **Advanced Filters**: Filter by distance, rating, certifications, insurance status
- **Bulk Import**: Import subcontractor lists from CSV
- **Analytics**: Show which recipient types and individuals yield best response rates
- **Invite to Network**: Allow GCs to invite their contacts to join Bidi network
- **Groups**: Organize contacts into custom groups (e.g., "Preferred Electricians")
- **Notes & Tags**: Add private notes and tags to subcontractors for better organization
