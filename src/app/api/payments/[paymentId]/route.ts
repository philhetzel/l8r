import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/lib/services'

const DEMO_USER_ID = 'user_demo_001'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const payment = await paymentService.getPaymentById(paymentId, DEMO_USER_ID)
    return NextResponse.json(payment)
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment' },
      { status: 500 }
    )
  }
}
