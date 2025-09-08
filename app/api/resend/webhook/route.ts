import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Resend webhook received:', JSON.stringify(body, null, 2))

    // Verify this is an inbound email event
    if (body.type !== 'email.received') {
      return NextResponse.json({ message: 'Not an email received event' })
    }

    const email = body.data
    const { from, to, subject, html, text, headers } = email

    // Extract job request ID from email headers or reply-to address
    let jobRequestId = null
    
    // Try to get from reply-to address (bids+{jobId}@savewithbidi.com)
    const replyToMatch = headers['reply-to']?.match(/bids\+([a-f0-9-]+)@savewithbidi\.com/)
    if (replyToMatch) {
      jobRequestId = replyToMatch[1]
    }
    
    // Fallback: try to extract from subject line
    if (!jobRequestId) {
      const subjectMatch = subject.match(/Re: New (.+) Job Opportunity in (.+)/)
      if (subjectMatch) {
        const [, tradeCategory, location] = subjectMatch
        
        // Get the most recent job request matching this trade and location
        const supabase = await createServerSupabaseClient()
        const { data: jobRequest } = await supabase
          .from('job_requests')
          .select('id')
          .eq('trade_category', tradeCategory)
          .eq('location', location)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        if (jobRequest) {
          jobRequestId = jobRequest.id
        }
      }
    }

    if (!jobRequestId) {
      console.log('Could not determine job request ID from email:', { subject, headers })
      return NextResponse.json({ message: 'Could not determine job request ID' })
    }

    // Get the job request details
    const supabase = await createServerSupabaseClient()
    const { data: jobRequest, error: jobError } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', jobRequestId)
      .single()

    if (jobError || !jobRequest) {
      console.error('Could not find matching job request:', jobError)
      return NextResponse.json({ message: 'Job request not found' })
    }

    // Parse the email content with AI
    const emailContent = html || text || ''
    const aiSummary = await parseBidWithAI(emailContent, from.email, jobRequest.trade_category)

    // Extract bid information using AI
    const bidData = await extractBidData(emailContent, from.email)

    // Look up website from discovered contractors, fallback to AI extraction
    let website = bidData.website || null
    const { data: contractorData } = await supabase
      .from('crawler_discovered_contractors')
      .select('website')
      .eq('email', from.email)
      .single()
    
    if (contractorData?.website) {
      website = contractorData.website
    }

    // Store the bid in the database
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .insert({
        job_request_id: jobRequest.id,
        subcontractor_email: from.email,
        subcontractor_name: bidData.companyName || from.name || 'Unknown',
        phone: bidData.phone || null,
        website: website,
        bid_amount: bidData.bidAmount || null,
        timeline: bidData.timeline || null,
        notes: bidData.notes || null,
        ai_summary: aiSummary,
        raw_email: emailContent,
      })
      .select()
      .single()

    if (bidError) {
      console.error('Error storing bid:', bidError)
      return NextResponse.json({ error: 'Failed to store bid' }, { status: 500 })
    }

    console.log('Bid stored successfully:', bid.id)

    return NextResponse.json({ 
      message: 'Bid processed successfully',
      bidId: bid.id 
    })

  } catch (error) {
    console.error('Error processing Resend webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

async function parseBidWithAI(emailContent: string, senderEmail: string, tradeCategory: string): Promise<string> {
  try {
    const prompt = `
    Analyze this email from a subcontractor responding to a ${tradeCategory} job opportunity.
    Provide a concise summary of their bid response.

    Email content:
    ${emailContent}

    Please provide a 2-3 sentence summary focusing on:
    - Their interest level
    - Key details they mentioned
    - Any specific requirements or questions
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.3,
    })

    return response.choices[0]?.message?.content || 'Unable to parse bid content'
  } catch (error) {
    console.error('Error parsing bid with AI:', error)
    return 'Error parsing bid content'
  }
}

async function extractBidData(emailContent: string, senderEmail: string) {
  try {
    const prompt = `
    Extract structured bid information from this subcontractor email response.
    Return ONLY a JSON object with these fields (use null if not found):
    {
      "companyName": "string or null",
      "phone": "string or null", 
      "website": "string or null",
      "bidAmount": "number or null",
      "timeline": "string or null",
      "notes": "string or null"
    }

    Email content:
    ${emailContent}

    Instructions:
    - Extract company name from signature or email content
    - Look for phone numbers in any format
    - Look for website URLs (www.domain.com, domain.com, etc.)
    - Extract bid amount (look for dollar amounts, estimates, quotes)
    - Find timeline information (start date, duration, completion date)
    - Capture any additional notes or special requirements
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Try to parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    throw new Error('No valid JSON found in AI response')
  } catch (error) {
    console.error('Error extracting bid data:', error)
    return {
      companyName: null,
      phone: null,
      website: null,
      bidAmount: null,
      timeline: null,
      notes: null,
    }
  }
}
