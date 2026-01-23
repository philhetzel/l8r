import { NextRequest, NextResponse } from 'next/server'
import { planService } from '@/lib/services'

const DEMO_USER_ID = 'user_demo_001'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : undefined

    const plans = await planService.getPlans(DEMO_USER_ID, {
      status,
      limit,
    })

    return NextResponse.json(plans)
  } catch (error) {
    console.error('Error fetching plans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    )
  }
}
