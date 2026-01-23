import { NextRequest, NextResponse } from 'next/server'
import { refundService } from '@/lib/services'

const DEMO_USER_ID = 'user_demo_001'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : undefined

    const refunds = await refundService.getRefundRequests(DEMO_USER_ID, {
      status,
      limit,
    })

    return NextResponse.json(refunds)
  } catch (error) {
    console.error('Error fetching refunds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch refunds' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, reason, amount } = body

    if (!orderId || !reason) {
      return NextResponse.json(
        { error: 'orderId and reason are required' },
        { status: 400 }
      )
    }

    const result = await refundService.requestRefund(
      DEMO_USER_ID,
      orderId,
      reason,
      amount
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating refund:', error)
    const message = error instanceof Error ? error.message : 'Failed to create refund'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
