# Bidi - Construction Marketplace

A SaaS web app that connects general contractors with subcontractors for construction projects.

## Features

- **GC Onboarding & Subscription**: General contractors sign up and subscribe via Stripe
- **Job Request Posting**: GCs post detailed job requests with file uploads
- **Email Distribution**: Automatic email distribution to qualified subcontractors
- **AI Bid Parsing**: AI-powered parsing of subcontractor email replies
- **GC Dashboard**: Clean interface to view and manage bids

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (auth, database, storage), Vercel Serverless Functions
- **Payments**: Stripe subscriptions
- **Email**: Resend (outbound + inbound webhooks)
- **AI**: OpenAI API (GPT-4 for bid parsing and file summarization)
- **Deployment**: Vercel

## Getting Started

### 1. Clone and Install Dependencies

```bash
git clone <your-repo>
cd bidi
npm install
```

**Note**: The `postinstall` script automatically updates the PDF.js worker file to match the installed package version. If you encounter PDF viewer errors, run:
```bash
node update-pdf-worker.js
```

### 2. Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cp env.example .env.local
```

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Resend
RESEND_API_KEY=your_resend_api_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# App
NEXT_PUBLIC_APP_URL=https://www.bidicontracting.com
```

### 3. Supabase Setup

1. Create a new Supabase project
2. Run the SQL schema from `supabase-schema.sql` in your Supabase SQL editor
3. Enable email authentication in Supabase Auth settings
4. Create a storage bucket named `job-files` (or run the schema which creates it)

### 4. Stripe Setup

1. Create a Stripe account and get your API keys
2. Create a product with a monthly recurring price of $99
3. Set up webhook endpoint: `https://your-domain.com/api/stripe/webhook`
4. Add webhook events: `checkout.session.completed`, `customer.subscription.deleted`

### 5. Resend Setup

1. Create a Resend account and get your API key
2. Verify your domain for sending emails
3. Set up inbound webhook: `https://your-domain.com/api/resend/webhook`

### 6. OpenAI Setup

1. Get your OpenAI API key
2. Ensure you have access to GPT-4

### 7. Run the Development Server

```bash
npm run dev
```

Open [https://www.bidicontracting.com](https://www.bidicontracting.com) to see the application.

## Project Structure

```
├── app/                    # Next.js 14 app directory
│   ├── api/               # API routes
│   │   ├── stripe/        # Stripe integration
│   │   ├── resend/        # Email webhooks
│   │   └── send-job-emails/ # Job distribution
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # GC dashboard
│   └── subscription/      # Stripe subscription
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                  # Utilities and configurations
└── supabase-schema.sql   # Database schema
```

## Core Workflows

### 1. GC Onboarding
- Sign up/login with Supabase Auth
- Subscribe via Stripe ($99/month)
- Access dashboard

### 2. Job Request Flow
- GC fills out job request form
- Files uploaded to Supabase Storage
- Job saved to database
- Emails sent to matching subcontractors

### 3. Bid Processing
- Subcontractors reply via email
- Resend webhook receives inbound emails
- OpenAI parses bid information
- Structured data saved to database

### 4. GC Dashboard
- View all job requests
- See parsed bids with AI summaries
- Download original files
- Contact subcontractors

## Database Schema

- **users**: GC accounts with Stripe customer IDs
- **job_requests**: Posted jobs with file attachments
- **bids**: AI-parsed subcontractor responses
- **subcontractors**: Email list for job distribution

## Deployment

The app is designed to deploy entirely on Vercel:

1. Connect your GitHub repository to Vercel
2. Add all environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

## Next Steps

This MVP includes the first 3 core requirements:
1. ✅ Next.js + Supabase scaffolding
2. ✅ GC signup/login + Stripe subscription
3. ✅ Job request form + email distribution

Still to implement:
- Inbound email webhook processing
- AI bid parsing with OpenAI
- GC dashboard for viewing bids
- File attachment handling in emails

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
