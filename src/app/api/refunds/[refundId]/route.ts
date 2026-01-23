import { NextRequest, NextResponse } from 'next/server'
import { refundService } from '@/lib/services'

const DEMO_USER_ID = 'user_demo_001'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  try {
    const { refundId } = await params
    const refund = await refundService.getRefundById(refundId, DEMO_USER_ID)
    return NextResponse.json(refund)
  } catch (error) {
    console.error('Error fetching refund:', error)
    return NextResponse.json(
      { error: 'Failed to fetch refund' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  try {
    const { refundId } = await params
    await refundService.cancelRefundRequest(refundId, DEMO_USER_ID)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cancelling refund:', error)
    const message = error instanceof Error ? error.message : 'Failed to cancel refund'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
