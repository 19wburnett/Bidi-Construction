import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs'

// Validate required environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY is not set')
}

if (!webhookSecret) {
  console.error('STRIPE_WEBHOOK_SECRET is not set')
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
}) : null

export async function POST(request: NextRequest) {
  try {
    // Validate Stripe is configured
    if (!stripe) {
      console.error('Stripe is not configured - STRIPE_SECRET_KEY missing')
      return NextResponse.json(
        { error: 'Webhook endpoint not configured' },
        { status: 500 }
      )
    }

    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    console.log('Webhook received:', {
      hasBody: !!body,
      hasSignature: !!signature,
      hasWebhookSecret: !!webhookSecret,
      nodeEnv: process.env.NODE_ENV
    })

    // Validate signature header exists when webhook secret is configured
    if (webhookSecret && !signature) {
      console.error('Missing stripe-signature header')
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    // Always try to verify signature if webhook secret exists
    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(body, signature!, webhookSecret)
        console.log('Webhook signature verified successfully')
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err)
        return NextResponse.json(
          { error: 'Invalid signature', details: err.message },
          { status: 400 }
        )
      }
    } else {
      console.warn('No webhook secret found, skipping signature verification')
      try {
        event = JSON.parse(body) as Stripe.Event
      } catch (parseError: any) {
        console.error('Failed to parse webhook body:', parseError)
        return NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        )
      }
    }

    console.log('Webhook event type:', event.type)
    console.log('Webhook event data:', JSON.stringify(event.data, null, 2))

    // Validate Supabase environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase environment variables not configured')
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const supabase = await createServerSupabaseClient()
    
    // Use service role for webhook operations to bypass RLS
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const paymentType = session.metadata?.paymentType

        console.log('Processing checkout.session.completed:', {
          sessionId: session.id,
          userId: userId,
          customerId: session.customer,
          paymentStatus: session.payment_status,
          paymentType: paymentType
        })

        if (userId) {
          if (paymentType === 'credits') {
            // Handle credit purchase
            const creditsToPurchase = parseInt(session.metadata?.creditsToPurchase || '0')
            
            console.log('Credits to purchase:', creditsToPurchase)
            console.log('User ID:', userId)
            console.log('Session customer:', session.customer)
            
            // Create credit purchase record
            const { data: creditPurchase, error: creditPurchaseError } = await supabaseAdmin
              .from('credit_purchases')
              .insert({
                user_id: userId,
                credits_purchased: creditsToPurchase,
                amount_paid: session.amount_total ? session.amount_total / 100 : 0,
                stripe_payment_intent_id: session.payment_intent as string,
                payment_status: 'paid'
              })
              .select()
              .single()

            if (creditPurchaseError) {
              console.error('Error creating credit purchase record:', creditPurchaseError)
              // Log but don't fail - Stripe payment is already complete
            } else {
              // Add credits to user's account
              // First get current credits, then update
              const { data: currentUser, error: fetchError } = await supabaseAdmin
                .from('users')
                .select('credits')
                .eq('id', userId)
                .single()

              if (fetchError) {
                console.error('Error fetching current user credits:', fetchError)
                // Log but don't fail - payment is complete
              } else {
                const newCredits = (currentUser?.credits || 0) + creditsToPurchase
                
                const { error: updateCreditsError } = await supabaseAdmin
                  .from('users')
                  .update({ 
                    stripe_customer_id: session.customer as string,
                    credits: newCredits,
                    payment_type: 'credits'
                  })
                  .eq('id', userId)
                
                if (updateCreditsError) {
                  console.error('Error updating user credits:', updateCreditsError)
                  // Log but don't fail - payment is complete
                } else {
                  console.log(`✅ Credits purchased: ${creditsToPurchase} credits added to user ${userId} (total: ${newCredits})`)
                }
              }
            }
          } else if (paymentType === 'pay_per_job') {
            // Handle pay-per-job payment (legacy)
            const jobData = JSON.parse(session.metadata?.jobData || '{}')
            
            // Create job request with payment info
            const { data: jobRequest, error: jobError } = await supabase
              .from('job_requests')
              .insert({
                gc_id: userId,
                trade_category: jobData.trade_category,
                location: jobData.location,
                description: jobData.description,
                budget_range: jobData.budget_range,
                files: jobData.files || null,
                status: 'active',
                bid_collection_started_at: new Date().toISOString(),
                bid_collection_ends_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                payment_type: 'pay_per_job',
                stripe_payment_intent_id: session.payment_intent as string,
                payment_status: 'paid'
              })
              .select()
              .single()

            if (jobError) {
              console.error('Error creating job request:', jobError)
            } else {
              console.log(`✅ Pay-per-job payment completed and job created: ${jobRequest.id}`)
              
              // Send job emails
              try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-job-emails`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jobRequestId: jobRequest.id,
                    tradeCategory: jobData.trade_category,
                    location: jobData.location
                  })
                })
                
                if (response.ok) {
                  console.log('Job emails sent successfully')
                } else {
                  console.error('Failed to send job emails')
                }
              } catch (emailError) {
                console.error('Error sending job emails:', emailError)
              }
            }
          } else {
            // Handle subscription payment
            // Get the subscription ID from the session
            let subscriptionId = null
            if (session.subscription) {
              subscriptionId = session.subscription as string
            } else if (session.mode === 'subscription') {
              // If subscription ID is not directly available, we might need to wait for the subscription.created event
              // For now, we'll update what we can and the subscription ID will be updated by the subscription.created event
              console.log('Subscription ID not available in checkout session, will be updated by subscription.created event')
            }

            // Check if this is a subcontractor subscription
            const subscriptionType = session.metadata?.subscriptionType || 'gc'
            const updateData: any = { 
              stripe_customer_id: session.customer as string,
              subscription_status: 'active',
              stripe_subscription_id: subscriptionId,
              subscription_updated_at: new Date().toISOString()
            }
            
            // Set role to 'sub' if this is a subcontractor subscription
            if (subscriptionType === 'sub') {
              updateData.role = 'sub'
            }

            const { error: updateSubscriptionError } = await supabaseAdmin
              .from('users')
              .update(updateData)
              .eq('id', userId)
            
            if (updateSubscriptionError) {
              console.error('Error updating user subscription:', updateSubscriptionError)
            } else {
              console.log(`✅ Subscription activated for user: ${userId}${subscriptionId ? ` with subscription ID: ${subscriptionId}` : ''} (type: ${subscriptionType})`)
            }
          }
        } else {
          console.error('No userId found in session metadata')
        }
        break

      case 'customer.subscription.created':
        const newSubscription = event.data.object as Stripe.Subscription
        const newCustomerId = newSubscription.customer as string

        // Find user by customer ID and update their subscription ID
        // Only update if subscription_id is not already set to avoid race conditions
        const { data: newUser, error: findUserError } = await supabaseAdmin
          .from('users')
          .select('id, stripe_subscription_id')
          .eq('stripe_customer_id', newCustomerId)
          .single()

        if (findUserError) {
          console.error('Error finding user for subscription.created:', findUserError)
        } else if (newUser) {
          // Only update if subscription_id is not already set (avoid race condition with checkout.session.completed)
          if (!newUser.stripe_subscription_id) {
            const { error: updateSubscriptionCreatedError } = await supabaseAdmin
              .from('users')
              .update({ 
                stripe_subscription_id: newSubscription.id,
                subscription_status: 'active',
                subscription_updated_at: new Date().toISOString()
              })
              .eq('id', newUser.id)

            if (updateSubscriptionCreatedError) {
              console.error('Error updating user subscription in subscription.created:', updateSubscriptionCreatedError)
            } else {
              console.log(`✅ Subscription created and linked for user: ${newUser.id}, subscription ID: ${newSubscription.id}`)
            }
          } else {
            console.log(`Subscription ID already set for user: ${newUser.id}, skipping update`)
          }
        } else {
          console.log(`No user found for customer ID: ${newCustomerId} in subscription.created event`)
        }
        break

      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object as Stripe.Subscription
        const updatedCustomerId = updatedSubscription.customer as string

        // Update user subscription status directly by customer ID (more efficient)
        const status = updatedSubscription.status === 'active' ? 'active' : 
                      updatedSubscription.status === 'canceled' ? 'canceled' : 
                      updatedSubscription.status === 'past_due' ? 'past_due' : 'inactive'

        const { data: updatedUser, error: updateSubscriptionUpdatedError } = await supabaseAdmin
          .from('users')
          .update({ 
            subscription_status: status,
            stripe_subscription_id: updatedSubscription.id,
            subscription_updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', updatedCustomerId)
          .select('id')
          .single()

        if (updateSubscriptionUpdatedError) {
          console.error('Error updating user subscription in subscription.updated:', updateSubscriptionUpdatedError)
        } else if (updatedUser) {
          console.log(`Subscription updated for user: ${updatedUser.id}, status: ${status}`)
        } else {
          console.log(`No user found for customer ID: ${updatedCustomerId} in subscription.updated event`)
        }
        break

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription
        const deletedCustomerId = deletedSubscription.customer as string

        // Update user subscription status directly by customer ID (more efficient)
        const { data: deletedUser, error: updateSubscriptionDeletedError } = await supabaseAdmin
          .from('users')
          .update({ 
            subscription_status: 'canceled',
            subscription_updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', deletedCustomerId)
          .select('id')
          .single()

        if (updateSubscriptionDeletedError) {
          console.error('Error updating user subscription in subscription.deleted:', updateSubscriptionDeletedError)
        } else if (deletedUser) {
          console.log(`Subscription canceled for user: ${deletedUser.id}`)
        } else {
          console.log(`No user found for customer ID: ${deletedCustomerId} in subscription.deleted event`)
        }
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
        // Return 200 for unhandled events - Stripe expects 200-299 for success
        // We acknowledge receipt even if we don't process the event
        return NextResponse.json(
          { received: true, message: `Event type ${event.type} acknowledged but not processed` },
          { status: 200 }
        )
    }

    // Return success response for all handled events
    return NextResponse.json(
      { received: true, eventType: event.type },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    console.error('Error stack:', error?.stack)
    
    // Return 500 for unexpected errors - Stripe will retry
    // But we should log extensively to debug
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        message: error?.message || 'Unknown error',
        eventType: (error as any)?.event?.type || 'unknown'
      },
      { status: 500 }
    )
  }
}
