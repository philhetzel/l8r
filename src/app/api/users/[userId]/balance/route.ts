import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/lib/services'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const balance = await userService.getAccountBalance(userId)
    return NextResponse.json(balance)
  } catch (error) {
    console.error('Error fetching balance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    )
  }
}
