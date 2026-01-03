# How to Test SMS in Telnyx Dashboard

## Quick Test: Send SMS from Dashboard

The easiest way to test if your phone number works is to send a test SMS directly from the Telnyx dashboard:

### Step 1: Go to Messaging
1. Log into Telnyx Dashboard: https://portal.telnyx.com
2. Click **Messaging** in the left sidebar
3. Click **Send SMS** (or look for "Send Message" / "Compose")

### Step 2: Send Test Message
1. **From**: Select your phone number `+13854061109` (or it should auto-select)
2. **To**: Enter your test phone number (e.g., `+13856084437`)
3. **Message**: Type a test message like "Test from Telnyx"
4. Click **Send**

### Step 3: Check Results
- If it works: You'll see a success message and the SMS will be delivered
- If you get an error: Check what the error says (might be the same 10039 error)

**Note:** If sending from the dashboard works but the API doesn't, it's likely an API key permissions issue. If both fail with 10039, you need to verify the destination number first.

---

## Verify Destination Numbers (Required for Error 10039)

If you're getting error 10039, you need to verify destination numbers before sending:

### Step 1: Go to Verify Numbers
1. Log into Telnyx Dashboard: https://portal.telnyx.com
2. Click **Numbers** in the left sidebar
3. Click **Verify Numbers** (or go to: https://portal.telnyx.com/#/app/numbers/verify)

### Step 2: Add Number to Verify
1. Click **"Add Number"** or **"Verify Number"** button
2. Enter the destination phone number (e.g., `+13856084437`)
3. Click **Verify** or **Submit**

### Step 3: Complete Verification
- Telnyx will send a verification code to that number
- Enter the code when prompted
- Once verified, you can send SMS to that number

### Step 4: Test After Verification
1. Go back to **Messaging** → **Send SMS**
2. Try sending to the verified number
3. It should work now!

---

## Alternative: Use Telnyx API Explorer

You can also test the API directly in Telnyx's API documentation:

1. Go to: https://developers.telnyx.com/docs/api/v2/messaging
2. Find the "Send a message" endpoint
3. Use the API explorer to test with your credentials
4. This helps verify if it's a code issue or account restriction

---

## Quick Links

- **Send SMS**: https://portal.telnyx.com/#/app/messaging/send
- **Verify Numbers**: https://portal.telnyx.com/#/app/numbers/verify
- **My Numbers**: https://portal.telnyx.com/#/app/numbers/my-numbers
- **API Logs**: https://portal.telnyx.com/#/app/activity/api-logs (to see what's happening)

---

## Testing Checklist

Before testing in your app:

- [ ] Test sending SMS from Telnyx dashboard (Messaging → Send SMS)
- [ ] If dashboard works, API should work too (check API key permissions)
- [ ] If you get 10039 error, verify the destination number first
- [ ] Check API logs in Telnyx dashboard to see detailed error messages
- [ ] Test with a verified number to confirm everything works

---

## Your Current Setup

- **Source Number**: `+13854061109` ✅
- **Messaging Profile**: `40019b7c-364b-40c8-b18a-a557bc9b52d2` ✅
- **Test Destination**: `+13856084437` (needs verification if getting 10039 error)

---

## Troubleshooting

### "Can't find Send SMS option"
- Look for "Messaging" → "Compose" or "New Message"
- Some accounts have it under "Messaging" → "Messages" → "Send"

### "Number not found in Verify Numbers"
- Make sure you're in the right section: Numbers → Verify Numbers
- Some accounts might have this under "Numbers" → "Verified Numbers"

### "Verification code not received"
- Check the phone number format (should be E.164: `+1234567890`)
- Make sure the number can receive SMS
- Check spam/junk folder

### "Dashboard works but API doesn't"
- Check API key permissions
- Verify `TELNYX_API_KEY` is set correctly
- Check API logs in Telnyx dashboard
