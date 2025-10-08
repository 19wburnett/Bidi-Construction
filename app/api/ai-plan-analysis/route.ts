import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
// @ts-ignore - pdf2json doesn't have TypeScript types  
import PDFParser from 'pdf2json'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

interface AIAnalysisResult {
  trade: string
  bidAmount: string
  estimatedTimeline: string
  materials: string[]
  labor: string
  potentialIssues: string[]
  recommendations: string[]
  confidence: number
}

// Trade-specific expert prompts focused on extracting details for accurate bidding
const TRADE_PROMPTS: Record<string, string> = {
  electrical: `You are a licensed master electrician reviewing plans to prepare an accurate bid. Your goal is to identify ALL details needed for precise pricing.

EXTRACT these specific details from the plans:
- Total square footage and number of rooms
- Panel size and location (existing vs. new service)
- Circuit count and amperage requirements (specific counts: 15A, 20A, 30A, etc.)
- Outlet quantities by room (standard, GFCI, AFCI, dedicated circuits)
- Switch quantities and types (single-pole, 3-way, 4-way, dimmer)
- Light fixture count and types (recessed, pendant, exterior, etc.)
- Appliance circuits (range, dryer, dishwasher, disposal, microwave, etc.)
- HVAC electrical requirements
- Smoke detector and CO detector locations (hardwired + interconnected?)
- Exterior outlets, switches, and lighting
- Garage/workshop circuits and lighting
- Wire run distances and accessibility (attic/crawl space/walls)
- Ceiling heights and access challenges
- Existing conditions (remodel vs. new construction)

IDENTIFY what's MISSING that you need for an accurate bid:
- Are load calculations provided?
- Is the panel schedule complete?
- Are wire routing paths clear?
- Is accessibility documented?
- Are fixture specifications provided?

Your bid should reflect the actual work scope based on what you can see in the plans.`,

  plumbing: `You are a master plumber reviewing plans to prepare an accurate bid. Your goal is to identify ALL details needed for precise pricing.

EXTRACT these specific details from the plans:
- Fixture count by type (toilets, sinks, tubs, showers, laundry, hose bibs)
- Bathroom count and layout (full bath, half bath, master suite)
- Kitchen fixtures (sink, dishwasher, disposal, ice maker line)
- Water heater type, size, and location (tank, tankless, gas, electric)
- Supply line routing and lengths (hot and cold water distribution)
- Drain line routing and pitch requirements
- Vent stack locations and configurations
- Slab vs. crawl space vs. basement construction
- Fixture specifications (standard vs. luxury, wall-mount vs. floor, etc.)
- Rough-in dimensions and clearances
- Accessibility (tight spaces, multi-story, attic access)
- Existing plumbing to be removed or modified
- Gas line requirements (water heater, range, dryer, fireplace)
- Floor drain locations (garage, laundry, basement)
- Outdoor fixtures (hose bibs, irrigation connections)

IDENTIFY what's MISSING that you need for an accurate bid:
- Are fixture specifications complete?
- Are water pressure and supply size documented?
- Is sewer/septic connection location clear?
- Are material preferences specified (PEX, copper, CPVC)?
- Is existing plumbing condition documented for remodels?

Your bid should reflect actual fixture counts, pipe runs, and access challenges.`,

  framing: `You are a framing contractor reviewing plans to prepare an accurate bid. Your goal is to identify ALL details needed for precise material takeoffs and labor estimates.

EXTRACT these specific details from the plans:
- Total square footage (main floor, upper floors, basement)
- Wall layout and dimensions (interior and exterior walls with lengths)
- Ceiling heights by room/area
- Window count, sizes, and rough opening dimensions
- Door count, sizes, and rough opening dimensions (interior and exterior)
- Beam sizes, spans, and locations (headers, ridge beams, floor beams)
- Floor joist specifications (size, spacing, spans)
- Roof framing (truss vs. stick-built, pitch, spans, valleys, hips)
- Shear wall and hold-down locations
- Foundation type (slab, crawl, basement) affecting floor framing
- Cantilevers or overhangs
- Cathedral/vaulted ceilings
- Load-bearing walls vs. partition walls
- Stairway dimensions and construction (open vs. closed, landings)
- Structural modifications or demolition required
- Lumber grade and species requirements
- Engineered lumber locations (LVL, I-joists, PSL)

IDENTIFY what's MISSING that you need for an accurate bid:
- Are structural engineering details provided for beams/headers?
- Are lumber grades and species specified?
- Are foundation anchor bolt locations clear?
- Is site access documented for material delivery?
- Are existing condition surveys provided for remodels?

Your bid should include accurate material quantities (board feet, sheets, hardware) and realistic labor hours.`,

  concrete: `You are a concrete contractor reviewing plans to prepare an accurate bid. Your goal is to identify ALL details needed for precise material quantities and labor estimates.

EXTRACT these specific details from the plans:
- Foundation type (slab-on-grade, crawl space, full basement, stem wall)
- Footing dimensions (width, depth, continuous vs. pad footings)
- Foundation wall dimensions (height, thickness, lengths)
- Slab dimensions and square footage by area (garage, patio, walkways, driveway)
- Slab thickness and specifications (4", 5", 6", etc.)
- Concrete strength requirements (2,500 PSI, 3,000 PSI, 4,000 PSI)
- Rebar specifications and spacing (#3, #4, #5 bars, grid spacing)
- Wire mesh requirements
- Vapor barrier specifications (thickness and type)
- Base material depth and type (gravel, crushed rock)
- Expansion joints and control joint locations
- Anchor bolt sizes, spacing, and quantities
- Embedded items (plumbing sleeves, electrical conduits, post bases)
- Stepped footings or slope considerations
- Grade beam requirements
- Retaining wall specifications if applicable
- Excavation depth and soil conditions mentioned
- Drainage requirements (perimeter drains, sump pit)

IDENTIFY what's MISSING that you need for an accurate bid:
- Is site preparation/excavation scope clear?
- Are soil conditions and compaction specs documented?
- Is concrete mix design specified?
- Are finish requirements detailed (smooth trowel, broom finish, exposed aggregate)?
- Is disposal of excess soil included or separate?

Your bid should include accurate cubic yards of concrete, rebar/mesh quantities, and realistic forming/finishing labor.`,

  drywall: `You are a drywall contractor reviewing plans to prepare an accurate bid. Your goal is to identify ALL details needed for precise material takeoffs and labor estimates.

EXTRACT these specific details from the plans:
- Total square footage by area and room
- Ceiling heights by room (8', 9', 10', vaulted, etc.)
- Wall and ceiling configurations (standard vs. complex)
- Drywall thickness requirements (1/2", 5/8" Type X fire-rated)
- Finish levels needed (Level 3, 4, or 5)
- Texture types (smooth, orange peel, knockdown, popcorn removal)
- Moisture-resistant/mold-resistant board locations (bathrooms, laundry)
- Soundproofing requirements (between units, bedrooms, etc.)
- Resilient channel or sound isolation clips
- Corner bead quantities (standard, bullnose, L-bead)
- Archways, curves, or specialty features
- Tray ceilings, coffered ceilings, or soffits
- Access panel locations and sizes
- Cathedral/vaulted ceiling square footage
- Number of corners (inside and outside)
- Window and door return depths
- Stairway walls and angles
- Closet interiors included or excluded
- Existing drywall removal scope (for remodels)

IDENTIFY what's MISSING that you need for an accurate bid:
- Are finish levels and texture types specified?
- Is paint primer included in scope or separate?
- Are material preferences specified (standard vs. lightweight)?
- Is disposal of waste included?
- Are scaffolding/lift requirements documented for high ceilings?

Your bid should include accurate sheet counts, mud/tape quantities, and realistic labor hours for hanging, taping, and finishing.`,

  roofing: `You are a roofing contractor reviewing plans to prepare an accurate bid. Your goal is to identify ALL details needed for precise material quantities and labor estimates.

EXTRACT these specific details from the plans:
- Total roof square footage and squares (1 square = 100 sq ft)
- Roof pitch/slope by section (4/12, 6/12, 8/12, etc.)
- Roof type (gable, hip, shed, complex with valleys/hips)
- Valley count and linear feet
- Hip and ridge linear feet
- Eave and rake linear feet
- Roof penetrations (vents, pipes, chimneys, skylights) - count each
- Chimney dimensions for flashing
- Skylight sizes and quantities
- Roof pitch transitions and complexity
- Overhang/soffit dimensions
- Existing roof layers to remove (if remodel)
- Deck material and condition (plywood, OSB, skip sheathing)
- Deck replacement scope
- Shingle type specified (3-tab, architectural, designer)
- Underlayment type (felt, synthetic, ice & water shield)
- Ice & water shield coverage area (eaves, valleys, etc.)
- Ventilation system (ridge vent, soffit vents, gable vents, power vents)
- Drip edge and starter strip requirements
- Fascia and soffit condition/replacement

IDENTIFY what's MISSING that you need for an accurate bid:
- Are shingle color and style specified?
- Is tear-off included or layover?
- Are deck repairs/replacement included?
- Is waste disposal included?
- Are ventilation requirements met per code?
- Is warranty level specified (manufacturer vs. workmanship)?

Your bid should include accurate squares of shingles, underlayment rolls, flashing linear feet, and realistic labor days including tear-off and installation.`,

  hvac: `You are an HVAC contractor reviewing plans to prepare an accurate bid. Your goal is to identify ALL details needed for accurate system sizing and pricing.

EXTRACT these specific details from the plans:
- Total conditioned square footage (heated and cooled areas)
- Building orientation and sun exposure
- Ceiling heights by zone
- Window count, sizes, and R-values or glazing types
- Insulation levels (walls, ceiling, floor if specified)
- Number of zones or heating/cooling areas
- Thermostat locations (count and type)
- Equipment locations (indoor unit, outdoor unit, furnace, air handler)
- Ductwork routing (attic, crawl, basement, exposed)
- Supply register count and locations by room
- Return air locations and count
- Existing equipment to remove/replace (if remodel)
- Fuel type (natural gas, propane, electric, heat pump)
- Ventilation requirements (bathroom fans, range hood CFM)
- Make-up air requirements for range hoods
- Filter locations and sizes
- Condensate drain routing
- Electrical requirements for equipment
- Accessibility for equipment installation and service
- Climate zone or location for load calculations
- Special requirements (humidity control, air filtration, ERV/HRV)

IDENTIFY what's MISSING that you need for an accurate bid:
- Are Manual J load calculations provided?
- Is duct design (Manual D) included?
- Are equipment efficiency levels specified (SEER, AFUE, HSPF)?
- Are brands/models specified or contractor's choice?
- Is insulation R-value documented?
- Are window specifications complete for load calcs?

Your bid should include properly sized equipment (BTU/tonnage), complete ductwork linear feet and fitting counts, and realistic installation labor based on access challenges.`,

  flooring: `You are a flooring contractor reviewing plans to prepare an accurate bid. Your goal is to identify ALL details needed for precise material quantities and labor estimates.

EXTRACT these specific details from the plans:
- Square footage by room and flooring type
- Room dimensions and layouts (simple rectangles vs. complex shapes)
- Flooring types specified by area (hardwood, tile, LVP, carpet, etc.)
- Tile sizes and patterns if specified (12x12, 12x24, diagonal, etc.)
- Plank sizes for hardwood or LVP (width and length)
- Carpet areas and types (bedroom, closets, stairs)
- Stairway count and dimensions (treads, risers, landings)
- Transition locations (room to room, different floor types)
- Threshold requirements (interior and exterior doors)
- Baseboard heights and styles (affects scribing)
- Subfloor type (concrete slab, plywood, OSB)
- Level/condition of subfloor (flat, needs leveling, moisture concerns)
- Underlayment requirements (cork, foam, moisture barrier)
- Pattern or direction specified (run with light, 45-degree diagonal)
- Grout joint size and color for tile
- Hardwood species, grade, and finish (prefinished vs. site-finished)
- Existing flooring removal scope
- Furniture moving requirements
- Appliance disconnection/reconnection

IDENTIFY what's MISSING that you need for an accurate bid:
- Are flooring material specifications complete (brand, style, color)?
- Is subfloor preparation included in scope?
- Are material preferences specified for underlayment?
- Is old flooring disposal included?
- Are moisture testing or remediation requirements documented?
- Is site-finished hardwood stain color specified?

Your bid should include accurate square footage with waste factor, transition pieces, underlayment needs, and realistic installation labor based on complexity and substrate preparation.`,
}

