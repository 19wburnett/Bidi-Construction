import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs'

// Demo bid data for different trade categories
const DEMO_BID_DATA = {
  Electrical: [
    {
      companyName: 'Bright Electric Solutions',
      email: 'demo@brightelectric.com',
      phone: '(555) 123-4567',
      bidAmount: 8500,
      timeline: '2-3 weeks',
      notes: 'Licensed electrician with 15 years experience. Can start immediately. Includes all permits and inspections.',
      aiSummary: 'Professional electrical contractor offering competitive pricing with quick turnaround.'
    },
    {
      companyName: 'PowerPro Electrical',
      email: 'demo@powerpro.com',
      phone: '(555) 234-5678',
      bidAmount: 9200,
      timeline: '3-4 weeks',
      notes: 'Specialized in commercial electrical work. Certified and insured. Can provide detailed project timeline.',
      aiSummary: 'Experienced commercial electrical contractor with comprehensive project management.'
    },
    {
      companyName: 'Voltage Masters',
      email: 'demo@voltagemasters.com',
      phone: '(555) 345-6789',
      bidAmount: 7800,
      timeline: '2 weeks',
      notes: 'Family-owned business with 20+ years experience. Competitive pricing and quality workmanship guaranteed.',
      aiSummary: 'Established family business offering reliable electrical services at competitive rates.'
    }
  ],
  Plumbing: [
    {
      companyName: 'AquaFlow Plumbing',
      email: 'demo@aquaflow.com',
      phone: '(555) 456-7890',
      bidAmount: 6500,
      timeline: '1-2 weeks',
      notes: '24/7 emergency service available. Licensed and bonded. Uses high-quality materials and modern techniques.',
      aiSummary: 'Reliable plumbing contractor with emergency services and modern installation methods.'
    },
    {
      companyName: 'PipeDream Solutions',
      email: 'demo@pipedream.com',
      phone: '(555) 567-8901',
      bidAmount: 7200,
      timeline: '2-3 weeks',
      notes: 'Eco-friendly plumbing solutions. Water-saving fixtures and sustainable materials. 5-year warranty on all work.',
      aiSummary: 'Environmentally conscious plumbing contractor specializing in sustainable solutions.'
    },
    {
      companyName: 'DrainMaster Pro',
      email: 'demo@drainmaster.com',
      phone: '(555) 678-9012',
      bidAmount: 5800,
      timeline: '1 week',
      notes: 'Quick turnaround guaranteed. Free estimates and competitive pricing. All work backed by satisfaction guarantee.',
      aiSummary: 'Fast and efficient plumbing services with competitive pricing and satisfaction guarantee.'
    }
  ],
  HVAC: [
    {
      companyName: 'Climate Control Experts',
      email: 'demo@climatecontrol.com',
      phone: '(555) 789-0123',
      bidAmount: 12000,
      timeline: '3-4 weeks',
      notes: 'Energy-efficient HVAC systems. NATE certified technicians. Includes system design and installation.',
      aiSummary: 'Certified HVAC contractor specializing in energy-efficient climate control solutions.'
    },
    {
      companyName: 'AirFlow Masters',
      email: 'demo@airflowmasters.com',
      phone: '(555) 890-1234',
      bidAmount: 10800,
      timeline: '2-3 weeks',
      notes: 'Premium HVAC equipment and installation. 10-year warranty on parts and labor. Free maintenance for first year.',
      aiSummary: 'Premium HVAC contractor offering extended warranties and comprehensive maintenance programs.'
    },
    {
      companyName: 'Comfort Zone HVAC',
      email: 'demo@comfortzone.com',
      phone: '(555) 901-2345',
      bidAmount: 9500,
      timeline: '2 weeks',
      notes: 'Residential and commercial HVAC services. Licensed, insured, and bonded. Same-day service available.',
      aiSummary: 'Versatile HVAC contractor serving both residential and commercial clients with quick response times.'
    }
  ],
  Roofing: [
    {
      companyName: 'Peak Roofing Solutions',
      email: 'demo@peakroofing.com',
      phone: '(555) 012-3456',
      bidAmount: 18500,
      timeline: '1-2 weeks',
      notes: 'High-quality roofing materials and expert installation. 25-year warranty on workmanship. Weather-resistant solutions.',
      aiSummary: 'Professional roofing contractor offering durable solutions with comprehensive warranties.'
    },
    {
      companyName: 'SkyHigh Roofing',
      email: 'demo@skyhigh.com',
      phone: '(555) 123-4567',
      bidAmount: 22000,
      timeline: '2-3 weeks',
      notes: 'Premium roofing systems and materials. Certified installers with 15+ years experience. Free roof inspection included.',
      aiSummary: 'Premium roofing contractor with certified installers and comprehensive inspection services.'
    },
    {
      companyName: 'WeatherGuard Roofing',
      email: 'demo@weatherguard.com',
      phone: '(555) 234-5678',
      bidAmount: 16800,
      timeline: '1 week',
      notes: 'Quick and reliable roofing services. Competitive pricing with quality materials. Storm damage specialists.',
      aiSummary: 'Efficient roofing contractor specializing in quick repairs and storm damage restoration.'
    }
  ],
  Painting: [
    {
      companyName: 'ColorCraft Painters',
      email: 'demo@colorcraft.com',
      phone: '(555) 345-6789',
      bidAmount: 4200,
      timeline: '1-2 weeks',
      notes: 'Professional interior and exterior painting. Premium paints and materials. Detailed surface preparation included.',
      aiSummary: 'Professional painting contractor offering comprehensive surface preparation and premium materials.'
    },
    {
      companyName: 'Brush & Roll Pro',
      email: 'demo@brushroll.com',
      phone: '(555) 456-7890',
      bidAmount: 3800,
      timeline: '1 week',
      notes: 'Efficient painting services with attention to detail. Free color consultation and touch-up service included.',
      aiSummary: 'Detail-oriented painting contractor with color consultation and touch-up services.'
    },
    {
      companyName: 'Perfect Finish Painters',
      email: 'demo@perfectfinish.com',
      phone: '(555) 567-8901',
      bidAmount: 4500,
      timeline: '2 weeks',
      notes: 'High-end residential painting. Custom color matching and specialty finishes available. 2-year warranty on all work.',
      aiSummary: 'Luxury painting contractor specializing in custom finishes and high-end residential projects.'
    }
  ],
  Drywall: [
    {
      companyName: 'SmoothWall Specialists',
      email: 'demo@smoothwall.com',
      phone: '(555) 678-9012',
      bidAmount: 3200,
      timeline: '1-2 weeks',
      notes: 'Expert drywall installation and finishing. Smooth, seamless results guaranteed. Clean-up included.',
      aiSummary: 'Specialized drywall contractor focused on seamless installation and professional finishing.'
    },
    {
      companyName: 'WallCraft Drywall',
      email: 'demo@wallcraft.com',
      phone: '(555) 789-0123',
      bidAmount: 2800,
      timeline: '1 week',
      notes: 'Quick and efficient drywall services. Competitive pricing with quality materials. Free estimates.',
      aiSummary: 'Efficient drywall contractor offering competitive pricing and quick turnaround times.'
    },
    {
      companyName: 'Perfect Walls Inc',
      email: 'demo@perfectwalls.com',
      phone: '(555) 890-1234',
      bidAmount: 3500,
      timeline: '2 weeks',
      notes: 'Premium drywall work with attention to detail. Textured finishes available. 1-year warranty on all work.',
      aiSummary: 'Premium drywall contractor offering textured finishes and comprehensive warranties.'
    }
  ]
}

