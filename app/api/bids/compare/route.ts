import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { matchBidLineItems, type BidLineItem } from '@/lib/bid-comparison/ai-matcher'
import { generateBidAnalysis, type Bid } from '@/lib/bid-comparison/ai-analyzer'
import { sortBidIds } from '@/lib/bid-comparison/cache-utils'
// @ts-ignore - pdf2json doesn't have TypeScript types
import PDFParser from 'pdf2json'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { selectedBidId, comparisonBidIds, jobId, forceRefresh } = body

    if (!selectedBidId || !Array.isArray(comparisonBidIds) || !jobId) {
      return NextResponse.json(
        { error: 'Missing required fields: selectedBidId, comparisonBidIds, jobId' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Sort bid IDs for consistent caching
    const sortedComparisonBidIds = sortBidIds(comparisonBidIds)

    // Check for cached analysis
    if (!forceRefresh) {
      const bidIdsText = sortedComparisonBidIds.length > 0 
        ? sortedComparisonBidIds.join(',') 
        : ''
      
      const { data: cachedAnalysis, error: cacheError } = await supabase
        .from('bid_comparison_analyses')
        .select('matches, analysis, updated_at')
        .eq('comparison_type', 'bid_to_bid')
        .eq('selected_bid_id', selectedBidId)
        .eq('comparison_bid_ids_text', bidIdsText)
        .is('takeoff_items_hash', null)
        .single()

      if (!cacheError && cachedAnalysis) {
        return NextResponse.json({
          matches: cachedAnalysis.matches,
          analysis: cachedAnalysis.analysis,
          cached: true,
          cachedAt: cachedAnalysis.updated_at,
        })
      }
    }

    // Load selected bid with line items
    const { data: selectedBidData, error: selectedBidError } = await supabase
      .from('bids')
      .select(`
        *,
        subcontractors (
          id,
          name,
          email,
          trade_category
        ),
        gc_contacts (
          id,
          name,
          email,
          trade_category
        )
      `)
      .eq('id', selectedBidId)
      .single()

    if (selectedBidError || !selectedBidData) {
      return NextResponse.json(
        { error: 'Failed to load selected bid' },
        { status: 404 }
      )
    }

    const { data: selectedLineItems, error: selectedItemsError } = await supabase
      .from('bid_line_items')
      .select('*')
      .eq('bid_id', selectedBidId)
      .order('item_number', { ascending: true })

    if (selectedItemsError) {
      return NextResponse.json(
        { error: 'Failed to load selected bid line items' },
        { status: 500 }
      )
    }

    // Load comparison bids with line items
    const { data: comparisonBidsData, error: comparisonBidsError } = await supabase
      .from('bids')
      .select(`
        *,
        subcontractors (
          id,
          name,
          email,
          trade_category
        ),
        gc_contacts (
          id,
          name,
          email,
          trade_category
        )
      `)
      .in('id', comparisonBidIds)

    if (comparisonBidsError || !comparisonBidsData) {
      return NextResponse.json(
        { error: 'Failed to load comparison bids' },
        { status: 500 }
      )
    }

    // Load line items for all comparison bids
    const { data: allComparisonLineItems, error: allItemsError } = await supabase
      .from('bid_line_items')
      .select('*')
      .in('bid_id', comparisonBidIds)
      .order('item_number', { ascending: true })

    if (allItemsError) {
      return NextResponse.json(
        { error: 'Failed to load comparison bid line items' },
        { status: 500 }
      )
    }

    // Group line items by bid_id
    const comparisonBidItems: Record<string, BidLineItem[]> = {}
    comparisonBidIds.forEach(bidId => {
      comparisonBidItems[bidId] = (allComparisonLineItems || []).filter(
        item => item.bid_id === bidId
      ) as BidLineItem[]
    })

    // Perform AI matching
    const matchingResult = await matchBidLineItems(
      (selectedLineItems || []) as BidLineItem[],
      comparisonBidItems
    )

    // Prepare bid objects for analysis
    const selectedBid: Bid = {
      id: selectedBidData.id,
      bid_amount: selectedBidData.bid_amount,
      timeline: selectedBidData.timeline,
      notes: selectedBidData.notes,
      subcontractors: selectedBidData.subcontractors,
      gc_contacts: selectedBidData.gc_contacts,
    }

    const comparisonBids: Bid[] = comparisonBidsData.map(bid => ({
      id: bid.id,
      bid_amount: bid.bid_amount,
      timeline: bid.timeline,
      notes: bid.notes,
      subcontractors: bid.subcontractors,
      gc_contacts: bid.gc_contacts,
    }))

    // Fetch PDF attachments and extract text for all bids
    const allBidIds = [selectedBidId, ...comparisonBidIds]
    const pdfTexts: Record<string, string> = {}
    
    try {
      // Load attachments for all bids
      const { data: attachments, error: attachmentsError } = await supabase
        .from('bid_attachments')
        .select('bid_id, file_path, file_name, file_type')
        .in('bid_id', allBidIds)
        .eq('file_type', 'application/pdf')

      if (!attachmentsError && attachments && attachments.length > 0) {
        console.log(`📄 Found ${attachments.length} PDF attachments for bid comparison`)
        
        // Extract text from each PDF
        for (const attachment of attachments) {
          try {
            // Download PDF from storage
            const { data: pdfData, error: downloadError } = await supabase.storage
              .from('bid-attachments')
              .download(attachment.file_path)

            if (downloadError || !pdfData) {
              console.warn(`⚠️ Failed to download PDF ${attachment.file_name}:`, downloadError?.message)
              continue
            }

            // Convert blob to buffer
            const arrayBuffer = await pdfData.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            // Extract text from PDF
            const extractedText = await extractTextFromPDF(buffer)
            
            if (extractedText && extractedText.trim().length > 0) {
              const existingText = pdfTexts[attachment.bid_id] || ''
              pdfTexts[attachment.bid_id] = existingText 
                ? `${existingText}\n\n=== PDF: ${attachment.file_name} ===\n${extractedText}`
                : `=== PDF: ${attachment.file_name} ===\n${extractedText}`
              console.log(`✅ Extracted ${extractedText.length} characters from ${attachment.file_name} for bid ${attachment.bid_id}`)
            }
          } catch (error: any) {
            console.error(`❌ Error processing PDF ${attachment.file_name}:`, error.message)
            // Continue with other PDFs even if one fails
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching PDF attachments:', error)
      // Continue with analysis even if PDF extraction fails
    }

    // Generate comprehensive AI analysis with PDF content
    const analysis = await generateBidAnalysis(
      selectedBid,
      comparisonBids,
      matchingResult.matches,
      matchingResult.unmatchedItems,
      pdfTexts
    )

    // Save to cache using RPC function
    const { error: saveError } = await supabase.rpc('upsert_bid_comparison_analysis', {
      p_comparison_type: 'bid_to_bid',
      p_selected_bid_id: selectedBidId,
      p_comparison_bid_ids: sortedComparisonBidIds,
      p_takeoff_items_hash: null,
      p_matches: matchingResult.matches,
      p_analysis: analysis,
    })

    if (saveError) {
      console.error('Error saving bid comparison analysis:', saveError)
      // Continue anyway - don't fail the request
    }

    if (saveError) {
      console.error('Error saving bid comparison analysis:', saveError)
      // Continue anyway - don't fail the request
    }

    return NextResponse.json({
      matches: matchingResult.matches,
      unmatchedItems: matchingResult.unmatchedItems,
      analysis,
      cached: false,
    })
  } catch (error: any) {
    console.error('Error in bid comparison:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to compare bids' },
      { status: 500 }
    )
  }
}

/**
 * Extract text from PDF buffer using pdf2json
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()
    let timeoutId: NodeJS.Timeout | null = null
    let resolved = false

    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error('PDF parsing timed out'))
      }
    }, 30000)

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      cleanup()
      if (resolved) return
      resolved = true
      reject(new Error(errData?.parserError || 'PDF parsing error'))
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      cleanup()
      if (resolved) return
      
      try {
        let text = ''
        
        if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            text += `\n=== PAGE ${pageIndex + 1} ===\n`
            
            if (page.Texts && Array.isArray(page.Texts)) {
              const sortedTexts = page.Texts.sort((a: any, b: any) => {
                const yDiff = a.y - b.y
                if (Math.abs(yDiff) > 0.5) return yDiff
                return a.x - b.x
              })
              
              sortedTexts.forEach((textItem: any) => {
                if (textItem.R && Array.isArray(textItem.R)) {
                  textItem.R.forEach((r: any) => {
                    if (r.T) {
                      try {
                        text += decodeURIComponent(r.T) + ' '
                      } catch {
                        text += (r.T || '') + ' '
                      }
                    }
                  })
                }
              })
              text += '\n'
            }
          })
        }
        
        resolved = true
        resolve(text.trim())
      } catch (error: any) {
        resolved = true
        reject(new Error(`Error extracting text: ${error.message}`))
      }
    })

    try {
      pdfParser.parseBuffer(buffer)
    } catch (error: any) {
      cleanup()
      if (resolved) return
      resolved = true
      reject(new Error(`Failed to start PDF parsing: ${error.message}`))
    }
  })
}