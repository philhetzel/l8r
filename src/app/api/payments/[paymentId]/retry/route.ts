import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/lib/services'

const DEMO_USER_ID = 'user_demo_001'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const result = await paymentService.retryPayment(paymentId, DEMO_USER_ID)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error retrying payment:', error)
    const message = error instanceof Error ? error.message : 'Failed to retry payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