export async function POST(request: NextRequest) {
  try {
    const { jobRequestId, tradeCategory } = await request.json()

    if (!jobRequestId || !tradeCategory) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Get job request details
    const { data: jobRequest, error: jobError } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', jobRequestId)
      .single()

    if (jobError || !jobRequest) {
      return NextResponse.json(
        { error: 'Job request not found' },
        { status: 404 }
      )
    }

    // Get the user who created the job to check if they're an admin with demo mode enabled
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin, demo_mode')
      .eq('id', jobRequest.gc_id)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.is_admin || !user.demo_mode) {
      return NextResponse.json(
        { error: 'Demo mode not enabled for this user' },
        { status: 403 }
      )
    }

    // Get demo bid data for the trade category
    const demoBids = DEMO_BID_DATA[tradeCategory as keyof typeof DEMO_BID_DATA] || DEMO_BID_DATA.Electrical

    // Generate random number of bids (2-4)
    const numBids = Math.floor(Math.random() * 3) + 2
    const selectedBids = demoBids.slice(0, numBids)

    // Start the bid generation process asynchronously (don't wait for it)
    generateBidsAsync(jobRequestId, selectedBids, jobRequest.budget_range)

    return NextResponse.json({
      message: `Started generating ${numBids} demo bids for ${tradeCategory} project`,
      total: numBids,
    })
  } catch (error) {
    console.error('Error generating demo bids:', error)
    return NextResponse.json(
      { error: 'Failed to generate demo bids' },
      { status: 500 }
    )
  }
}

