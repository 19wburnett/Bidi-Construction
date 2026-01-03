# Telnyx Phone Number Setup Guide

## Error: Invalid Messaging Source Number

If you're seeing the error:
```
Invalid messaging source number: The source phone number was deemed invalid by the carrier.
```

This means your `TELNYX_PHONE_NUMBER` environment variable needs to be configured correctly.

## Steps to Fix

### 1. Get Your Telnyx Phone Number

1. Log into Telnyx dashboard: https://portal.telnyx.com
2. Go to **Numbers** → **My Numbers**
3. Find a phone number that is:
   - ✅ **Active** (not suspended)
   - ✅ **Enabled for messaging** (SMS enabled)
   - ✅ **Verified** (if verification is required)

### 2. Check Number Format

The phone number **must** be in **E.164 format**:
- ✅ Correct: `+1234567890` (US number with country code)
- ✅ Correct: `+442071234567` (UK number)
- ❌ Wrong: `1234567890` (missing +)
- ❌ Wrong: `(123) 456-7890` (contains formatting)
- ❌ Wrong: `1-234-567-8900` (contains dashes)

### 3. Enable Messaging on Your Number

1. In Telnyx dashboard, go to **Numbers** → **My Numbers**
2. Click on your phone number
3. Ensure **Messaging** is enabled
4. If you see "Enable Messaging" or similar, click it
5. Complete any required verification steps

### 4. Set Environment Variable

Add to your `.env` file:

```bash
TELNYX_PHONE_NUMBER=+1234567890
```

**Important:**
- Use the **exact** phone number from Telnyx dashboard
- Include the `+` prefix
- Include the country code (e.g., `+1` for US)
- No spaces, dashes, or parentheses

### 5. Verify Number in Telnyx Dashboard

1. Go to **Numbers** → **My Numbers**
2. Click on your number
3. Check:
   - Status: **Active**
   - Messaging: **Enabled**
   - Features: Should show SMS/MMS capabilities

### 6. Test the Configuration

After setting the environment variable:

1. Restart your development server (if running locally)
2. Try sending an SMS again
3. Check the logs for the normalized phone number format

## Common Issues

### Issue: Number shows as "Not enabled for messaging"
**Solution:** Enable messaging in Telnyx dashboard → Numbers → Your Number → Enable Messaging

### Issue: Number format error
**Solution:** Ensure the number is in E.164 format: `+[country code][number]`
- US: `+1234567890`
- UK: `+442071234567`
- Canada: `+14161234567`

### Issue: Number not found in Telnyx
**Solution:** 
- Verify you're using the correct Telnyx account
- Check that the number is in your account's number list
- Ensure you purchased/ported the number correctly

### Issue: "Number not verified"
**Solution:**
- Complete any verification steps in Telnyx dashboard
- Some numbers require verification before messaging can be enabled
- Check for any pending verification requests

## Testing

You can test your phone number configuration by:

1. Checking the environment variable is loaded:
   ```bash
   # In your terminal
   echo $TELNYX_PHONE_NUMBER
   ```

2. Verifying the format in logs:
   - When sending SMS, check server logs
   - Look for: `📱 [sendTelnyxSMS] Sending SMS: { from: '+1234567890', ... }`
   - The `from` number should be in E.164 format

3. Testing in Telnyx dashboard:
   - Go to **Messaging** → **Send SMS**
   - Try sending a test message from your number
   - If it works there, it should work via API

## Still Having Issues?

1. **Check Telnyx API logs:**
   - Go to Telnyx dashboard → **Activity** → **API Logs**
   - Look for recent API calls and error messages

2. **Verify API key:**
   - Ensure `TELNYX_API_KEY` is set correctly
   - Check that the API key has messaging permissions

3. **Contact Telnyx Support:**
   - If the number appears correct but still fails
   - Telnyx support can verify number status and configuration

## Example .env Configuration

```bash
# Telnyx Configuration
TELNYX_API_KEY=KEYxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELNYX_PHONE_NUMBER=+1234567890
TELNYX_PUBLIC_KEY=your_public_key_here  # Optional: for webhook signature verification
```

Make sure there are no quotes around the values unless your environment requires them.
