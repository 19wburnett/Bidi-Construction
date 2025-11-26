import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    
    // Verify masquerade is active
    const masqueradeAdminId = cookieStore.get('masquerade_admin_id')?.value
    const masqueradeUserId = cookieStore.get('masquerade_user_id')?.value

    if (!masqueradeAdminId || !masqueradeUserId) {
      return NextResponse.json(
        { error: 'Not currently masquerading' },
        { status: 400 }
      )
    }

    // Clear masquerade cookies
    const response = NextResponse.json({ success: true })
    
    response.cookies.delete('masquerade_admin_id')
    response.cookies.delete('masquerade_user_id')

    return response
  } catch (error) {
    console.error('Error stopping masquerade:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}





