# Telnyx SMS Integration Setup Guide

## Overview
This guide explains how to set up SMS (text messaging) functionality for bid packages and bid comparisons using Telnyx.

## Prerequisites
1. Telnyx account (sign up at https://telnyx.com)
2. Telnyx phone number (purchased in Telnyx dashboard)
3. Telnyx API key

## Environment Variables

Add these to your `.env` file:

```bash
# Telnyx Configuration
TELNYX_API_KEY=your_telnyx_api_key_here
TELNYX_PHONE_NUMBER=+1234567890  # Your Telnyx phone number (E.164 format with +)
TELNYX_PUBLIC_KEY=your_telnyx_public_key_here  # Optional: for webhook signature verification
```

### Getting Your Telnyx API Key
1. Log into Telnyx dashboard: https://portal.telnyx.com
2. Go to **Settings** → **API Keys**
3. Create a new API key or copy an existing one
4. Add it to your `.env` file as `TELNYX_API_KEY`

### Getting Your Telnyx Phone Number
1. In Telnyx dashboard, go to **Numbers** → **Buy Numbers**
2. Purchase a phone number (or use an existing one)
3. The number should be in E.164 format (e.g., `+1234567890`)
4. Add it to your `.env` file as `TELNYX_PHONE_NUMBER`

## Webhook Configuration

### Step 1: Get Your Webhook URL

Your webhook URL should be:
```
https://your-domain.com/api/telnyx/webhook
```

Replace `your-domain.com` with your actual domain (e.g., `bidicontracting.com`).

**Important:**
- Use HTTPS (not HTTP)
- No trailing slash
- Must be publicly accessible (no authentication required)

### Step 2: Configure Webhook in Telnyx

1. Log into Telnyx dashboard: https://portal.telnyx.com
2. Navigate to **Messaging** → **Webhooks** (or **Settings** → **Webhooks**)
3. Click **"Add Webhook"** or **"Create Webhook"**
4. Enter your webhook URL: `https://your-domain.com/api/telnyx/webhook`
5. Select the events to listen for:
   - ✅ `message.sent` - When SMS is sent
   - ✅ `message.finalized` - When SMS is finalized
   - ✅ `message.delivery.failed` - When SMS delivery fails
   - ✅ `message.delivery.receipt` - When SMS is delivered
   - ✅ `message.received` - When inbound SMS is received (IMPORTANT for replies)

### Step 3: Verify Webhook is Active

1. Check that the webhook status is **"Active"** or **"Enabled"**
2. Note the webhook secret (if provided) - you may need this for verification later

### Step 4: Test Webhook Connectivity

Test if your webhook endpoint is accessible:

```bash
# Test GET request (health check)
curl https://your-domain.com/api/telnyx/webhook

# Should return: {"status":"ok","service":"telnyx-webhook",...}
```

## Database Migration

Run the migration to add SMS fields to the database:

```bash
# If using Supabase CLI
supabase migration up

# Or apply the migration manually:
# supabase/migrations/20250228_add_sms_support.sql
```

This migration adds:
- `subcontractor_phone` - Phone number field
- `telnyx_message_id` - Telnyx message ID for tracking
- `sms_status` - SMS delivery status
- `sms_sent_at` - SMS sent timestamp
- `sms_delivered_at` - SMS delivered timestamp
- `sms_response_text` - Inbound SMS response text
- `sms_received_at` - Inbound SMS received timestamp
- `delivery_channel` - Preferred delivery method (email, sms, or both)

## Usage

### In Bid Package Modal

1. When creating a bid package, you'll see a **"Delivery Method"** selector
2. Choose from:
   - **Email Only** - Send via email only
   - **SMS Only** - Send via SMS only
   - **Email & SMS** - Send via both channels

### In Bid Comparison Modal

1. When responding to a bid, you can choose to send via email, SMS, or both
2. The system will automatically use the recipient's phone number if available

## Features

### Outbound SMS
- Send bid package requests via SMS
- Track SMS delivery status (sent, delivered, failed)
- Store SMS message IDs for webhook tracking

### Inbound SMS
- Receive SMS replies from subcontractors
- Automatically link replies to bid packages
- Store SMS responses in the database

### Webhook Events Handled
- `message.sent` - Updates SMS status to "sent"
- `message.delivered` - Updates SMS status to "delivered"
- `message.failed` - Updates SMS status to "failed"
- `message.received` - Processes inbound SMS replies

## Troubleshooting

### SMS Not Sending
1. Check `TELNYX_API_KEY` is set correctly
2. Verify `TELNYX_PHONE_NUMBER` is in E.164 format (starts with +)
3. Check Telnyx dashboard for error messages
4. Review server logs for API errors

### Webhook Not Receiving Events
1. Verify webhook URL is correct (HTTPS, no trailing slash)
2. Check webhook is active in Telnyx dashboard
3. Test webhook endpoint manually: `curl https://your-domain.com/api/telnyx/webhook`
4. Check server logs for incoming webhook requests

### Inbound SMS Not Processing
1. Verify webhook is configured for `message.received` events
2. Check that recipient phone numbers are stored in database
3. Review webhook logs for processing errors
4. Ensure phone numbers are normalized correctly (E.164 format)

### Phone Number Format Issues
- Phone numbers should be in E.164 format: `+1234567890`
- The system automatically normalizes phone numbers when sending
- US numbers without country code will have `+1` prepended

## Security Notes

### Webhook Signature Verification
The webhook handler supports signature verification using Telnyx's public key:
- Set `TELNYX_PUBLIC_KEY` in your `.env` file
- The webhook will verify signatures automatically
- In development, signature verification is optional (logs warning)

### Rate Limiting
- Telnyx has rate limits on SMS sending
- The system includes delays between sends to avoid rate limiting
- Check Telnyx dashboard for your account limits

## API Endpoints

### Send SMS
```
POST /api/bid-packages/send-sms
Body: {
  bidPackageId: string
  recipientId: string
  message: string
}
```

### Telnyx Webhook
```
POST /api/telnyx/webhook
(Handled automatically by Telnyx)
```

## Support

For Telnyx-specific issues:
- Telnyx Documentation: https://developers.telnyx.com
- Telnyx Support: https://support.telnyx.com

For application-specific issues:
- Check server logs
- Review webhook event logs in Telnyx dashboard
- Verify database migrations are applied
