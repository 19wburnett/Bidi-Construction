import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs'

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
      .select('*, job_id')
      .eq('id', jobRequestId)
      .single()

    if (jobError || !jobRequest) {
      console.error('Could not find matching job request:', jobError)
      return NextResponse.json({ message: 'Job request not found' })
    }

    // Get job_id from jobRequest or find through bid_packages
    let jobId: string | null = jobRequest.job_id || null
    
    // If no direct job_id, try to find through bid_packages
    if (!jobId) {
      const { data: bidPackage } = await supabase
        .from('bid_packages')
        .select('job_id')
        .eq('job_id', jobRequestId) // This might not work, let me check the relationship
        .single()
      
      // Actually, we need to find bid_packages that might be related to this job_request
      // For now, we'll keep jobId as null and let the migration handle it
    }

    // Parse the email content with AI
    const emailContent = html || text || ''
    const aiSummary = await parseBidWithAI(emailContent, from.email, jobRequest.trade_category)

    // Extract bid information using AI
    const bidData = await extractBidData(emailContent, from.email)
    
    // Extract categorized notes using AI
    const categorizedNotes = await extractCategorizedNotes(emailContent, jobRequest.trade_category)

    // Find or create subcontractor record
    let subcontractorId: string | null = null
    
    // First, try to find existing subcontractor by email
    const { data: existingSub } = await supabase
      .from('subcontractors')
      .select('id, name')
      .eq('email', from.email)
      .single()
    
    if (existingSub) {
      subcontractorId = existingSub.id
      
      // Update subcontractor with any new data from the bid
      await supabase
        .from('subcontractors')
        .update({
          name: bidData.companyName || existingSub.name || from.name || 'Unknown',
          phone: bidData.phone || null,
          website_url: bidData.website || null,
        })
        .eq('id', subcontractorId)
    } else {
      // Create new subcontractor record
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
      
      const { data: newSub, error: subError } = await supabase
        .from('subcontractors')
        .insert({
          email: from.email,
          name: bidData.companyName || from.name || 'Unknown',
          trade_category: jobRequest.trade_category,
          location: jobRequest.location,
          phone: bidData.phone || null,
          website_url: website,
        })
        .select('id')
        .single()
      
      if (subError) {
        console.error('Error creating subcontractor:', subError)
        return NextResponse.json({ error: 'Failed to create subcontractor' }, { status: 500 })
      }
      
      subcontractorId = newSub.id
    }

      // Store the bid in the database
      const { data: bid, error: bidError } = await supabase
        .from('bids')
        .insert({
          job_id: jobId,
          job_request_id: jobRequest.id,
          subcontractor_id: subcontractorId,
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

    // Store categorized notes if any were extracted
    if (categorizedNotes && categorizedNotes.length > 0) {
      try {
        const notesToInsert = categorizedNotes.map((note: { type: string; category?: string | null; location?: string | null; content: string; confidence: number }) => ({
          bid_id: bid.id,
          note_type: note.type,
          category: note.category,
          location: note.location,
          content: note.content,
          confidence_score: note.confidence
        }))

        const { error: notesError } = await supabase
          .from('bid_notes')
          .insert(notesToInsert)

        if (notesError) {
          console.error('Error storing categorized notes:', notesError)
        } else {
          console.log(`Stored ${categorizedNotes.length} categorized notes for bid ${bid.id}`)
        }
      } catch (error) {
        console.error('Error processing categorized notes:', error)
      }
    }

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

async function extractCategorizedNotes(emailContent: string, tradeCategory: string) {
  try {
    const prompt = `
    Analyze this subcontractor email and extract any specific notes, requirements, concerns, or suggestions mentioned.
    Focus on construction-related details that would be useful for project planning.
    
    Return ONLY a JSON array of note objects. Each note should have:
    {
      "type": "requirement|concern|suggestion|timeline|material|other",
      "category": "shower|electrical|plumbing|flooring|kitchen|bathroom|structural|safety|permit|other",
      "location": "master_bathroom|kitchen|basement|upstairs|downstairs|exterior|other",
      "content": "exact text of the note",
      "confidence": 0.95
    }

    Trade Category: ${tradeCategory}
    Email content:
    ${emailContent}

    Instructions:
    - Extract specific requirements (e.g., "shower needs complete renovation", "electrical panel upgrade required")
    - Identify concerns or warnings (e.g., "timeline might be tight", "permit issues expected")
    - Capture suggestions or recommendations (e.g., "recommend using tile instead of vinyl")
    - Note timeline-related information (e.g., "can start next week", "will take 3 weeks")
    - Extract material preferences or requirements (e.g., "must use copper pipes", "prefer ceramic tile")
    - Be specific about locations when mentioned (e.g., "master bathroom", "kitchen", "basement")
    - Only include notes that are construction/project relevant
    - Set confidence score based on how clear and specific the note is (0.0 to 1.0)
    - If no relevant notes found, return empty array []
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Try to parse the JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const notes = JSON.parse(jsonMatch[0])
      // Validate the structure
      return notes.filter((note: { type: string; content: string; confidence: number }) => 
        note.type && 
        note.content && 
        typeof note.confidence === 'number' &&
        note.confidence >= 0 &&
        note.confidence <= 1
      )
    }

    return []
  } catch (error) {
    console.error('Error extracting categorized notes:', error)
    return []
  }
}
