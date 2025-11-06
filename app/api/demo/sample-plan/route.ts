import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const SAMPLE_PLAN_PATH = path.join(process.cwd(), 'docs', 'Building A Silver Creek.pdf')

export async function GET() {
  try {
    const fileBuffer = await fs.readFile(SAMPLE_PLAN_PATH)

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Building-A-Silver-Creek.pdf"',
        'Cache-Control': 'public, max-age=0, must-revalidate'
      }
    })
  } catch (error) {
    console.error('Failed to load sample plan PDF:', error)
    return NextResponse.json(
      { error: 'Sample plan not available.' },
      { status: 500 }
    )
  }
}
