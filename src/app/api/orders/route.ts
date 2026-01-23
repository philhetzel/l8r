import { NextRequest, NextResponse } from 'next/server'
import { orderService } from '@/lib/services'

// Demo user ID - in production would come from auth
const DEMO_USER_ID = 'user_demo_001'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const category = searchParams.get('category') || undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : undefined

    const orders = await orderService.getOrders(DEMO_USER_ID, {
      status,
      merchantCategory: category,
      limit,
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
