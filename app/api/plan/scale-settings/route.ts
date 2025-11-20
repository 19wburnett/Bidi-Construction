import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/plan/scale-settings?planId=xxx - Get scale settings for a plan
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const planId = searchParams.get('planId')

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    // Verify user has access to this plan (RLS policies will handle access control)
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Load scale settings for all pages
    const { data: settings, error: settingsError } = await supabase
      .from('plan_scale_settings')
      .select('page_number, scale_ratio, pixels_per_unit, unit, calibration_line')
      .eq('plan_id', planId)
      .order('page_number')

    if (settingsError) {
      console.error('Error loading scale settings:', settingsError)
      // If table doesn't exist, return empty settings instead of error
      if (settingsError.code === '42P01') {
        console.warn('plan_scale_settings table does not exist - migration may not have been run')
        return NextResponse.json({ settings: {} })
      }
      return NextResponse.json({ error: 'Failed to load scale settings' }, { status: 500 })
    }

    // Convert to Record<number, ScaleSetting> format
    const settingsMap: Record<number, {
      ratio: string
      pixelsPerUnit: number
      unit: 'ft' | 'in' | 'm' | 'cm' | 'mm'
    }> = {}

    if (settings && settings.length > 0) {
      settings.forEach(setting => {
        if (setting.pixels_per_unit != null && setting.scale_ratio && setting.unit) {
          // Ensure page_number is converted to number for consistent key lookup
          const pageNum = Number(setting.page_number)
          settingsMap[pageNum] = {
            ratio: setting.scale_ratio,
            pixelsPerUnit: Number(setting.pixels_per_unit),
            unit: setting.unit as 'ft' | 'in' | 'm' | 'cm' | 'mm'
          }
        }
      })
    }
    
    console.log('Settings map:', settingsMap)

    console.log(`Loaded ${Object.keys(settingsMap).length} scale settings for plan ${planId}`)
    return NextResponse.json({ settings: settingsMap })
  } catch (error) {
    console.error('Error in GET /api/plan/scale-settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/plan/scale-settings - Save scale settings for a plan page
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { planId, pageNumber, scaleRatio, pixelsPerUnit, unit, calibrationLine } = body

    if (!planId || pageNumber === undefined || !scaleRatio || pixelsPerUnit === undefined || !unit) {
      return NextResponse.json({ 
        error: 'Missing required fields: planId, pageNumber, scaleRatio, pixelsPerUnit, unit' 
      }, { status: 400 })
    }

    // Verify user has access to this plan (RLS policies will handle access control)
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Ensure pageNumber is an integer
    const pageNum = Number.parseInt(String(pageNumber), 10)
    if (isNaN(pageNum) || pageNum < 1) {
      return NextResponse.json({ 
        error: 'Invalid page number' 
      }, { status: 400 })
    }

    // Upsert scale setting
    // First try to update existing record
    const { data: existing, error: checkError } = await supabase
      .from('plan_scale_settings')
      .select('id')
      .eq('plan_id', planId)
      .eq('page_number', pageNum)
      .single()

    let setting
    let upsertError

    if (existing && !checkError) {
      // Update existing record
      const { data: updated, error: updateError } = await supabase
        .from('plan_scale_settings')
        .update({
          scale_ratio: scaleRatio,
          pixels_per_unit: pixelsPerUnit,
          unit: unit,
          calibration_line: calibrationLine || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      setting = updated
      upsertError = updateError
    } else {
      // Insert new record
      const { data: inserted, error: insertError } = await supabase
        .from('plan_scale_settings')
        .insert({
          plan_id: planId,
          page_number: pageNum,
          scale_ratio: scaleRatio,
          pixels_per_unit: pixelsPerUnit,
          unit: unit,
          calibration_line: calibrationLine || null,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      setting = inserted
      upsertError = insertError
    }

    if (upsertError) {
      console.error('Error saving scale setting:', {
        error: upsertError,
        planId,
        pageNumber: pageNum,
        scaleRatio,
        pixelsPerUnit,
        unit
      })
      // Check if table doesn't exist
      if (upsertError.code === '42P01') {
        return NextResponse.json({ 
          error: 'Database table not found. Please run the migration: supabase/migrations/20250128_plan_scale_settings.sql' 
        }, { status: 500 })
      }
      return NextResponse.json({ 
        error: 'Failed to save scale setting',
        details: upsertError.message 
      }, { status: 500 })
    }

    if (!setting) {
      console.error('No setting returned after upsert')
      return NextResponse.json({ error: 'Failed to save scale setting - no data returned' }, { status: 500 })
    }

    console.log(`Successfully saved scale setting for plan ${planId}, page ${pageNum}:`, {
      id: setting.id,
      ratio: setting.scale_ratio,
      pixelsPerUnit: setting.pixels_per_unit,
      unit: setting.unit
    })

    return NextResponse.json({ 
      success: true, 
      setting: {
        pageNumber: setting.page_number,
        ratio: setting.scale_ratio,
        pixelsPerUnit: Number(setting.pixels_per_unit),
        unit: setting.unit
      }
    })
  } catch (error) {
    console.error('Error in POST /api/plan/scale-settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

