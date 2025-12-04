# Email Inbound Setup - Fixing Reply-To Address Rejection

## Problem
When users reply to bid request emails, they receive this error:
```
550 5.4.1 Recipient address rejected: Access denied
```

Additionally, webhook events show "307 - Temporary Redirect" instead of processing.

## Root Cause
1. **Inbound Email**: The domain `bidicontracting.com` is not configured in Resend to receive inbound emails
2. **Webhook Redirect**: The webhook URL in Resend may be misconfigured (HTTP vs HTTPS, trailing slash, etc.)

## Solution: Configure Domain for Inbound Email in Resend

### Step 1: Add Domain to Resend
1. Log into your Resend dashboard: https://resend.com/domains
2. Click "Add Domain"
3. Enter `bidicontracting.com`
4. Follow Resend's domain verification process

### Step 2: Configure DNS Records
Add these DNS records to your domain's DNS provider:

#### MX Record (Required for Inbound Email)
```
Type: MX
Name: @ (or bidicontracting.com)
Value: feedback-smtp.resend.com
Priority: 10
TTL: 3600
```

#### SPF Record (Already should exist for outbound)
```
Type: TXT
Name: @
Value: v=spf1 include:resend.com ~all
```

#### DKIM Records (Resend will provide these)
Resend will generate DKIM keys after you add the domain. Add them as TXT records.

#### DMARC Record (Recommended)
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@bidicontracting.com
```

### Step 3: Enable Inbound Email in Resend
1. In Resend dashboard, go to your domain settings
2. Enable "Inbound Email"
3. Set the webhook URL to: `https://your-domain.com/api/resend/webhook`
   - **IMPORTANT**: Use HTTPS (not HTTP)
   - **IMPORTANT**: No trailing slash
   - Example: `https://bidicontracting.com/api/resend/webhook`
4. Verify the webhook is receiving events

### Step 4: Fix 307 Redirect Issue
If you're seeing "307 - Temporary Redirect" in the webhook logs:
1. Check that the webhook URL uses **HTTPS** (not HTTP)
2. Ensure there's **no trailing slash** at the end
3. The URL should be exactly: `https://your-domain.com/api/resend/webhook`
4. Test the webhook URL manually with a POST request to verify it returns 200

### Step 5: Verify Configuration
1. Wait for DNS propagation (can take up to 48 hours, usually much faster)
2. Test by sending an email to `bids+test@bids.bidicontracting.com`
3. Check Resend dashboard for inbound email events
4. Verify webhook is receiving `email.received` events (not redirects)
5. Check your application logs for webhook processing

## Alternative: Use Different Domain
If you can't configure `bidicontracting.com`, you could:
1. Use a subdomain like `inbound.bidicontracting.com`
2. Use a different domain entirely (e.g., `savewithbidi.com` which is already used in some places)
3. Configure that domain for inbound email instead

## Testing
After configuration:
1. Send a test bid package email
2. Reply to it from an external email address
3. Check that the reply is received in Resend
4. Verify the webhook processes it correctly (check logs for "✅ Inbound email processed")
5. Confirm the bid is created in the system

## Current Webhook Status
The webhook at `/api/resend/webhook` is already configured to handle inbound emails. It:
- Extracts `bidPackageId` from the reply-to address
- Parses the email content with AI
- Creates bid records
- Updates recipient status
- Has improved error handling and logging

The webhook is ready - you just need to:
1. Configure the domain to receive emails (MX records)
2. Fix the webhook URL configuration in Resend (use HTTPS, no trailing slash)

## Troubleshooting

### Webhook returns 307 Redirect
- Check webhook URL in Resend dashboard
- Ensure it uses HTTPS
- Remove any trailing slash
- Test URL manually: `curl -X POST https://your-domain.com/api/resend/webhook`

### Emails still bouncing with "550 5.4.1"
- Verify MX record is correctly configured
- Check DNS propagation: `dig MX bidicontracting.com`
- Ensure domain is verified in Resend
- Check that inbound email is enabled for the domain

### Webhook not receiving events
- Check Resend dashboard → Webhooks → Events
- Verify webhook URL is correct
- Check application logs for webhook calls
- Test webhook endpoint manually