// Async function to generate bids over time
async function generateBidsAsync(jobRequestId: string, selectedBids: any[], budgetRange: string) {
  const supabase = await createServerSupabaseClient()

  // Create demo bids with staggered timing
  for (let index = 0; index < selectedBids.length; index++) {
    const bidData = selectedBids[index]
    
    // Add random delay to simulate real-world timing
    const delay = Math.random() * 30000 + (index * 15000) // 0-30 seconds + staggered
    await new Promise(resolve => setTimeout(resolve, delay))

    // Add some randomness to bid amounts based on budget range
    let adjustedAmount = bidData.bidAmount
    if (budgetRange.includes('Under $5,000')) {
      adjustedAmount = Math.floor(bidData.bidAmount * 0.3)
    } else if (budgetRange.includes('$5,000 - $10,000')) {
      adjustedAmount = Math.floor(bidData.bidAmount * 0.6)
    } else if (budgetRange.includes('$10,000 - $25,000')) {
      adjustedAmount = Math.floor(bidData.bidAmount * 0.8)
    } else if (budgetRange.includes('$25,000 - $50,000')) {
      adjustedAmount = Math.floor(bidData.bidAmount * 1.2)
    } else if (budgetRange.includes('$50,000 - $100,000')) {
      adjustedAmount = Math.floor(bidData.bidAmount * 2.5)
    } else if (budgetRange.includes('Over $100,000')) {
      adjustedAmount = Math.floor(bidData.bidAmount * 5)
    }

    // Add some randomness to the amount (±10%)
    const variance = (Math.random() - 0.5) * 0.2
    adjustedAmount = Math.floor(adjustedAmount * (1 + variance))

    // Get job request to get trade_category, location, and job_id
    const { data: jobRequest } = await supabase
      .from('job_requests')
      .select('trade_category, location, job_id')
      .eq('id', jobRequestId)
      .single()

    // Find or create subcontractor record
    let subcontractorId: string | null = null
    
    const { data: existingSub } = await supabase
      .from('subcontractors')
      .select('id')
      .eq('email', bidData.email)
      .single()
    
    if (existingSub) {
      subcontractorId = existingSub.id
      
      // Update subcontractor with any new data
      await supabase
        .from('subcontractors')
        .update({
          name: bidData.companyName,
          phone: bidData.phone || null,
        })
        .eq('id', subcontractorId)
    } else {
      // Create new subcontractor record
      const { data: newSub, error: subError } = await supabase
        .from('subcontractors')
        .insert({
          email: bidData.email,
          name: bidData.companyName,
          trade_category: jobRequest?.trade_category || 'General',
          location: jobRequest?.location || 'Unknown',
          phone: bidData.phone || null,
        })
        .select('id')
        .single()
      
      if (subError) {
        console.error('Error creating subcontractor for demo bid:', subError)
        continue
      }
      
      subcontractorId = newSub.id
    }

    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .insert({
        job_id: jobRequest?.job_id || null,
        job_request_id: jobRequestId,
        subcontractor_id: subcontractorId,
        bid_amount: adjustedAmount,
        timeline: bidData.timeline,
        notes: bidData.notes,
        ai_summary: bidData.aiSummary,
        raw_email: `Subject: Bid for Project

Dear Project Manager,

Thank you for considering our services for your project. We are pleased to submit our bid for this opportunity.

Company: ${bidData.companyName}
Contact: ${bidData.phone}
Email: ${bidData.email}

Bid Amount: $${adjustedAmount.toLocaleString()}
Timeline: ${bidData.timeline}

Project Notes:
${bidData.notes}

We look forward to the opportunity to work with you on this project. Please feel free to contact us if you have any questions.

Best regards,
${bidData.companyName} Team`,
      })
      .select()
      .single()

    if (bidError) {
      console.error('Error creating demo bid:', bidError)
    } else {
      console.log(`Demo bid created: ${bidData.companyName} - $${adjustedAmount}`)

      // Insert categorized demo bid notes to showcase the feature in demo mode
      try {
        const demoNotes = buildDemoNotesFromText(bidData.notes)
        if (demoNotes.length > 0) {
          const { error: notesError } = await supabase
            .from('bid_notes')
            .insert(
              demoNotes.map(n => ({
                bid_id: bid.id,
                note_type: n.type,
                category: n.category,
                location: n.location,
                content: n.content,
                confidence_score: n.confidence,
                page_number: n.page_number // Include page number for auto-placement
              }))
            )

          if (notesError) {
            console.error('Error inserting demo bid notes:', notesError)
          } else {
            console.log(`Created ${demoNotes.length} demo notes for ${bidData.companyName}, ${demoNotes.filter(n => n.page_number).length} with page references`)
          }
        }
      } catch (err) {
        console.error('Failed to create demo bid_notes:', err)
      }

      // Generate and insert realistic line items for the bid
      try {
        // Get job request to determine trade category
        const { data: jobRequest } = await supabase
          .from('job_requests')
          .select('trade_category')
          .eq('id', jobRequestId)
          .single()

        if (jobRequest) {
          const lineItems = generateLineItemsForBid(
            jobRequest.trade_category,
            adjustedAmount,
            bidData.companyName
          )
          
          if (lineItems.length > 0) {
            const { error: lineItemsError } = await supabase
              .from('bid_line_items')
              .insert(
                lineItems.map((item, index) => ({
                  bid_id: bid.id,
                  item_number: index + 1,
                  description: item.item_description,
                  category: item.category,
                  quantity: item.quantity,
                  unit: item.unit,
                  unit_price: item.unit_price,
                  amount: item.amount,
                  notes: item.notes
                }))
              )

            if (lineItemsError) {
              console.error('Error inserting demo line items:', lineItemsError)
            } else {
              console.log(`Created ${lineItems.length} line items for ${bidData.companyName}`)
            }
          }
        }
      } catch (err) {
        console.error('Failed to create demo line_items:', err)
      }
    }
  }
}

