import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

interface EmailTemplate {
  id?: string
  template_name: string
  template_type: 'bid_package' | 'reminder' | 'response'
  subject: string
  html_body: string
  text_body?: string
  variables?: Record<string, any>
  is_default?: boolean
}

/**
 * GET /api/email-templates
 * List all email templates for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const templateType = searchParams.get('template_type')

    // Build query - always filter by user_id for security
    let query = supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    // Optional filter by template type
    if (templateType) {
      query = query.eq('template_type', templateType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching email templates:', error)
      return NextResponse.json(
        { error: 'Failed to fetch templates', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ templates: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/email-templates:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email-templates
 * Create a new email template
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

    const body: EmailTemplate = await request.json()
    const { template_name, template_type, subject, html_body, text_body, variables, is_default } = body

    // Validation
    if (!template_name || !template_type || !subject || !html_body) {
      return NextResponse.json(
        { error: 'Missing required fields: template_name, template_type, subject, html_body' },
        { status: 400 }
      )
    }

    // Validate template_type
    if (!['bid_package', 'reminder', 'response'].includes(template_type)) {
      return NextResponse.json(
        { error: 'Invalid template_type. Must be one of: bid_package, reminder, response' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // If setting as default, unset other defaults for this user and template type
    if (is_default) {
      await supabase
        .from('email_templates')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('template_type', template_type)
        .eq('is_default', true)
    }

    // Create template
    const { data, error } = await supabase
      .from('email_templates')
      .insert({
        user_id: user.id,
        template_name,
        template_type,
        subject,
        html_body,
        text_body: text_body || null,
        variables: variables || null,
        is_default: is_default || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating email template:', error)
      return NextResponse.json(
        { error: 'Failed to create template', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ template: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/email-templates:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/email-templates
 * Update an existing email template
 */
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body: EmailTemplate & { id: string } = await request.json()
    const { id, template_name, template_type, subject, html_body, text_body, variables, is_default } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // First, verify the template belongs to the user
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('email_templates')
      .select('id, user_id, template_type')
      .eq('id', id)
      .single()

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    if (existingTemplate.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - template does not belong to user' },
        { status: 403 }
      )
    }

    // If setting as default, unset other defaults for this user and template type
    const currentTemplateType = template_type || existingTemplate.template_type
    if (is_default) {
      await supabase
        .from('email_templates')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('template_type', currentTemplateType)
        .eq('is_default', true)
        .neq('id', id)
    }

    // Build update object with only provided fields
    const updateData: any = {}
    if (template_name !== undefined) updateData.template_name = template_name
    if (template_type !== undefined) updateData.template_type = template_type
    if (subject !== undefined) updateData.subject = subject
    if (html_body !== undefined) updateData.html_body = html_body
    if (text_body !== undefined) updateData.text_body = text_body
    if (variables !== undefined) updateData.variables = variables
    if (is_default !== undefined) updateData.is_default = is_default

    // Update template
    const { data, error } = await supabase
      .from('email_templates')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id) // Double-check user ownership
      .select()
      .single()

    if (error) {
      console.error('Error updating email template:', error)
      return NextResponse.json(
        { error: 'Failed to update template', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ template: data })
  } catch (error: any) {
    console.error('Error in PUT /api/email-templates:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/email-templates?id=<template_id>
 * Delete an email template
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
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify template belongs to user before deleting
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('email_templates')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    if (existingTemplate.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - template does not belong to user' },
        { status: 403 }
      )
    }

    // Delete template
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Double-check user ownership

    if (error) {
      console.error('Error deleting email template:', error)
      return NextResponse.json(
        { error: 'Failed to delete template', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/email-templates:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}










