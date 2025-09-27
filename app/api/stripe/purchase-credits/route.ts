import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function POST(request: NextRequest) {
  try {
    const { userId, email, creditsToPurchase } = await request.json()

    if (!userId || !email || !creditsToPurchase) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate credits amount
    if (creditsToPurchase < 1 || creditsToPurchase > 100) {
      return NextResponse.json(
        { error: 'Credits must be between 1 and 100' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Create or retrieve Stripe customer
    let customer
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
    } else {
      customer = await stripe.customers.create({
        email: email,
        metadata: {
          userId: userId,
        },
      })
    }

    // Update user record with Stripe customer ID
    await supabase
      .from('users')
      .update({ 
        stripe_customer_id: customer.id,
        payment_type: 'credits'
      })
      .eq('id', userId)

    // Calculate price (beta pricing: $20 per credit)
    const unitPrice = 2000 // $20.00 in cents
    const totalAmount = creditsToPurchase * unitPrice

    // Create checkout session for credit purchase
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${creditsToPurchase} Job Credit${creditsToPurchase > 1 ? 's' : ''}`,
              description: `Each credit allows you to post one job request`,
            },
            unit_amount: unitPrice,
          },
          quantity: creditsToPurchase,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?credits=purchased&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?credits=canceled`,
      metadata: {
        userId: userId,
        creditsToPurchase: creditsToPurchase.toString(),
        paymentType: 'credits'
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating credit purchase checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}