// Fallback prompt for any trade not specifically defined
const DEFAULT_TRADE_PROMPT = (trade: string) => `You are an experienced ${trade} contractor reviewing construction plans.
Analyze this construction plan from a ${trade} professional's perspective, identifying:
- Scope of work for ${trade}
- Material requirements
- Labor needs
- Potential issues or concerns
- Code compliance considerations
- Best practice recommendations
- Timeline estimates

Provide detailed, professional insights as if you're preparing a bid for this job.`

async function convertPDFToImages(buffer: Buffer, fileName: string): Promise<string[]> {
  const PDF_CO_API_KEY = process.env.PDF_CO_API_KEY

  if (!PDF_CO_API_KEY) {
    console.log('PDF.co API key not found, vision analysis disabled')
    return []
  }

  try {
    console.log(`Converting PDF to images using PDF.co: ${fileName}`)

    // Step 1: Upload PDF to PDF.co
    const uploadFormData = new FormData()
    // Convert Buffer to Uint8Array for Blob compatibility
    const uint8Array = new Uint8Array(buffer)
    const blob = new Blob([uint8Array], { type: 'application/pdf' })
    uploadFormData.append('file', blob, fileName)

    const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload', {
      method: 'POST',
      headers: {
        'x-api-key': PDF_CO_API_KEY,
      },
      body: uploadFormData,
    })

    if (!uploadResponse.ok) {
      throw new Error(`PDF.co upload failed: ${uploadResponse.statusText}`)
    }

    const uploadData = await uploadResponse.json()
    const fileUrl = uploadData.url

    console.log('PDF uploaded to PDF.co:', fileUrl)

    // Step 2: Convert ALL pages to PNG images
    const convertResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
      method: 'POST',
      headers: {
        'x-api-key': PDF_CO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: fileUrl,
        async: false, // Wait for conversion
        pages: '', // Empty = convert ALL pages
        name: `${fileName}-page`,
      }),
    })

    if (!convertResponse.ok) {
      throw new Error(`PDF.co conversion failed: ${convertResponse.statusText}`)
    }

    const convertData = await convertResponse.json()

    if (convertData.error) {
      throw new Error(`PDF.co error: ${convertData.message}`)
    }

    const imageUrls = convertData.urls || []
    console.log(`Converted ALL ${imageUrls.length} pages to images`)

    return imageUrls
  } catch (error) {
    console.error('Error converting PDF to images:', error)
    return []
  }
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('Error parsing PDF:', errData.parserError)
      reject(new Error('Failed to parse PDF'))
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let text = ''
        
        // Extract text with page separation
        if (pdfData.Pages) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            text += `\n=== PAGE ${pageIndex + 1} ===\n`
            
            if (page.Texts) {
              // Sort texts by position for better reading order
              const sortedTexts = page.Texts.sort((a: any, b: any) => {
                const yDiff = a.y - b.y
                if (Math.abs(yDiff) > 0.5) return yDiff
                return a.x - b.x
              })
              
              sortedTexts.forEach((textItem: any) => {
                if (textItem.R) {
                  textItem.R.forEach((r: any) => {
                    if (r.T) {
                      text += decodeURIComponent(r.T) + ' '
                    }
                  })
                }
              })
              text += '\n'
            }
          })
        }
        
        resolve(text.trim())
      } catch (error) {
        console.error('Error extracting text:', error)
        resolve('') // Return empty string instead of rejecting
      }
    })

    pdfParser.parseBuffer(buffer)
  })
}

