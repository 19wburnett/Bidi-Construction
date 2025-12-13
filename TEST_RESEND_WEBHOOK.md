# Testing the Resend Webhook

This guide shows you multiple ways to test the Resend webhook handler for inbound email responses.

## Method 1: Using the Test Endpoint (Recommended)

The easiest way to test is using the built-in test endpoint at `/api/resend/webhook/test`.

### Using cURL:

```bash
curl -X POST http://localhost:3000/api/resend/webhook/test \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "bidPackageId": "your-bid-package-id-here",
    "fromEmail": "subcontractor@example.com",
    "subject": "Re: Bid Request",
    "content": "Hello, I am interested in this project. My bid is $50,000 and I can start next week."
  }'
```

### Using JavaScript/Fetch (in browser console or Node.js):

```javascript
const response = await fetch('/api/resend/webhook/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Include cookies for auth
  body: JSON.stringify({
    bidPackageId: 'your-bid-package-id-here',
    fromEmail: 'subcontractor@example.com',
    subject: 'Re: Bid Request',
    content: 'Hello, I am interested in this project. My bid is $50,000 and I can start next week.'
  })
});

const result = await response.json();
console.log(result);
```

### Using Postman:

1. Create a new POST request to `http://localhost:3000/api/resend/webhook/test`
2. Add your authentication cookie/header
3. Set body to JSON with:
```json
{
  "bidPackageId": "your-bid-package-id-here",
  "fromEmail": "subcontractor@example.com",
  "subject": "Re: Bid Request",
  "content": "Hello, I am interested in this project. My bid is $50,000 and I can start next week."
}
```

## Method 2: Direct Webhook Call (Simulating Resend)

You can also call the webhook endpoint directly with a Resend-formatted payload:

### Using cURL:

```bash
curl -X POST http://localhost:3000/api/resend/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.received",
    "data": {
      "from": {
        "email": "subcontractor@example.com",
        "name": "Test Subcontractor"
      },
      "to": ["bids+your-bid-package-id-here@bids.bidicontracting.com"],
      "subject": "Re: Bid Request",
      "html": "<p>Hello, I am interested in this project. My bid is $50,000 and I can start next week.</p>",
      "text": "Hello, I am interested in this project. My bid is $50,000 and I can start next week.",
      "headers": {
        "reply-to": "bids+your-bid-package-id-here@bids.bidicontracting.com"
      },
      "attachments": []
    }
  }'
```

## Method 3: Testing with Actual Resend Webhook

### Setup in Resend Dashboard:

1. Go to your Resend dashboard → Webhooks
2. Add a webhook endpoint: `https://your-domain.com/api/resend/webhook`
3. Select events: `email.received`
4. Save the webhook

### Testing with ngrok (for local development):

1. Install ngrok: `npm install -g ngrok` or download from https://ngrok.com
2. Start your local server: `npm run dev`
3. Expose it: `ngrok http 3000`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. In Resend dashboard, set webhook URL to: `https://abc123.ngrok.io/api/resend/webhook`
6. Send a test email to `bids+your-bid-package-id@bids.bidicontracting.com`

## Method 4: Using a Test Script

Create a test script file `test-webhook.ts`:

```typescript
async function testWebhook() {
  const bidPackageId = 'your-bid-package-id-here';
  const fromEmail = 'subcontractor@example.com';
  
  const payload = {
    type: 'email.received',
    data: {
      from: {
        email: fromEmail,
        name: 'Test Subcontractor'
      },
      to: [`bids+${bidPackageId}@bids.bidicontracting.com`],
      subject: 'Re: Bid Request',
      html: '<p>Hello, I am interested in this project. My bid is $50,000 and I can start next week.</p>',
      text: 'Hello, I am interested in this project. My bid is $50,000 and I can start next week.',
      headers: {
        'reply-to': `bids+${bidPackageId}@bids.bidicontracting.com`
      },
      attachments: []
    }
  };

  const response = await fetch('http://localhost:3000/api/resend/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  console.log('Webhook response:', result);
}

testWebhook();
```

Run it: `tsx test-webhook.ts` or `node test-webhook.js`

## What to Check After Testing

1. **Check the logs**: Look for console logs in your terminal/server logs:
   - `📧 Resend webhook received`
   - `📥 Processing inbound email...`
   - `✅ Found recipient by email`
   - `✅ Recipient updated successfully`

2. **Check the database**: Verify in Supabase that:
   - `bid_package_recipients` table has a record with:
     - `status = 'responded'`
     - `response_text` contains the email content
     - `responded_at` is set
     - `bid_id` is set (if a bid was created)

3. **Check the UI**: Open the bid comparison modal and verify:
   - The email appears in the "Emails" tab
   - The status shows "responded"
   - The response text is visible when you click on the email

## Common Issues and Solutions

### Issue: "Recipient not found"
- **Solution**: Make sure the `bidPackageId` matches an existing bid package
- **Solution**: Ensure the `fromEmail` matches the email used when sending the original bid package email

### Issue: "Could not determine bid package ID"
- **Solution**: Check that the reply-to address format is correct: `bids+{bidPackageId}@bids.bidicontracting.com`
- **Solution**: Verify the `headers['reply-to']` field is set correctly in the test payload

### Issue: "Authentication required" (for test endpoint)
- **Solution**: Make sure you're logged in and include your session cookie
- **Solution**: Use the direct webhook endpoint instead (Method 2) which doesn't require auth

### Issue: Webhook returns 200 but nothing happens
- **Solution**: Check server logs for error messages
- **Solution**: Verify OpenAI API key is set (needed for AI processing)
- **Solution**: Check Supabase connection and permissions

## Testing Different Scenarios

### Test 1: Simple Response
```json
{
  "bidPackageId": "xxx",
  "fromEmail": "sub@example.com",
  "content": "Yes, I'm interested. My bid is $25,000."
}
```

### Test 2: Response with Questions
```json
{
  "bidPackageId": "xxx",
  "fromEmail": "sub@example.com",
  "content": "I have a few questions: Can you clarify the timeline? What materials are preferred? When can we start?"
}
```

### Test 3: Response with Bid Amount
```json
{
  "bidPackageId": "xxx",
  "fromEmail": "sub@example.com",
  "content": "My company ABC Construction can do this project for $75,000. We can start in 2 weeks and finish in 6 weeks. Contact me at 555-1234."
}
```

## Debugging Tips

1. **Enable verbose logging**: The webhook already logs extensively. Check your server console.

2. **Test with minimal payload**: Start with a simple payload and add complexity gradually.

3. **Check Resend dashboard**: If using real Resend webhooks, check the webhook delivery logs in Resend dashboard.

4. **Database inspection**: Use Supabase dashboard to directly inspect the `bid_package_recipients` table.

5. **Network inspection**: Use browser DevTools Network tab or tools like Postman to see the exact request/response.

