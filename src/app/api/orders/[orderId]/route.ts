import { NextRequest, NextResponse } from 'next/server'
import { orderService } from '@/lib/services'

const DEMO_USER_ID = 'user_demo_001'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const order = await orderService.getOrderById(orderId, DEMO_USER_ID)
    return NextResponse.json(order)
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}
