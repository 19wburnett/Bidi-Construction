import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  console.log('Webhook received:', {
    hasBody: !!body,
    hasSignature: !!signature,
    hasWebhookSecret: !!webhookSecret,
    nodeEnv: process.env.NODE_ENV
  })

  let event: Stripe.Event

  // Skip signature verification in development
  if (process.env.NODE_ENV === 'development' && !webhookSecret) {
    console.log('Development mode: skipping signature verification')
    event = JSON.parse(body)
  } else {
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  }

  console.log('Webhook event type:', event.type)

  const supabase = createServerClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId

        console.log('Processing checkout.session.completed:', {
          sessionId: session.id,
          userId: userId,
          customerId: session.customer,
          paymentStatus: session.payment_status
        })

        if (userId) {
          // Update user with customer ID and mark as active
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              stripe_customer_id: session.customer as string,
              subscription_status: 'active',
              subscription_updated_at: new Date().toISOString()
            })
            .eq('id', userId)
          
          if (updateError) {
            console.error('Error updating user subscription:', updateError)
          } else {
            console.log(`✅ Subscription activated for user: ${userId}`)
          }
        } else {
          console.error('No userId found in session metadata')
        }
        break

      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object as Stripe.Subscription
        const updatedCustomerId = updatedSubscription.customer as string

        // Find user by customer ID and update their subscription status
        const { data: updatedUser } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', updatedCustomerId)
          .single()

        if (updatedUser) {
          const status = updatedSubscription.status === 'active' ? 'active' : 
                        updatedSubscription.status === 'canceled' ? 'canceled' : 
                        updatedSubscription.status === 'past_due' ? 'past_due' : 'inactive'

          await supabase
            .from('users')
            .update({ 
              subscription_status: status,
              stripe_subscription_id: updatedSubscription.id,
              subscription_updated_at: new Date().toISOString()
            })
            .eq('id', updatedUser.id)

          console.log(`Subscription updated for user: ${updatedUser.id}, status: ${status}`)
        }
        break

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription
        const deletedCustomerId = deletedSubscription.customer as string

        // Find user by customer ID and update their subscription status
        const { data: deletedUser } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', deletedCustomerId)
          .single()

        if (deletedUser) {
          await supabase
            .from('users')
            .update({ 
              subscription_status: 'canceled',
              subscription_updated_at: new Date().toISOString()
            })
            .eq('id', deletedUser.id)

          console.log(`Subscription canceled for user: ${deletedUser.id}`)
        }
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
