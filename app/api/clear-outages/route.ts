import { NextRequest, NextResponse } from 'next/server'
import { clearAllOutageData } from '@/lib/database'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companySlug = searchParams.get('company')
    
    const result = clearAllOutageData(companySlug || undefined)
    
    return NextResponse.json({
      success: true,
      message: `Successfully cleared outage data${companySlug ? ` for ${companySlug}` : ' for all companies'}`,
      deleted: result
    })
  } catch (error) {
    console.error('Error clearing outage data:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear outage data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companySlug } = body
    
    const result = clearAllOutageData(companySlug)
    
    return NextResponse.json({
      success: true,
      message: `Successfully cleared outage data${companySlug ? ` for ${companySlug}` : ' for all companies'}`,
      deleted: result
    })
  } catch (error) {
    console.error('Error clearing outage data:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear outage data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
