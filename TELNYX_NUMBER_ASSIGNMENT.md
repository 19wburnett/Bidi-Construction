# Assign Phone Number to Messaging Profile

## The Problem

You're seeing the "Invalid messaging source number" error because your phone number (`+13854061109`) needs to be **assigned to a messaging profile** in Telnyx.

## Quick Fix Steps

### Step 1: Find Your Phone Number
1. In Telnyx dashboard, click **Numbers** (left sidebar)
2. Click **My Numbers**
3. Search for: `385-406-1109` or `+13854061109`
4. Click on the number to open its details

### Step 2: Check Messaging Profile Assignment
Look for a section that shows:
- **"Messaging Profile"** or
- **"Messaging Settings"** or
- **"SMS Settings"**

### Step 3: Assign the Profile
If it says **"None"** or is empty:
1. Click **"Assign Messaging Profile"** or **"Change"** button
2. Select the messaging profile you were just viewing (the one with the outbound settings)
3. Click **"Save"** or **"Assign"**

### Step 4: Verify
After assigning, the number should show:
- ✅ **Messaging Profile**: [Your Profile Name]
- ✅ **Status**: Active
- ✅ **Messaging**: Enabled

## Alternative: Assign via API

If you prefer to do this programmatically:

```bash
# First, get your phone number ID
curl -X GET "https://api.telnyx.com/v2/phone_numbers" \
  -H "Authorization: Bearer YOUR_TELNYX_API_KEY" \
  | grep -A 5 "13854061109"

# Then get your messaging profile ID (from the URL when viewing the profile)
# The profile ID is in the URL: https://portal.telnyx.com/#/app/messaging/profiles/[PROFILE_ID]

# Assign the profile to your number
curl -X PATCH "https://api.telnyx.com/v2/phone_numbers/[PHONE_NUMBER_ID]" \
  -H "Authorization: Bearer YOUR_TELNYX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_profile_id": "[MESSAGING_PROFILE_ID]"
  }'
```

## What You Should See

After assigning the messaging profile, when you view your phone number details, you should see:

```
Phone Number: +13854061109
Status: Active
Messaging Profile: [Your Profile Name] ← This should NOT be "None"
Messaging: Enabled
```

## Test After Assignment

1. Restart your server
2. Try sending an SMS again
3. Check the logs - you should see the phone number verification details

## Still Getting the Error?

If you've assigned the messaging profile but still get the error:

1. **Check the profile name** - Make sure you assigned the correct profile
2. **Wait a few minutes** - Changes can take a moment to propagate
3. **Check API logs** - Go to Activity → API Logs in Telnyx dashboard
4. **Verify the number format** - The code normalizes `+1-385-406-1109` to `+13854061109` automatically

## Your Current Setup

- **Phone Number**: `+1-385-406-1109` (normalized to `+13854061109`)
- **Messaging Profile**: Needs to be assigned
- **Outbound Settings**: Already configured (you just viewed them)

The missing piece is linking the number to the profile!
