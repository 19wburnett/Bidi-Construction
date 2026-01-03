# How to Enable Messaging on Your Telnyx Phone Number

## Quick Fix for "Invalid messaging source number" Error

If you're seeing error code `40013` (Invalid messaging source number), your phone number needs to be enabled for messaging in Telnyx.

## Step-by-Step Instructions

### 1. Log into Telnyx Dashboard
Go to: https://portal.telnyx.com

### 2. Navigate to Your Phone Number
1. Click on **Numbers** in the left sidebar
2. Click on **My Numbers**
3. Find your phone number: `+13854061109` (or search for it)

### 3. Enable Messaging
1. Click on your phone number to open its details
2. Look for a section called **"Messaging"** or **"Features"**
3. If you see a toggle or button that says:
   - **"Enable Messaging"** → Click it
   - **"SMS Enabled"** → Make sure it's turned ON
   - **"Messaging Profile"** → Assign a messaging profile

### 4. Assign a Messaging Profile (if required)
1. In the number details, look for **"Messaging Profile"**
2. If it says "None" or is empty:
   - Click **"Assign Messaging Profile"** or **"Change"**
   - Select an existing messaging profile, or
   - Create a new messaging profile:
     - Go to **Messaging** → **Messaging Profiles**
     - Click **"Create Messaging Profile"**
     - Give it a name (e.g., "Bidi SMS")
     - Save it
     - Then assign it to your phone number

### 5. Verify Number Status
Make sure your number shows:
- ✅ **Status**: Active
- ✅ **Messaging**: Enabled
- ✅ **Messaging Profile**: Assigned (not "None")

### 6. Test the Configuration
After enabling messaging:
1. Restart your server (to reload environment variables)
2. Try sending an SMS again
3. Check the logs - you should see the normalized phone number being used

## Alternative: Enable via API

If you prefer to enable messaging programmatically, you can use the Telnyx API:

```bash
# Get your phone number ID first
curl -X GET "https://api.telnyx.com/v2/phone_numbers" \
  -H "Authorization: Bearer YOUR_TELNYX_API_KEY"

# Then enable messaging (replace PHONE_NUMBER_ID and MESSAGING_PROFILE_ID)
curl -X PATCH "https://api.telnyx.com/v2/phone_numbers/PHONE_NUMBER_ID" \
  -H "Authorization: Bearer YOUR_TELNYX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_profile_id": "MESSAGING_PROFILE_ID"
  }'
```

## Common Issues

### Issue: "Enable Messaging" button is grayed out
**Solution:** 
- The number may need verification first
- Check for any pending verification requests
- Some numbers require additional setup

### Issue: No messaging profile available
**Solution:**
1. Go to **Messaging** → **Messaging Profiles**
2. Create a new messaging profile
3. Assign it to your phone number

### Issue: Number shows as "Not eligible for messaging"
**Solution:**
- Some number types (like landlines) cannot send SMS
- Verify you have a mobile or SMS-capable number
- Contact Telnyx support if unsure

## Verification Checklist

Before trying to send SMS, verify:
- [ ] Phone number is in your Telnyx account
- [ ] Number status is "Active"
- [ ] Messaging is enabled
- [ ] A messaging profile is assigned
- [ ] `TELNYX_PHONE_NUMBER` in `.env` matches the number (with or without dashes - both work)
- [ ] `TELNYX_API_KEY` is set correctly
- [ ] Server has been restarted after setting environment variables

## Still Not Working?

1. **Check Telnyx Activity Logs:**
   - Go to **Activity** → **API Logs**
   - Look for recent API calls
   - Check for any error messages

2. **Test in Telnyx Dashboard:**
   - Go to **Messaging** → **Send SMS**
   - Try sending a test message from your number
   - If it works there but not via API, check API key permissions

3. **Contact Telnyx Support:**
   - If the number appears correctly configured but still fails
   - They can verify the number's messaging status
   - Support: https://support.telnyx.com

## Your Current Configuration

Based on your `.env` file:
```
TELNYX_PHONE_NUMBER=+1-385-406-1109
```

This will be normalized to: `+13854061109` (dashes are automatically removed)

Make sure this exact number (`+13854061109`) is:
1. In your Telnyx account
2. Enabled for messaging
3. Has a messaging profile assigned
