import { NextResponse } from 'next/server'
import { userService, orderService, planService, paymentService } from '@/lib/services'

const DEMO_USER_ID = 'user_demo_001'

export async function GET() {
  try {
    const [balance, recentOrders, upcomingPayments, failedPayments, activePlans] = await Promise.all([
      userService.getAccountBalance(DEMO_USER_ID),
      orderService.getRecentOrders(DEMO_USER_ID, 5),
      paymentService.getUpcomingPayments(DEMO_USER_ID, 5),
      paymentService.getFailedPayments(DEMO_USER_ID),
      planService.getActivePlans(DEMO_USER_ID),
    ])

    return NextResponse.json({
      balance,
      recentOrders,
      upcomingPayments,
      failedPayments,
      activePlans,
      alerts: {
        hasFailedPayments: failedPayments.length > 0,
        failedPaymentCount: failedPayments.length,
        nextPaymentDue: upcomingPayments[0]?.dueDate,
      },
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
