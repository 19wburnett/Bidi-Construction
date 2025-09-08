# Web Crawler Setup Guide

This guide will help you set up the web crawler system for automatically discovering and contacting subcontractors.

## 🚀 **Quick Start**

### 1. Install Dependencies

```bash
npm install puppeteer
```

### 2. Run Database Migration

```sql
-- Run this in your Supabase SQL editor
-- Copy and paste the contents of supabase-migration-add-crawler-system.sql
```

### 3. Set Up Environment Variables

Add these to your `.env.local`:

```env
# Puppeteer configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Email service (for outreach)
RESEND_API_KEY=your_resend_api_key
```

### 4. Deploy to Production

For production deployment, you'll need to configure Puppeteer for your hosting platform:

#### Vercel
```bash
npm install @vercel/node
```

#### Railway/Render
```bash
# Add to package.json
"scripts": {
  "postinstall": "npx puppeteer browsers install chrome"
}
```

## 🕷️ **How the Crawler Works**

### **Data Sources**
1. **Google My Business**: Searches Google Maps for contractors
2. **Yelp**: Finds contractors in business directories
3. **LinkedIn**: Discovers contractor companies
4. **Trade Associations**: Scrapes professional association directories

### **Process Flow**
1. **Search**: Crawls multiple sources for contractor information
2. **Validate**: Checks email formats and business legitimacy
3. **Store**: Saves discovered contractors to database
4. **Outreach**: Sends professional invitation emails
5. **Track**: Monitors response rates and success metrics

### **Features**
- **Rate Limiting**: Respectful crawling with delays
- **Data Validation**: Verifies contact information
- **Duplicate Prevention**: Avoids contacting existing contractors
- **Admin Dashboard**: Monitor crawler activity and results
- **Email Templates**: Professional outreach messages

## 🎯 **Usage**

### **Start a Crawler Job**
1. Go to Admin → Crawler
2. Fill out the form:
   - Trade Category (e.g., "Electrical")
   - Location (e.g., "San Francisco, CA")
   - Max Results (default: 50)
   - Search Radius (default: 25 miles)
3. Click "Start Crawler"

### **Monitor Progress**
- View job status (running, completed, failed)
- See results found and emails sent
- Track contractor discovery metrics

### **Review Results**
- Discovered contractors are stored in the database
- Verified contractors are automatically added to subcontractors table
- Outreach emails are logged for tracking

## 🔧 **Configuration**

### **Crawler Settings**
- **Max Results**: Limit total contractors to discover
- **Search Radius**: Geographic area to search
- **Rate Limiting**: Delays between requests
- **Email Templates**: Customize outreach messages

### **Data Sources**
You can modify the crawler modules in `/lib/crawlers/`:
- `google-my-business.ts`
- `yelp.ts`
- `linkedin.ts`
- `trade-associations.ts`

### **Email Templates**
Customize outreach emails in `/app/api/crawler/start/route.ts`:
- Professional tone
- Clear value proposition
- Call-to-action buttons
- Unsubscribe options

## 📊 **Database Schema**

### **Tables Created**
- `crawler_jobs`: Tracks crawler runs
- `crawler_outreach_log`: Logs outreach emails
- `crawler_discovered_contractors`: Stores found contractors

### **Key Fields**
- **Job Status**: running, completed, failed, paused
- **Results Tracking**: contractors found, emails sent
- **Verification**: contractor validation status
- **Response Tracking**: email delivery and responses

## 🛡️ **Best Practices**

### **Ethical Crawling**
- Respect robots.txt files
- Use reasonable delays between requests
- Don't overload target websites
- Follow terms of service

### **Data Quality**
- Validate email addresses
- Check business legitimacy
- Remove duplicates
- Verify contact information

### **Email Outreach**
- Professional tone
- Clear value proposition
- Easy unsubscribe
- Respect CAN-SPAM laws

## 🚨 **Legal Considerations**

### **Compliance**
- **CAN-SPAM Act**: Include unsubscribe options
- **GDPR**: Respect privacy rights
- **Terms of Service**: Follow website rules
- **Rate Limiting**: Don't overload servers

### **Data Protection**
- Secure storage of contact information
- Respect opt-out requests
- Regular data cleanup
- Privacy policy compliance

## 🔍 **Troubleshooting**

### **Common Issues**
1. **Puppeteer Installation**: Ensure Chromium is installed
2. **Rate Limiting**: Increase delays between requests
3. **Email Delivery**: Check email service configuration
4. **Database Errors**: Verify migration was run

### **Debug Mode**
Enable detailed logging by setting:
```env
DEBUG_CRAWLER=true
```

### **Monitoring**
- Check crawler job status in admin dashboard
- Review error logs in console
- Monitor email delivery rates
- Track contractor response rates

## 📈 **Scaling**

### **Performance Optimization**
- Run crawlers in background
- Use queue system for large jobs
- Implement caching
- Optimize database queries

### **Cost Management**
- Monitor API usage
- Optimize crawler efficiency
- Use free data sources when possible
- Implement smart rate limiting

## 🎉 **Success Metrics**

### **Key Performance Indicators**
- **Discovery Rate**: Contractors found per job
- **Verification Rate**: Valid contact information
- **Response Rate**: Email engagement
- **Conversion Rate**: Contractors joining platform

### **Optimization**
- A/B test email templates
- Refine search queries
- Improve data validation
- Enhance outreach timing

This crawler system will help you rapidly expand your contractor network and grow your platform's reach!


