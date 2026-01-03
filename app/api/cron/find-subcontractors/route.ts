import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { TRADE_CATEGORIES } from '@/lib/trade-types'
import { crawlGoogleMyBusiness } from '@/lib/crawlers/google-my-business'

export const runtime = 'nodejs'
// Allow up to 5 minutes for the cron job to complete
export const maxDuration = 300

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Cron endpoint for automatically finding new subcontractors
 * 
 * This endpoint is designed to run every 2 hours via Vercel Cron.
 * It randomly selects one trade category and searches Google Maps for subcontractors 
 * in Utah within that category, checks for duplicates, adds new ones to the database, 
 * and notifies admin users.
 * 
 * Security: Validates CRON_SECRET header to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (Vercel sets this automatically for cron jobs)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, require CRON_SECRET
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('🚫 Unauthorized cron request')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    console.log('🔍 Starting subcontractor discovery cron job...')
    const supabase = await createServerSupabaseClient()
    
    // Randomly select one trade category to search
    const categoriesToSearch = selectRandomTradeCategory()
    
    console.log(`📋 Randomly selected trade category: ${categoriesToSearch[0]}`)
    
    const location = 'Utah'
    const maxResultsPerCategory = 10 // Search up to 10 results per category per run
    const newSubcontractors: Array<{
      name: string
      email: string
      trade_category: string
      phone: string | null
      website_url: string | null
      location: string
      google_review_score: number | null
    }> = []
    const skipped: Array<{ name: string; reason: string }> = []
    const errors: Array<{ category: string; error: string }> = []
    
    // Process each trade category sequentially
    for (const tradeCategory of categoriesToSearch) {
      try {
        console.log(`🔎 Crawling ${tradeCategory} in ${location}...`)
        
        // Crawl Google Maps for this trade category
        const crawlerResults = await crawlGoogleMyBusiness(
          tradeCategory,
          location,
          maxResultsPerCategory
        )
        
        console.log(`📊 Found ${crawlerResults.length} results for ${tradeCategory}`)
        
        // Process each result
        for (const contractor of crawlerResults) {
          try {
            // Validate email
            if (!isValidEmail(contractor.email)) {
              skipped.push({ name: contractor.name || 'Unknown', reason: 'Invalid email' })
              continue
            }
            
            // Normalize email
            const normalizedEmail = contractor.email.toLowerCase().trim()
            
            // Check for duplicates by email, name, and website URL
            const isDuplicate = await checkForDuplicate(
              supabase,
              normalizedEmail,
              contractor.name,
              contractor.website
            )
            
            if (isDuplicate) {
              skipped.push({ name: contractor.name || 'Unknown', reason: 'Duplicate found' })
              continue
            }
            
            // Insert new subcontractor
            const { data: newSub, error: insertError } = await supabase
              .from('subcontractors')
              .insert({
                email: normalizedEmail,
                name: contractor.name,
                trade_category: tradeCategory,
                location: location,
                phone: contractor.phone || null,
                website_url: normalizeWebsiteUrl(contractor.website) || null,
                google_review_score: contractor.rating && typeof contractor.rating === 'number' && contractor.rating >= 0 && contractor.rating <= 5 ? contractor.rating : null,
              })
              .select('id, name, email, trade_category')
              .single()
            
            if (insertError) {
              // Check if it's a duplicate constraint error
              if (insertError.code === '23505') {
                skipped.push({ name: contractor.name || 'Unknown', reason: 'Duplicate (database constraint)' })
              } else {
                console.error(`❌ Error inserting subcontractor ${contractor.name}:`, insertError)
                errors.push({ category: tradeCategory, error: insertError.message })
              }
              continue
            }
            
            if (newSub) {
              console.log(`✅ Added new subcontractor: ${newSub.name} (${newSub.email})`)
              newSubcontractors.push({
                name: newSub.name,
                email: newSub.email,
                trade_category: newSub.trade_category,
                phone: contractor.phone || null,
                website_url: normalizeWebsiteUrl(contractor.website) || null,
                location: location,
                google_review_score: contractor.rating && typeof contractor.rating === 'number' && contractor.rating >= 0 && contractor.rating <= 5 ? contractor.rating : null,
              })
            }
            
          } catch (error: any) {
            console.error(`❌ Error processing contractor ${contractor.name}:`, error)
            errors.push({ category: tradeCategory, error: error.message })
          }
        }
        
        // Add delay between categories to avoid rate limiting
        if (categoriesToSearch.indexOf(tradeCategory) < categoriesToSearch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
        }
        
      } catch (error: any) {
        console.error(`❌ Error crawling ${tradeCategory}:`, error)
        errors.push({ category: tradeCategory, error: error.message })
        // Continue with next category even if this one fails
      }
    }
    
    console.log(`🏁 Discovery complete. Found ${newSubcontractors.length} new subcontractors, skipped ${skipped.length}`)
    
    // Send notification email to admin users if new subcontractors were found
    if (newSubcontractors.length > 0) {
      try {
        await sendAdminNotification(supabase, newSubcontractors, categoriesToSearch, skipped.length, errors.length)
      } catch (error: any) {
        console.error('❌ Error sending admin notification:', error)
        // Don't fail the entire job if notification fails
      }
    }
    
    return NextResponse.json({
      success: true,
      found: newSubcontractors.length,
      skipped: skipped.length,
      errors: errors.length,
      categories_searched: categoriesToSearch,
      new_subcontractors: newSubcontractors,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Subcontractor discovery cron job failed:', error)
    return NextResponse.json(
      { error: 'Cron job failed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Randomly select one trade category to search
 * This ensures variety across runs and prevents bias toward certain categories
 */
function selectRandomTradeCategory(): string[] {
  const categories = [...TRADE_CATEGORIES]
  const randomIndex = Math.floor(Math.random() * categories.length)
  return [categories[randomIndex]]
}

/**
 * Check if a subcontractor already exists by email, name, or website URL
 */
async function checkForDuplicate(
  supabase: any,
  email: string,
  name: string | null,
  websiteUrl: string | null
): Promise<boolean> {
  try {
    // Normalize name for comparison
    const normalizedName = name ? name.trim().toLowerCase() : null
    const normalizedWebsite = normalizeWebsiteUrl(websiteUrl)
    
    // Check by email (case-insensitive)
    if (email) {
      const { data: emailMatch } = await supabase
        .from('subcontractors')
        .select('id')
        .ilike('email', email)
        .maybeSingle()
      
      if (emailMatch) {
        return true
      }
    }
    
    // Check by name (case-insensitive, normalized)
    if (normalizedName) {
      const { data: nameMatch } = await supabase
        .from('subcontractors')
        .select('id')
        .ilike('name', normalizedName)
        .maybeSingle()
      
      if (nameMatch) {
        return true
      }
    }
    
    // Check by website URL (normalized)
    if (normalizedWebsite) {
      // Get all subcontractors with website URLs and check manually
      // (Supabase doesn't have a good way to do normalized URL comparison)
      const { data: allWithWebsites } = await supabase
        .from('subcontractors')
        .select('website_url')
        .not('website_url', 'is', null)
      
      if (allWithWebsites) {
        for (const sub of allWithWebsites) {
          const existingNormalized = normalizeWebsiteUrl(sub.website_url)
          if (existingNormalized === normalizedWebsite) {
            return true
          }
        }
      }
    }
    
    return false
  } catch (error) {
    console.error('Error checking for duplicates:', error)
    // If check fails, assume not duplicate to avoid blocking valid entries
    return false
  }
}

/**
 * Normalize website URL for comparison
 * Removes protocol, www prefix, and trailing slashes
 */
function normalizeWebsiteUrl(url: string | null | undefined): string | null {
  if (!url) return null
  
  try {
    let normalized = url.trim().toLowerCase()
    
    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '')
    
    // Remove www prefix
    normalized = normalized.replace(/^www\./, '')
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '')
    
    return normalized || null
  } catch (error) {
    console.error('Error normalizing website URL:', error)
    return null
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Send notification email to admin users about new subcontractors found
 */
async function sendAdminNotification(
  supabase: any,
  newSubcontractors: Array<{
    name: string
    email: string
    trade_category: string
    phone: string | null
    website_url: string | null
    location: string
    google_review_score: number | null
  }>,
  categoriesSearched: string[],
  skippedCount: number,
  errorCount: number
): Promise<void> {
  // Get all admin email addresses - check both role = 'admin' OR is_admin = true
  const { data: admins, error: adminError } = await supabase
    .from('users')
    .select('email')
    .or('role.eq.admin,is_admin.eq.true')
  
  let adminEmails: string[] = []
  
  if (adminError) {
    console.error('Error querying admin users:', adminError)
  } else if (admins && admins.length > 0) {
    adminEmails = admins.map((admin: any) => admin.email).filter(Boolean)
  }
  
  // Always include fallback email for safety
  const fallbackEmail = 'savewithbidi@gmail.com'
  if (!adminEmails.includes(fallbackEmail)) {
    adminEmails.push(fallbackEmail)
  }
  
  if (adminEmails.length === 0) {
    console.warn('No admin emails found, using fallback only')
    adminEmails = [fallbackEmail]
  }
  
  console.log(`📧 Sending notification to ${adminEmails.length} admin(s)`)
  
  // Build email content
  const subcontractorList = newSubcontractors
    .map((sub, index) => {
      const website = sub.website_url ? `\n   Website: ${sub.website_url}` : ''
      const phone = sub.phone ? `\n   Phone: ${sub.phone}` : ''
      const rating = sub.google_review_score ? `\n   Google Rating: ${sub.google_review_score}/5` : ''
      return `${index + 1}. ${sub.name} (${sub.trade_category})
   Email: ${sub.email}${phone}${website}${rating}`
    })
    .join('\n\n')
  
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Bidi</h1>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Subcontractor Discovery Report</p>
      </div>
      
      <div style="padding: 30px; background-color: #f8fafc;">
        <h2 style="color: #1e293b; margin-bottom: 20px;">New Subcontractors Found</h2>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Summary:</strong></p>
          <ul style="line-height: 1.8; margin: 0;">
            <li><strong>New Subcontractors:</strong> ${newSubcontractors.length}</li>
            <li><strong>Skipped:</strong> ${skippedCount}</li>
            <li><strong>Errors:</strong> ${errorCount}</li>
            <li><strong>Categories Searched:</strong> ${categoriesSearched.join(', ')}</li>
          </ul>
        </div>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 15px 0;"><strong>New Subcontractors:</strong></p>
          <pre style="background-color: #f1f5f9; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${subcontractorList}</pre>
        </div>
        
        <p style="font-size: 14px; color: #64748b; margin-top: 20px;">
          This is an automated report from the subcontractor discovery cron job.
        </p>
      </div>
      
      <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center;">
        <p style="margin: 0; font-size: 14px;">
          © ${new Date().getFullYear()} Bidi. All rights reserved.
        </p>
      </div>
    </div>
  `
  
  const emailSubject = `New Subcontractors Found: ${newSubcontractors.length} Added to Database`
  
  try {
    const { error: sendError } = await resend.emails.send({
      from: 'Bidi <noreply@bidicontracting.com>',
      to: adminEmails,
      subject: emailSubject,
      html: emailHtml,
    })
    
    if (sendError) {
      console.error('❌ Failed to send admin notification:', sendError)
      throw sendError
    }
    
    console.log(`✅ Notification sent to ${adminEmails.length} admin(s)`)
  } catch (error) {
    console.error('❌ Error sending admin notification:', error)
    throw error
  }
}

/**
 * POST handler for manual trigger (useful for testing)
 */
export async function POST(request: NextRequest) {
  // Reuse GET logic for manual triggers
  return GET(request)
}

