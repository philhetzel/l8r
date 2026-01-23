import { NextRequest, NextResponse } from 'next/server'
import { planService } from '@/lib/services'

const DEMO_USER_ID = 'user_demo_001'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params
    const plan = await planService.getPlanById(planId, DEMO_USER_ID)
    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error fetching plan:', error)
    return NextResponse.json(
      { error: 'Failed to fetch plan' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params
    const body = await request.json()
    const { action, newDate } = body

    if (!['pause', 'resume', 'reschedule'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be pause, resume, or reschedule' },
        { status: 400 }
      )
    }

    const plan = await planService.modifyPlan(
      planId,
      DEMO_USER_ID,
      action,
      newDate ? new Date(newDate) : undefined
    )

    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error modifying plan:', error)
    const message = error instanceof Error ? error.message : 'Failed to modify plan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
