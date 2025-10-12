# Admin Demo Setup Instructions

This guide will help you set up admin accounts with demo mode for showcasing the Bidi platform.

## What is Demo Mode?

When demo mode is enabled for an admin account:
- Job requests automatically generate 2-4 realistic demo bids
- Bids appear with staggered timing (0-30 seconds + staggered)
- Bid amounts adjust based on the selected budget range
- Demo data includes realistic company names, contact info, and project details
- No actual emails are sent to subcontractors

## Setup Steps

### 1. Run Database Migration

First, run the database migration to add admin fields:

```sql
-- Run this in your Supabase SQL editor
-- Copy and paste the contents of supabase-migration-add-admin-flag.sql
```

### 2. Set Up Admin Account

#### Option A: Using the Setup Script (Recommended)

1. Install dependencies if not already done:
   ```bash
   npm install @supabase/supabase-js
   ```

2. Set your environment variables:
   ```bash
   export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

3. Run the setup script:
   ```bash
   node setup-admin.js your-email@example.com
   ```

#### Option B: Manual Database Update

Run this SQL in your Supabase SQL editor:

```sql
-- Replace 'your-email@example.com' with the actual email
UPDATE users 
SET is_admin = TRUE, 
    role = 'admin',
    demo_mode = TRUE
WHERE email = 'your-email@example.com';
```

### 3. Verify Setup

1. Log in with your admin account
2. You should see an "Admin" link in the navbar
3. Click on "Admin" to access the demo settings page
4. Verify that demo mode is enabled (it should be by default)

## Using Demo Mode

### For Demos

1. **Enable Demo Mode**: Go to Admin → Demo Settings and ensure demo mode is ON
2. **Create Job Requests**: Post new jobs as normal through the dashboard
3. **Watch Bids Appear**: Demo bids will automatically generate and appear over time
4. **Show Realistic Data**: Bids include company names, contact info, pricing, and timelines

### Demo Features

- **Automatic Bid Generation**: 2-4 bids per job request
- **Staggered Timing**: Bids appear over 0-30 seconds to simulate real responses
- **Budget-Aware Pricing**: Bid amounts adjust based on your selected budget range
- **Trade-Specific Content**: Different demo data for each trade category
- **Realistic Details**: Company names, phone numbers, project notes, and timelines

### Trade Categories with Demo Data

- Electrical
- Plumbing  
- HVAC
- Roofing
- Painting
- Drywall

## Managing Demo Mode

### Toggle Demo Mode
- Go to Admin → Demo Settings
- Use the toggle switch to enable/disable demo mode
- Changes take effect immediately

### Set Additional Admins
- Use the "Set User as Admin" tool in the admin settings
- Or run the setup script for other email addresses

## Troubleshooting

### Demo Bids Not Appearing
1. Check that the user is marked as admin (`is_admin = TRUE`)
2. Check that demo mode is enabled (`demo_mode = TRUE`)
3. Verify the job request was created successfully
4. Check browser console for any error messages

### Admin Link Not Showing
1. Verify the user has `is_admin = TRUE` in the database
2. Try logging out and back in
3. Check that the database migration was run successfully

### Database Issues
1. Ensure all migration files have been run
2. Check that the `users` table has the new columns:
   - `is_admin` (boolean)
   - `demo_mode` (boolean)
   - `role` should accept 'admin' as a value

## Demo Tips

1. **Create Multiple Jobs**: Show different trade categories to demonstrate variety
2. **Use Different Budget Ranges**: Show how bid amounts adjust accordingly
3. **Show the Timeline**: Let attendees see bids appearing over time
4. **Explain the Real Process**: Mention that in production, real contractors would receive emails

## Security Notes

- Admin accounts have elevated privileges
- Demo mode only affects job creation, not existing functionality
- Regular users are not affected by demo mode
- Admin settings are only visible to admin users

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify database permissions and RLS policies
3. Ensure all environment variables are set correctly
4. Check that the Supabase service role key has proper permissions


