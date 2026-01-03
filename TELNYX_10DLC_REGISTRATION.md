# Telnyx 10DLC Registration Guide

## Error Code: 40010

**Error Message:**
```
The sending number is not 10DLC-registered but is required to be by the carrier.
```

## What This Means

**10DLC** (10-Digit Long Code) registration is required for sending A2P (Application-to-Person) SMS messages to US mobile carriers. Your phone number (`+13854061109`) needs to be registered before you can send messages.

**Why?** US carriers (T-Mobile, AT&T, Verizon, etc.) require businesses to register their brand and messaging campaigns to prevent spam and ensure message deliverability.

## The Problem

Your message failed because:
- **Source Number**: `+13854061109` (not 10DLC registered)
- **Destination Carrier**: T-Mobile (requires 10DLC registration)
- **Error**: 40010 - Not 10DLC registered

## Solution: Register for 10DLC

### Step 1: Register Your Brand

1. **Go to Telnyx Dashboard:**
   - Navigate to **Messaging** → **10DLC**
   - Or go to: https://portal.telnyx.com/#/app/messaging/10dlc

2. **Create Brand Registration:**
   - Click **"Create Brand"** or **"Register Brand"**
   - Fill in your business information:
     - **Legal Company Name**: Your registered business name
     - **EIN/Tax ID**: Your business tax ID (required)
     - **Website**: Your business website
     - **Address**: Business address
     - **Contact Information**: Business contact details

3. **Submit for Approval:**
   - Brand registration typically takes 1-3 business days
   - Telnyx will review and approve your brand

### Step 2: Create a Campaign

After your brand is approved:

1. **Create Campaign:**
   - Go to **Messaging** → **10DLC** → **Campaigns**
   - Click **"Create Campaign"**

2. **Campaign Details:**
   - **Campaign Name**: e.g., "Bid Package Notifications"
   - **Campaign Type**: Select appropriate type (usually "Mixed" or "Marketing")
   - **Use Case**: Describe your use case (e.g., "Sending bid package notifications to subcontractors")
   - **Sample Messages**: Provide sample messages you'll send
   - **Opt-in Method**: Describe how users opt in to receive messages

3. **Link Campaign to Messaging Profile:**
   - After campaign is approved, link it to your messaging profile
   - Go to **Messaging** → **Messaging Profiles** → Your Profile
   - Assign the campaign to your profile

### Step 3: Assign Campaign to Phone Number

1. **Link Campaign:**
   - Go to **Numbers** → **My Numbers**
   - Find your number: `+13854061109`
   - Assign the 10DLC campaign to the number
   - Or assign it via the messaging profile

## Alternative Solutions

### Option 1: Use Toll-Free Number
Toll-free numbers (800, 888, 877, etc.) don't require 10DLC registration:
- Purchase a toll-free number in Telnyx
- Use it as your `TELNYX_PHONE_NUMBER`
- No 10DLC registration needed

### Option 2: Use Short Code
Short codes (5-6 digit numbers) don't require 10DLC:
- More expensive but higher throughput
- Better for high-volume messaging
- Requires separate application process

### Option 3: Use International Number
If sending to international numbers, 10DLC may not be required:
- Check carrier requirements for destination country
- Some countries have different regulations

## Registration Timeline

- **Brand Registration**: 1-3 business days
- **Campaign Registration**: 1-7 business days (depends on campaign type)
- **Total**: Typically 2-10 business days

**Note**: Some campaign types (like "Marketing") may take longer to approve.

## Cost

- **Brand Registration**: Usually free or low cost
- **Campaign Registration**: Varies by campaign type
- **Monthly Fees**: Some campaign types have monthly fees
- **Per-Message Costs**: May vary based on campaign type

Check Telnyx pricing for current rates.

## Quick Start Checklist

- [ ] Register your brand in Telnyx Dashboard
- [ ] Wait for brand approval (1-3 days)
- [ ] Create a campaign
- [ ] Wait for campaign approval (1-7 days)
- [ ] Link campaign to messaging profile
- [ ] Assign campaign to phone number
- [ ] Test sending SMS again

## Testing

After registration is complete:

1. **Wait for Approval**: Don't try to send until both brand and campaign are approved
2. **Test Message**: Send a test SMS from Telnyx Dashboard
3. **Check Status**: Verify message is delivered (not failed with 40010)
4. **Update Code**: Your code should now work without 40010 errors

## Common Issues

### "Brand Registration Pending"
- Wait for approval (1-3 business days)
- Check email for any requests for additional information
- Contact Telnyx support if it's been longer than 3 days

### "Campaign Registration Pending"
- Wait for approval (1-7 business days)
- Marketing campaigns take longer than transactional
- Ensure you provided all required information

### "Campaign Rejected"
- Review rejection reason
- Update campaign details
- Resubmit for approval

### "Still Getting 40010 Error"
- Verify campaign is approved (not just pending)
- Check that campaign is linked to your messaging profile
- Ensure phone number is assigned to the messaging profile
- Wait a few minutes after linking (changes may take time to propagate)

## Your Current Setup

- **Source Number**: `+13854061109` ❌ (Not 10DLC registered)
- **Destination**: T-Mobile (requires 10DLC)
- **Error**: 40010 - Not 10DLC registered
- **Solution**: Register brand and campaign in Telnyx

## Telnyx Resources

- **10DLC Overview**: https://developers.telnyx.com/docs/messaging/10dlc/overview
- **Error Documentation**: https://developers.telnyx.com/docs/overview/errors/40010
- **Dashboard**: https://portal.telnyx.com/#/app/messaging/10dlc
- **Support**: https://support.telnyx.com

## Next Steps

1. **Immediate**: Register your brand in Telnyx Dashboard
2. **After Brand Approval**: Create a campaign
3. **After Campaign Approval**: Link to messaging profile and test
4. **Alternative**: Consider using a toll-free number if you need to send immediately

The 10DLC registration process is required for US A2P messaging but is a one-time setup that will allow you to send SMS reliably to all US carriers.
