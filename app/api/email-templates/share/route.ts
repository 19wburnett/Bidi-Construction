import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * POST /api/email-templates/share
 * Share an email template with one or more users
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { templateId, userIds } = body

    if (!templateId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'templateId and userIds array are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns the template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('id, user_id')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    if (template.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - you can only share templates you own' },
        { status: 403 }
      )
    }

    // Create share records
    const shares = userIds
      .filter((uid: string) => uid !== user.id) // Don't share with yourself
      .map((uid: string) => ({
        template_id: templateId,
        shared_with_user_id: uid,
        created_by: user.id
      }))

    if (shares.length === 0) {
      return NextResponse.json(
        { error: 'No valid users to share with' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('email_template_shares')
      .insert(shares)
      .select()

    if (error) {
      console.error('Error sharing template:', error)
      return NextResponse.json(
        { error: 'Failed to share template', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ shares: data, success: true })
  } catch (error: any) {
    console.error('Error in POST /api/email-templates/share:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/email-templates/share?templateId=<id>&userId=<id>
 * Unshare an email template with a user
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')
    const userId = searchParams.get('userId')

    if (!templateId || !userId) {
      return NextResponse.json(
        { error: 'templateId and userId are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns the template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('id, user_id')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    if (template.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - you can only unshare templates you own' },
        { status: 403 }
      )
    }

    // Delete the share
    const { error } = await supabase
      .from('email_template_shares')
      .delete()
      .eq('template_id', templateId)
      .eq('shared_with_user_id', userId)

    if (error) {
      console.error('Error unsharing template:', error)
      return NextResponse.json(
        { error: 'Failed to unshare template', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/email-templates/share:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