async function analyzeWithAI(
  imageUrls: string[],
  extractedText: string,
  trade: string,
  fileName: string
): Promise<AIAnalysisResult> {
  const tradePrompt = TRADE_PROMPTS[trade.toLowerCase()] || DEFAULT_TRADE_PROMPT(trade)

  const systemPrompt = `${tradePrompt}

IMPORTANT: You have BOTH visual images AND extracted text from the construction plans.

HYBRID ANALYSIS APPROACH:
1. VISUAL ANALYSIS (from images):
   - COUNT symbols, fixtures, and elements you can SEE in the drawings
   - IDENTIFY spatial layouts and room configurations
   - MEASURE distances and dimensions shown visually
   - READ legends, schedules, and callouts from images

2. TEXT ANALYSIS (from extracted text):
   - VERIFY counts and specifications mentioned in text
   - EXTRACT precise measurements and dimensions
   - READ detailed specifications and notes
   - IDENTIFY equipment schedules and material lists

3. CROSS-REFERENCE:
   - Compare what you SEE in images with what's written in text
   - Use text to clarify ambiguous visual elements
   - Use images to locate items mentioned in text
   - Provide higher confidence when both sources agree

Return your analysis in the following JSON format (no markdown, just raw JSON):
{
  "bidAmount": "Estimated cost range (e.g., '$15,000 - $20,000')",
  "estimatedTimeline": "Timeline in business days (e.g., '10-14 business days')",
  "materials": ["Array of specific materials with COUNTS (e.g., '(24) duplex outlets counted on pages 1-2')"],
  "labor": "Description of labor team required",
  "potentialIssues": ["Array of specific concerns identified from plans"],
  "recommendations": ["Array of professional recommendations"],
  "confidence": "Confidence score 0-100: High (85-100) if visual + text match, Medium (70-84) if partial info, Lower if estimating"
}`

  try {
    // Build message content with BOTH text and images
    const messageContent: any[] = [
      {
        type: 'text',
        text: `Construction Plan: ${fileName}

=== EXTRACTED TEXT FROM PDF ===
${extractedText.slice(0, 8000)}${extractedText.length > 8000 ? '\n\n...(additional text truncated)' : ''}

=== VISUAL ANALYSIS INSTRUCTIONS ===
Now review the plan images below. Cross-reference what you see in the drawings with the extracted text above.

COUNT specific ${trade} elements you can see:
- ${trade === 'Electrical' ? 'Outlet symbols (○), switch symbols (S, S3, S4), light fixtures, panel locations, circuit runs' : ''}
- ${trade === 'Plumbing' ? 'Fixture symbols (toilets, sinks, tubs), supply lines, drain lines, vent stacks, water heater' : ''}
- ${trade === 'Framing' ? 'Wall lines, door/window openings, beam locations, structural members, dimensions' : ''}
- ${trade === 'Concrete' ? 'Footing lines, slab areas, rebar grid, anchor bolt locations, dimensions' : ''}
- ${trade === 'Drywall' ? 'Wall areas, ceiling configurations, corners, access panels' : ''}
- ${trade === 'Roofing' ? 'Roof sections, ridge lines, valleys, penetrations, pitch indicators' : ''}
- ${trade === 'HVAC' ? 'Register symbols, return grills, ductwork routes, equipment locations' : ''}
- ${trade === 'Flooring' ? 'Room areas, flooring type zones, transition locations, dimensions' : ''}

Provide specific counts and verify with text when possible.`
      }
    ]

    // Add ALL page images (limit to 10 for token management)
    const maxImages = Math.min(imageUrls.length, 10)
    const imagesToAnalyze = imageUrls.slice(0, maxImages)
    
    for (let i = 0; i < imagesToAnalyze.length; i++) {
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: imagesToAnalyze[i],
          detail: 'high' // Use high detail for construction plans
        }
      })
    }

    console.log(`Analyzing ${imagesToAnalyze.length} images + ${extractedText.length} chars of text for ${trade}`)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // GPT-4o supports vision
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: messageContent },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    const analysis = JSON.parse(responseText)

    return {
      trade,
      bidAmount: analysis.bidAmount || 'Analysis incomplete',
      estimatedTimeline: analysis.estimatedTimeline || 'TBD',
      materials: Array.isArray(analysis.materials) ? analysis.materials : [],
      labor: analysis.labor || 'TBD',
      potentialIssues: Array.isArray(analysis.potentialIssues) ? analysis.potentialIssues : [],
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
      confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 50,
    }
  } catch (error) {
    console.error(`Error analyzing ${trade}:`, error)
    throw new Error(`Failed to analyze plan for ${trade}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const tradesJson = formData.get('trades') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!tradesJson) {
      return NextResponse.json(
        { error: 'No trades provided' },
        { status: 400 }
      )
    }

    const trades: string[] = JSON.parse(tradesJson)

    if (!trades || trades.length === 0) {
      return NextResponse.json(
        { error: 'At least one trade must be selected' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Step 1: Extract text from PDF
    console.log(`Extracting text from PDF: ${file.name}`)
    const extractedText = await extractTextFromPDF(buffer)
    console.log(`Extracted ${extractedText.length} characters of text`)

    // Step 2: Convert ALL pages to images for vision analysis
    console.log(`Converting ALL pages of PDF to images: ${file.name}`)
    const imageUrls = await convertPDFToImages(buffer, file.name)

    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Failed to convert PDF to images for analysis. Please check your PDF_CO_API_KEY in .env file.' },
        { status: 400 }
      )
    }

    console.log(`Converted ALL ${imageUrls.length} pages to images`)

    // Step 3: Analyze with AI using BOTH images and text (hybrid approach)
    console.log(`Hybrid analysis: ${imageUrls.length} images + ${extractedText.length} chars text for ${trades.length} trades`)
    const analyses = await Promise.all(
      trades.map(trade => analyzeWithAI(imageUrls, extractedText, trade, file.name))
    )

    return NextResponse.json({
      success: true,
      analyses,
      debug: {
        imagesAnalyzed: imageUrls.length,
        textLength: extractedText.length,
        textPreview: extractedText.slice(0, 300) + '...',
        imageUrlsPreview: imageUrls[0]?.substring(0, 100) + '...',
        message: 'Hybrid analysis: AI analyzed plan images AND extracted text',
        visionEnabled: true,
        hybridMode: true
      }
    })
  } catch (error: any) {
    console.error('Error in AI plan analysis:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze plan' },
      { status: 500 }
    )
  }
}

