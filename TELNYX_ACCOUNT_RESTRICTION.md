# Telnyx Account Restriction: Pre-Verified Destinations Only

## Error Code: 10039

**Error Message:**
```
Only pre-verified destinations are allowed at this account level. Refer to https://telnyx.com/upgrade
```

## What This Means

Your Telnyx account is currently set to only allow sending SMS to **pre-verified destination numbers**. This is a security/account-level restriction.

Your source phone number (`+13854061109`) is correctly configured, but you cannot send to unverified destination numbers with your current account tier.

**Important:** This is an account-level restriction, not a code issue. The API implementation is correct according to Telnyx's API specification. The restriction must be resolved in Telnyx (either by verifying numbers or upgrading the account).

## Solutions

### Option 1: Verify Destination Numbers (Recommended for Testing)

Before sending SMS to a recipient, verify their phone number in Telnyx:

1. **Go to Telnyx Dashboard:**
   - Navigate to **Numbers** → **Verify Numbers**
   - Or go to: https://portal.telnyx.com/#/app/numbers/verify

2. **Add Phone Number to Verify:**
   - Click **"Add Number"** or **"Verify Number"**
   - Enter the destination phone number (e.g., `+13856084437`)
   - Follow the verification process (usually involves sending a verification code)

3. **Wait for Verification:**
   - Once verified, you can send SMS to that number
   - Verified numbers remain verified for your account

**Note:** This works well for testing or if you have a small, known list of recipients.

### Option 2: Upgrade Your Telnyx Account (Recommended for Production)

To send SMS to any number without pre-verification:

1. **Upgrade Your Account:**
   - Go to: https://telnyx.com/upgrade
   - Or contact Telnyx support to upgrade your account tier
   - Higher-tier accounts allow sending to unverified numbers

2. **Account Benefits:**
   - Send to any valid phone number
   - No need to pre-verify each destination
   - Better for production use with dynamic recipient lists

### Option 3: Use Telnyx's Verification API

You can programmatically verify numbers using Telnyx's API:

```bash
# Verify a phone number
curl -X POST "https://api.telnyx.com/v2/phone_numbers/verifications" \
  -H "Authorization: Bearer YOUR_TELNYX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+13856084437",
    "verify_profile_id": "YOUR_VERIFY_PROFILE_ID"
  }'
```

## For Your Use Case

Since you're building a bid package system that sends SMS to subcontractors:

### Short-term Solution:
- Verify the phone numbers of your most common subcontractors
- Add them to your verified numbers list in Telnyx

### Long-term Solution:
- **Upgrade your Telnyx account** to allow sending to unverified numbers
- This is necessary for a production system where you don't know all recipients in advance

## How to Check Your Account Level

1. Go to Telnyx Dashboard: https://portal.telnyx.com
2. Click on your account/profile (top right)
3. Check **"Account Settings"** or **"Billing"**
4. Look for account tier/plan information
5. Contact Telnyx support if you need to upgrade

## Testing

After verifying a number or upgrading:

1. Restart your server
2. Try sending SMS to the verified number
3. Check logs - you should see successful sending

## Current Status

✅ **Source Number**: `+13854061109` - Properly configured  
✅ **Messaging Profile**: Assigned (`40019b7c-364b-40c8-b18a-a557bc9b52d2`)  
✅ **API Implementation**: Correct (using `from` + `messaging_profile_id` per Telnyx spec)  
❌ **Account Level**: Restricted to pre-verified destinations only  
⚠️ **Destination**: `+13856084437` - Needs verification or account upgrade

## API Implementation Notes

The code now includes both `from` (phone number) and `messaging_profile_id` in the API request, which follows Telnyx's best practices. However, **this will not bypass the account restriction (error 10039)** - that must be resolved by:
1. Verifying destination numbers, OR
2. Upgrading your Telnyx account

## Next Steps

1. **Immediate**: Verify the destination number `+13856084437` in Telnyx dashboard
2. **Future**: Consider upgrading your Telnyx account for production use
3. **Alternative**: Implement a verification flow in your app before sending SMS

## Telnyx Resources

- Error Documentation: https://developers.telnyx.com/docs/overview/errors/10039
- Upgrade Page: https://telnyx.com/upgrade
- Support: https://support.telnyx.com
