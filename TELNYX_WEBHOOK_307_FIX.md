# Fixing Telnyx Webhook 307 Redirect Issue

## Problem

Your Telnyx message shows status "sent" but not "delivered", and you're seeing a 307 (Temporary Redirect) response code. This can prevent delivery status webhooks from reaching your server.

## The Issue

A 307 redirect on the webhook URL can cause Telnyx to fail when trying to send delivery status updates. Common causes:

1. **Trailing Slash Redirect**: URL with/without trailing slash causing redirect
2. **HTTP to HTTPS Redirect**: Webhook URL using HTTP instead of HTTPS
3. **Next.js Redirect**: Middleware or config causing redirects

## Your Current Webhook URL

From the Telnyx response:
```
"webhook_url": "https://bidicontracting.com/api/telnyx/webhook"
```

## Solutions

### 1. Verify Webhook URL in Telnyx Dashboard

1. Go to **Messaging** → **Messaging Profiles**
2. Click on your messaging profile
3. Go to **Inbound** tab
4. Check the **Webhook URL**:
   - Should be: `https://bidicontracting.com/api/telnyx/webhook`
   - **No trailing slash** (important!)
   - Must be HTTPS (not HTTP)

### 2. Update Webhook URL if Needed

If the URL has a trailing slash or is incorrect:

1. In Telnyx Dashboard → **Messaging Profiles** → Your Profile
2. **Inbound** tab → **Webhook URL**
3. Set to: `https://bidicontracting.com/api/telnyx/webhook`
4. **No trailing slash!**
5. Save

### 3. Test Webhook Endpoint

Test that your webhook endpoint responds correctly:

```bash
# Test the webhook endpoint
curl -X POST https://bidicontracting.com/api/telnyx/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

Should return 200 OK (not 307 redirect).

### 4. Check Next.js Configuration

Your `next.config.js` already has:
```js
skipTrailingSlashRedirect: true
```

This should prevent trailing slash redirects. Verify it's working.

### 5. Check Middleware

Make sure your middleware (`proxy.ts` or `middleware.ts`) doesn't redirect API routes:

```typescript
// Should allow API routes to pass through
const isApiRoute = request.nextUrl.pathname.startsWith('/api')
if (!isApiRoute) {
  // Only redirect non-API routes
}
```

## Why "Sent" but Not "Delivered"?

When a message shows "sent" but not "delivered":

1. **Normal Delay**: Delivery can take 5-30 seconds. Wait a bit.
2. **Webhook Not Received**: If delivery webhook fails due to 307, status won't update
3. **Delivery Actually Failed**: Carrier rejected, but failure webhook also failed

## How to Check Delivery Status

### Method 1: Check Telnyx Dashboard
1. Go to **Messaging** → **Messages**
2. Find your message
3. Check the status:
   - **"sent"** = Message sent but delivery status unknown
   - **"delivered"** = Successfully delivered
   - **"delivery_failed"** = Delivery failed

### Method 2: Check Your Server Logs
Look for webhook events:
```
📱 [telnyx-webhook] Received event: message.delivered
📱 [telnyx-webhook] Received event: message.delivery.failed
```

If you don't see these, the webhooks aren't reaching your server (likely due to 307).

### Method 3: Check Telnyx API Logs
1. Go to **Activity** → **API Logs**
2. Filter for webhook delivery attempts
3. Check if webhooks are returning 307

## Immediate Fix

1. **Verify Webhook URL** in Telnyx Dashboard (no trailing slash)
2. **Test the endpoint** with curl to ensure it returns 200
3. **Wait 30 seconds** after sending to see if delivery webhook arrives
4. **Check server logs** for webhook events

## If Still Not Working

1. **Check Telnyx Webhook Logs**:
   - Go to **Activity** → **API Logs**
   - Look for webhook delivery attempts
   - Check response codes

2. **Manually Check Message Status**:
   - Use Telnyx API to check message status:
   ```bash
   curl -X GET "https://api.telnyx.com/v2/messages/MESSAGE_ID" \
     -H "Authorization: Bearer YOUR_TELNYX_API_KEY"
   ```

3. **Contact Telnyx Support**:
   - If webhooks consistently fail
   - Provide message ID and webhook URL
   - They can check webhook delivery logs

## Expected Behavior

1. **Message Sent**: Status = "sent" (immediate)
2. **Webhook Received**: `message.sent` event (within 1-2 seconds)
3. **Delivery Attempt**: Carrier tries to deliver (5-30 seconds)
4. **Webhook Received**: `message.delivered` or `message.delivery.failed` event
5. **Status Updated**: Database updated with delivery status

If step 4 doesn't happen, webhooks aren't reaching your server (likely 307 issue).

## Your Current Setup

- **Webhook URL**: `https://bidicontracting.com/api/telnyx/webhook` ✅
- **Next.js Config**: `skipTrailingSlashRedirect: true` ✅
- **Webhook Handler**: Returns 200 OK ✅
- **Issue**: 307 redirect preventing webhook delivery ❌

Fix the 307 redirect issue and delivery status should start updating properly.