// Heuristic demo notes extractor to simulate categorized notes without AI
// Now includes page number references to showcase the auto-placement feature
function buildDemoNotesFromText(notes: string | undefined): Array<{
  type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
  category: string | null
  location: string | null
  content: string
  confidence: number
  page_number: number | null
}> {
  const results: Array<{ type: any; category: string | null; location: string | null; content: string; confidence: number; page_number: number | null }> = []
  const text = (notes || '').toLowerCase()

  // Generate realistic demo notes with page number references
  // This showcases the auto-placement feature for demo clients
  
  if (text.includes('permit') || text.includes('licensed')) {
    results.push({ 
      type: 'requirement', 
      category: 'permit', 
      location: 'Main entrance', 
      content: 'All permits and inspections must be completed before work begins. Electrical panel location shown requires city approval.', 
      confidence: 0.92,
      page_number: 1 // First page typically shows site plan
    })
  }
  
  if (text.includes('timeline') || text.includes('weeks') || text.includes('week')) {
    results.push({ 
      type: 'timeline', 
      category: 'schedule', 
      location: 'Kitchen area', 
      content: 'Proposed 2-3 week timeline assumes materials are available. Kitchen electrical work must be completed before cabinet installation.', 
      confidence: 0.88,
      page_number: 2 // Second page often shows floor plan details
    })
  }
  
  if (text.includes('materials') || text.includes('premium') || text.includes('quality')) {
    results.push({ 
      type: 'material', 
      category: 'materials', 
      location: 'Bathroom', 
      content: 'Premium materials specified in plans. Recommend upgrading to copper piping in bathroom areas for longevity.', 
      confidence: 0.85,
      page_number: 3 // Third page might show bathroom details
    })
  }
  
  if (text.includes('inspection') || text.includes('certified') || text.includes('bonded')) {
    results.push({ 
      type: 'concern', 
      category: 'safety', 
      location: 'Electrical panel', 
      content: 'Current electrical panel location may not meet code requirements. Recommend reviewing with inspector before proceeding.', 
      confidence: 0.79,
      page_number: 1 // Back to first page for electrical concerns
    })
  }
  
  if (text.includes('recommend') || text.includes('suggest')) {
    results.push({ 
      type: 'suggestion', 
      category: 'improvement', 
      location: 'Living room', 
      content: 'Suggest adding additional outlet in living room area for better functionality. Minimal cost increase.', 
      confidence: 0.76,
      page_number: 2
    })
  }
  
  if (text.includes('warranty') || text.includes('guarantee')) {
    results.push({ 
      type: 'requirement', 
      category: 'warranty', 
      location: null, 
      content: 'All work includes warranty as specified. Documentation will be provided upon completion.', 
      confidence: 0.83,
      page_number: null // Some notes don't need page references
    })
  }

  // Add a few more realistic demo notes to showcase the feature better
  if (text.includes('experience') || text.includes('years')) {
    results.push({ 
      type: 'suggestion', 
      category: 'design', 
      location: 'Master bedroom', 
      content: 'Based on our experience, recommend moving light switch location for better accessibility as shown in plans.', 
      confidence: 0.81,
      page_number: 3
    })
  }

  // Always include at least one note with page reference for demo visibility
  if (results.length === 0 && (notes || '').trim().length > 0) {
    results.push({ 
      type: 'requirement', 
      category: 'general', 
      location: 'Main area', 
      content: 'General project requirements as outlined in the specifications. Will follow all details shown in construction documents.', 
      confidence: 0.72,
      page_number: 1
    })
  }

  return results
}

