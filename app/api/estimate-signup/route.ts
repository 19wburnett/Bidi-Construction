import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name } = body

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Normalize email (lowercase)
    const normalizedEmail = email.toLowerCase().trim()

    const supabase = await createServerSupabaseClient()

    // Check if email already exists
    const { data: existing } = await supabase
      .from('estimate_signups')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing) {
      // Return success even if already exists (don't reveal if email exists)
      return NextResponse.json({
        success: true,
        message: 'Thank you! You\'re on the list for a free estimate.'
      })
    }

    // Insert new signup
    const { data, error } = await supabase
      .from('estimate_signups')
      .insert({
        email: normalizedEmail,
        name: name?.trim() || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting estimate signup:', error)
      return NextResponse.json(
        { error: 'Failed to process signup. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you! You\'re on the list for a free estimate.'
    })

  } catch (error) {
    console.error('Error in estimate signup:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

