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
    const { userId, email, jobData } = await request.json()

    if (!userId || !email || !jobData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user exists and get their current payment type
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('payment_type, subscription_status')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user already has active subscription
    if (user.subscription_status === 'active') {
      return NextResponse.json(
        { error: 'User already has active subscription' },
        { status: 400 }
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
        payment_type: 'pay_per_job'
      })
      .eq('id', userId)

    // Create checkout session for pay-per-job
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Bidi Job Request',
              description: `Single job request for ${jobData.trade_category} in ${jobData.location}`,
            },
            unit_amount: 2000, // $20.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // One-time payment instead of subscription
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/new-job?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/new-job?payment=canceled`,
      metadata: {
        userId: userId,
        jobData: JSON.stringify(jobData),
        paymentType: 'pay_per_job'
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating pay-per-job checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}




