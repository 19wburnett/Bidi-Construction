# Resend Webhook Setup Guide

## Problem
Email statuses (opened, delivered, etc.) are not updating in the app because Resend webhooks are not configured or not reaching the server.

## Solution: Configure Resend Webhooks

### Step 1: Access Resend Dashboard
1. Go to https://resend.com
2. Log in to your account
3. Navigate to **Settings** → **Webhooks** (or **API** → **Webhooks`)

### Step 2: Create/Configure Webhook
1. Click **"Add Webhook"** or **"Create Webhook"**
2. Enter the webhook URL: `https://bidicontracting.com/api/resend/webhook`
   - **CRITICAL**: Use HTTPS (not HTTP)
   - **CRITICAL**: No trailing slash
   - **CRITICAL**: Must be publicly accessible (no authentication required)
3. Select the events to listen for:
   - ✅ `email.sent` - When email is sent
   - ✅ `email.delivered` - When email is delivered
   - ✅ `email.clicked` - When email is clicked/opened (IMPORTANT for status updates)
   - ✅ `email.bounced` - When email bounces
   - ✅ `email.failed` - When email fails to send
   - ✅ `email.received` - When inbound email is received (for replies)

### Step 3: Verify Webhook is Active
1. Check that the webhook status is **"Active"** or **"Enabled"**
2. Note the webhook secret (if provided) - you may need this for verification later

### Step 4: Test Webhook Connectivity
Test if your webhook endpoint is accessible:

```bash
# Test GET request
curl https://bidicontracting.com/api/resend/webhook/test

# Test POST request (simulating Resend webhook)
curl -X POST https://bidicontracting.com/api/resend/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"type": "email.clicked", "data": {"email_id": "test-123"}}'
```

Both should return JSON responses.

### Step 5: Send a Test Email
1. Send a bid package email from your app
2. Click/open the email in your email client
3. Check your Vercel logs for webhook events:
   - Look for: `📧 [webhook] Processing outbound event: email.clicked`
   - Look for: `📧 [webhook] ✅ Recipient updated successfully`

### Step 6: Check Resend Webhook Logs
1. In Resend dashboard, go to your webhook
2. Click on **"Events"** or **"Logs"**
3. You should see webhook delivery attempts
4. Check if they're:
   - ✅ **200 OK** - Webhook is working
   - ❌ **4xx/5xx** - Check the error message
   - ❌ **No events** - Webhook might not be configured correctly

## Troubleshooting

### No Webhook Events in Resend Dashboard
**Possible causes:**
1. Webhook not created - Go to Step 2
2. Webhook disabled - Enable it in Resend dashboard
3. Events not selected - Make sure all events are checked
4. Wrong URL - Verify the URL is exactly `https://bidicontracting.com/api/resend/webhook`

### Webhook Returns 401/403
- Check if your webhook endpoint requires authentication
- The `/api/resend/webhook` endpoint should NOT require auth (it's public)

### Webhook Returns 404
- Verify the URL is correct: `https://bidicontracting.com/api/resend/webhook`
- Check that the route file exists: `app/api/resend/webhook/route.ts`
- Make sure the deployment is up to date

### Webhook Returns 500
- Check Vercel logs for error details
- Look for `📧 [webhook]` logs to see what's failing
- Common issues:
  - Database connection errors
  - Missing environment variables
  - Invalid webhook payload structure

### Webhook Events Received But Status Not Updating
1. Check Vercel logs for: `📧 [webhook] Recipient not found for email ID: [id]`
2. This means the `resend_email_id` doesn't match
3. Verify that emails are being sent with `resend_email_id` stored correctly
4. Check the webhook payload structure - Resend might send `email_id` vs `id`

## Verification Checklist
- [ ] Webhook created in Resend dashboard
- [ ] Webhook URL is: `https://bidicontracting.com/api/resend/webhook`
- [ ] Webhook is Active/Enabled
- [ ] All events are selected (sent, delivered, clicked, bounced, failed, received)
- [ ] Test endpoint returns 200: `curl https://bidicontracting.com/api/resend/webhook/test`
- [ ] Webhook events appear in Resend dashboard after sending/opening emails
- [ ] Vercel logs show `📧 [webhook]` messages when events occur
- [ ] Database statuses update from "sent" → "delivered" → "opened"

## Next Steps After Setup
Once webhooks are configured:
1. Send a test bid package email
2. Open the email
3. Check Vercel logs - you should see webhook events
4. Check the app - status should update from "sent" to "opened"
5. Polling will automatically pick up the changes every 10 seconds

