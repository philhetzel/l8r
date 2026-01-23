import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/lib/services'

const DEMO_USER_ID = 'user_demo_001'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const planId = searchParams.get('planId') || undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : undefined

    const payments = await paymentService.getPayments(DEMO_USER_ID, {
      status,
      planId,
      limit,
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}