// Generate realistic line items for a bid based on trade category and total amount
function generateLineItemsForBid(
  tradeCategory: string,
  totalAmount: number,
  companyName: string
): Array<{
  category: string
  item_description: string
  quantity: number
  unit: string
  unit_price: number
  amount: number
  notes: string | null
}> {
  const lineItems: Array<{
    category: string
    item_description: string
    quantity: number
    unit: string
    unit_price: number
    amount: number
    notes: string | null
  }> = []

  // Different line item templates based on trade category
  switch (tradeCategory) {
    case 'Electrical':
      // Labor typically 40-50% of total
      const electricalLaborAmount = Math.round(totalAmount * 0.45)
      const electricalLaborRate = 85 + Math.floor(Math.random() * 30) // $85-115/hr
      const electricalLaborHours = Math.round(electricalLaborAmount / electricalLaborRate)
      
      lineItems.push({
        category: 'labor',
        item_description: 'Licensed electrician labor',
        quantity: electricalLaborHours,
        unit: 'hours',
        unit_price: electricalLaborRate,
        amount: electricalLaborHours * electricalLaborRate,
        notes: 'Includes journeyman and apprentice electricians'
      })
      
      // Materials 30-40%
      const panelCost = 450 + Math.floor(Math.random() * 300)
      lineItems.push({
        category: 'materials',
        item_description: '200A electrical panel upgrade',
        quantity: 1,
        unit: 'ea',
        unit_price: panelCost,
        amount: panelCost,
        notes: 'Includes main breaker and ground fault protection'
      })
      
      const wiringAmount = Math.round(totalAmount * 0.18)
      lineItems.push({
        category: 'materials',
        item_description: 'Wire and cable (12/2, 14/2 Romex)',
        quantity: 1,
        unit: 'lot',
        unit_price: wiringAmount,
        amount: wiringAmount,
        notes: 'Copper wire, code compliant'
      })
      
      // Fixtures and devices 10-15%
      const fixturesAmount = Math.round(totalAmount * 0.12)
      lineItems.push({
        category: 'materials',
        item_description: 'Outlets, switches, and cover plates',
        quantity: 1,
        unit: 'lot',
        unit_price: fixturesAmount,
        amount: fixturesAmount,
        notes: 'Commercial grade devices'
      })
      
      // Permits and inspections
      const permitCost = 200 + Math.floor(Math.random() * 200)
      lineItems.push({
        category: 'permits',
        item_description: 'Electrical permit and inspections',
        quantity: 1,
        unit: 'ea',
        unit_price: permitCost,
        amount: permitCost,
        notes: 'City permit and final inspection'
      })
      break

    case 'Plumbing':
      // Labor 45-55%
      const plumbingLaborAmount = Math.round(totalAmount * 0.50)
      const plumbingLaborRate = 75 + Math.floor(Math.random() * 25)
      const plumbingLaborHours = Math.round(plumbingLaborAmount / plumbingLaborRate)
      
      lineItems.push({
        category: 'labor',
        item_description: 'Licensed plumber labor',
        quantity: plumbingLaborHours,
        unit: 'hours',
        unit_price: plumbingLaborRate,
        amount: plumbingLaborHours * plumbingLaborRate,
        notes: 'Master plumber and helper'
      })
      
      // Fixtures 25-35%
      const fixtureCost = 450 + Math.floor(Math.random() * 350)
      const numFixtures = Math.min(3, Math.floor(totalAmount / 3000) + 1)
      lineItems.push({
        category: 'materials',
        item_description: 'Plumbing fixtures (toilets, sinks, faucets)',
        quantity: numFixtures,
        unit: 'ea',
        unit_price: fixtureCost,
        amount: numFixtures * fixtureCost,
        notes: 'Mid-grade fixtures, chrome finish'
      })
      
      // Piping materials 15-20%
      const pipingAmount = Math.round(totalAmount * 0.17)
      lineItems.push({
        category: 'materials',
        item_description: 'PEX piping and fittings',
        quantity: 1,
        unit: 'lot',
        unit_price: pipingAmount,
        amount: pipingAmount,
        notes: 'Includes valves, connectors, and supports'
      })
      
      // Permit
      const plumbingPermit = 150 + Math.floor(Math.random() * 150)
      lineItems.push({
        category: 'permits',
        item_description: 'Plumbing permit',
        quantity: 1,
        unit: 'ea',
        unit_price: plumbingPermit,
        amount: plumbingPermit,
        notes: null
      })
      break

    case 'HVAC':
      // Equipment 50-60%
      const hvacEquipmentAmount = Math.round(totalAmount * 0.55)
      const tonnage = Math.min(5, Math.max(2, Math.floor(totalAmount / 5000)))
      lineItems.push({
        category: 'equipment',
        item_description: `${tonnage}-ton HVAC system (16 SEER)`,
        quantity: 1,
        unit: 'ea',
        unit_price: hvacEquipmentAmount,
        amount: hvacEquipmentAmount,
        notes: 'Energy-efficient heat pump with air handler'
      })
      
      // Labor 25-30%
      const hvacLaborAmount = Math.round(totalAmount * 0.27)
      lineItems.push({
        category: 'labor',
        item_description: 'HVAC installation labor',
        quantity: 1,
        unit: 'job',
        unit_price: hvacLaborAmount,
        amount: hvacLaborAmount,
        notes: 'NATE-certified technicians'
      })
      
      // Ductwork and materials 10-15%
      const ductworkAmount = Math.round(totalAmount * 0.12)
      lineItems.push({
        category: 'materials',
        item_description: 'Ductwork, registers, and thermostat',
        quantity: 1,
        unit: 'lot',
        unit_price: ductworkAmount,
        amount: ductworkAmount,
        notes: 'Insulated ductwork and programmable thermostat'
      })
      
      // Electrical work
      const hvacElectricalAmount = Math.round(totalAmount * 0.05)
      lineItems.push({
        category: 'labor',
        item_description: 'Electrical connections',
        quantity: 1,
        unit: 'job',
        unit_price: hvacElectricalAmount,
        amount: hvacElectricalAmount,
        notes: 'Disconnect and wiring to panel'
      })
      break

    case 'Roofing':
      // Materials 50-60%
      const roofArea = 1500 + Math.floor(Math.random() * 1500) // 1500-3000 sq ft
      const shingleCostPerSqFt = 1.8 + Math.random() * 1.2
      const shingleAmount = Math.round(roofArea * shingleCostPerSqFt)
      
      lineItems.push({
        category: 'materials',
        item_description: 'Architectural shingles (30-year)',
        quantity: Math.round(roofArea / 100),
        unit: 'squares',
        unit_price: Math.round(shingleAmount / (roofArea / 100)),
        amount: shingleAmount,
        notes: 'Class A fire-rated, wind resistant'
      })
      
      // Underlayment and supplies 8-12%
      const underlaymentAmount = Math.round(totalAmount * 0.10)
      lineItems.push({
        category: 'materials',
        item_description: 'Underlayment, ice/water shield, and flashing',
        quantity: 1,
        unit: 'lot',
        unit_price: underlaymentAmount,
        amount: underlaymentAmount,
        notes: 'Synthetic underlayment and metal flashing'
      })
      
      // Labor 25-35%
      const roofingLaborAmount = Math.round(totalAmount * 0.30)
      lineItems.push({
        category: 'labor',
        item_description: 'Roof installation labor',
        quantity: 1,
        unit: 'job',
        unit_price: roofingLaborAmount,
        amount: roofingLaborAmount,
        notes: 'Includes tear-off and disposal'
      })
      
      // Disposal
      const disposalCost = 400 + Math.floor(Math.random() * 400)
      lineItems.push({
        category: 'other',
        item_description: 'Old roofing disposal',
        quantity: 1,
        unit: 'job',
        unit_price: disposalCost,
        amount: disposalCost,
        notes: 'Dumpster rental and dump fees'
      })
      break

    case 'Painting':
      // Labor is 70-80% for painting
      const paintingLaborAmount = Math.round(totalAmount * 0.75)
      const paintingLaborRate = 45 + Math.floor(Math.random() * 20)
      const paintingLaborHours = Math.round(paintingLaborAmount / paintingLaborRate)
      
      lineItems.push({
        category: 'labor',
        item_description: 'Interior painting labor',
        quantity: paintingLaborHours,
        unit: 'hours',
        unit_price: paintingLaborRate,
        amount: paintingLaborHours * paintingLaborRate,
        notes: 'Surface prep, priming, and two coats'
      })
      
      // Paint and materials 15-25%
      const paintAmount = Math.round(totalAmount * 0.18)
      lineItems.push({
        category: 'materials',
        item_description: 'Premium interior paint',
        quantity: Math.ceil(paintAmount / 45),
        unit: 'gallons',
        unit_price: 45,
        amount: Math.ceil(paintAmount / 45) * 45,
        notes: 'Low-VOC, washable finish'
      })
      
      // Supplies
      const suppliesAmount = Math.round(totalAmount * 0.07)
      lineItems.push({
        category: 'materials',
        item_description: 'Painting supplies (brushes, tape, drop cloths)',
        quantity: 1,
        unit: 'lot',
        unit_price: suppliesAmount,
        amount: suppliesAmount,
        notes: null
      })
      break

    case 'Drywall':
      // Materials 40-50%
      const drywallSheets = 30 + Math.floor(Math.random() * 50)
      const sheetCost = 12 + Math.floor(Math.random() * 6)
      
      lineItems.push({
        category: 'materials',
        item_description: '1/2" drywall sheets (4x8)',
        quantity: drywallSheets,
        unit: 'sheets',
        unit_price: sheetCost,
        amount: drywallSheets * sheetCost,
        notes: 'Moisture-resistant for bathrooms'
      })
      
      // Mud and tape 8-12%
      const mudAmount = Math.round(totalAmount * 0.10)
      lineItems.push({
        category: 'materials',
        item_description: 'Joint compound and tape',
        quantity: 1,
        unit: 'lot',
        unit_price: mudAmount,
        amount: mudAmount,
        notes: 'Includes corner bead and fasteners'
      })
      
      // Labor 35-45%
      const drywallLaborAmount = Math.round(totalAmount * 0.40)
      const drywallLaborRate = 55 + Math.floor(Math.random() * 20)
      const drywallLaborHours = Math.round(drywallLaborAmount / drywallLaborRate)
      
      lineItems.push({
        category: 'labor',
        item_description: 'Drywall installation and finishing',
        quantity: drywallLaborHours,
        unit: 'hours',
        unit_price: drywallLaborRate,
        amount: drywallLaborHours * drywallLaborRate,
        notes: 'Hang, tape, mud, and sand to Level 4 finish'
      })
      break

    default:
      // Generic breakdown for other trades
      const genericLaborAmount = Math.round(totalAmount * 0.55)
      const genericLaborRate = 65 + Math.floor(Math.random() * 25)
      const genericLaborHours = Math.round(genericLaborAmount / genericLaborRate)
      
      lineItems.push({
        category: 'labor',
        item_description: 'Professional labor',
        quantity: genericLaborHours,
        unit: 'hours',
        unit_price: genericLaborRate,
        amount: genericLaborHours * genericLaborRate,
        notes: 'Skilled tradespeople'
      })
      
      const genericMaterialsAmount = Math.round(totalAmount * 0.35)
      lineItems.push({
        category: 'materials',
        item_description: 'Materials and supplies',
        quantity: 1,
        unit: 'lot',
        unit_price: genericMaterialsAmount,
        amount: genericMaterialsAmount,
        notes: 'Quality materials as specified'
      })
      
      const genericOtherAmount = Math.round(totalAmount * 0.10)
      lineItems.push({
        category: 'other',
        item_description: 'Permits and miscellaneous',
        quantity: 1,
        unit: 'job',
        unit_price: genericOtherAmount,
        amount: genericOtherAmount,
        notes: null
      })
  }

  // Adjust line items so they sum exactly to the total amount
  const currentTotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  if (currentTotal !== totalAmount && lineItems.length > 0) {
    const difference = totalAmount - currentTotal
    // Apply the difference to the last item
    const lastItem = lineItems[lineItems.length - 1]
    lastItem.amount += difference
    lastItem.unit_price = Math.round(lastItem.amount / lastItem.quantity)
  }

  return lineItems
}
