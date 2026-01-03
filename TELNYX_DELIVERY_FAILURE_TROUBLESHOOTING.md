# Telnyx SMS Delivery Failure Troubleshooting

## Problem: Message Shows "Sent" but Not Delivered

If your SMS shows as "sent" in your app and Telnyx, but you never receive it on your phone, this is a **delivery failure**. Here's how to diagnose and fix it.

## Step 1: Check Telnyx Dashboard for Details

1. **Go to Telnyx Dashboard:**
   - Navigate to **Activity** → **API Logs** or **Messaging** → **Messages**
   - Find the message that failed
   - Click on it to see detailed error information

2. **Look for Error Details:**
   - **Error Code**: What specific error code is shown?
   - **Error Message**: What does it say?
   - **Carrier**: What carrier is the destination number on?
   - **Line Type**: Is it Wireless, Landline, VoIP, etc.?

## Common Delivery Failure Reasons

### 1. Landline Number (Most Common)
**Error**: "Invalid destination" or "Cannot deliver to landline"

**Problem**: You're trying to send SMS to a landline phone number, which cannot receive text messages.

**Solution**: 
- Verify the phone number is a mobile number
- Check the line type in Telnyx dashboard
- Use a mobile phone number instead

### 2. Invalid Phone Number Format
**Error**: "Invalid destination number"

**Problem**: The phone number format is incorrect or the number doesn't exist.

**Solution**:
- Verify the number is in E.164 format: `+1234567890`
- Check that the number is correct
- Test the number by calling it first

### 3. Carrier Blocking
**Error**: "Carrier rejected" or "Blocked by carrier"

**Problem**: The carrier (Verizon, AT&T, T-Mobile, etc.) is blocking the message.

**Possible Reasons**:
- The destination number has opted out of SMS
- The carrier has flagged your number as spam
- The destination number is on a "Do Not Text" list

**Solution**:
- Contact Telnyx support to check if your number is flagged
- Verify the destination number hasn't opted out
- Check carrier-specific requirements

### 4. Number Not in Service
**Error**: "Number not in service" or "Invalid destination"

**Problem**: The phone number is disconnected or not active.

**Solution**:
- Verify the number is still active
- Try calling the number to confirm it works
- Use a different, active phone number

### 5. International Number Restrictions
**Error**: "International delivery not allowed" or similar

**Problem**: Your account may not be configured for international messaging.

**Solution**:
- Check if the number is international
- Verify your Telnyx account allows international messaging
- Contact Telnyx support to enable international messaging

### 6. Rate Limiting / Throttling
**Error**: "Rate limit exceeded" or "Too many messages"

**Problem**: You're sending too many messages too quickly.

**Solution**:
- Wait a few minutes and try again
- Check your messaging profile rate limits
- Implement rate limiting in your code

## How to Check Delivery Status in Telnyx

### Method 1: Dashboard
1. Go to **Messaging** → **Messages**
2. Find your message
3. Check the status column
4. Click on the message for detailed information

### Method 2: API Logs
1. Go to **Activity** → **API Logs**
2. Filter by your phone number or message ID
3. Look for delivery status webhooks
4. Check error details

### Method 3: Webhook Logs
Check your application logs for webhook events:
- `message.delivery.failed` - Delivery failed
- `message.delivered` - Successfully delivered
- `message.sent` - Sent but not yet delivered

## Testing Steps

### 1. Verify Your Test Number
- Make sure you're using a **mobile phone number**
- Verify it's active and can receive SMS
- Test by sending yourself an SMS from another phone

### 2. Check Number Format
- Should be E.164: `+1234567890`
- No dashes, spaces, or parentheses
- Include country code (e.g., `+1` for US)

### 3. Test from Telnyx Dashboard
1. Go to **Messaging** → **Send SMS**
2. Send a test message to your number
3. If it fails in dashboard too, it's not a code issue
4. Check the error message for specific details

### 4. Check Carrier and Line Type
In Telnyx dashboard, when viewing the message details:
- **Carrier**: Should show a valid carrier (Verizon, AT&T, etc.)
- **Line Type**: Should be **"Wireless"** (not "Landline" or "VoIP")

If it shows "Landline" or "VoIP", that's why it's failing - those can't receive SMS.

## Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `10001` | Invalid destination | Check number format and validity |
| `10002` | Number not in service | Verify number is active |
| `10003` | Carrier rejected | Contact Telnyx support |
| `10004` | Rate limit exceeded | Wait and retry |
| `10005` | International not allowed | Enable international messaging |
| `10039` | Pre-verified destinations only | Verify number or upgrade account |

## Quick Fixes

### If it's a Landline:
- Use a mobile phone number for testing
- Verify the number type before sending

### If it's Invalid Format:
- Ensure E.164 format: `+1234567890`
- Remove all formatting (dashes, spaces, parentheses)

### If Carrier is Blocking:
- Contact Telnyx support
- Check if your number is flagged
- Verify destination hasn't opted out

### If Number Not in Service:
- Test the number by calling it
- Use a different, active number

## Debugging in Your App

The webhook handler now logs detailed error information. Check your server logs for:

```
❌ [telnyx-webhook] Message delivery failed: {
  messageId: "...",
  phoneNumber: "+1234567890",
  errorCode: "10001",
  errorDetail: "Invalid destination",
  carrier: "VERIZON",
  lineType: "Landline"  // ← This is the problem!
}
```

## Next Steps

1. **Check Telnyx Dashboard** for the specific error
2. **Verify the destination number** is a mobile number
3. **Test from Telnyx Dashboard** to confirm it's not a code issue
4. **Check carrier and line type** in message details
5. **Contact Telnyx Support** if the error is unclear

## Still Having Issues?

1. **Check Telnyx Support:**
   - Go to: https://support.telnyx.com
   - Provide the message ID and error details
   - They can check carrier-specific issues

2. **Review Webhook Logs:**
   - Check your application logs for webhook events
   - Look for `message.delivery.failed` events
   - The logs now include detailed error information

3. **Test with Different Number:**
   - Try a different mobile number
   - If that works, the issue is with the specific number
   - If that also fails, it's likely an account or carrier issue

## Your Current Setup

- **Source Number**: `+13854061109` ✅
- **Messaging Profile**: Assigned ✅
- **Webhook**: Configured ✅
- **Delivery Status Tracking**: Now includes detailed error logging ✅

The webhook handler will now capture and log detailed error information when delivery fails, making it easier to diagnose the issue.
