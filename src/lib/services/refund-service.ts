import { prisma } from '../prisma'

export interface RefundFilters {
  status?: string
  limit?: number
}

export const refundService = {
  async getRefundRequests(userId: string, filters?: RefundFilters) {
    const where: Record<string, unknown> = { userId }

    if (filters?.status) {
      where.status = filters.status
    }

    return prisma.refundRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      include: {
        order: {
          select: {
            id: true,
            merchantName: true,
            merchantCategory: true,
            totalAmount: true,
            orderDate: true,
          },
        },
      },
    })
  },

  async getRefundById(refundId: string, userId: string) {
    const refund = await prisma.refundRequest.findFirst({
      where: { id: refundId, userId },
      include: {
        order: true,
      },
    })

    if (!refund) {
      throw new Error('Refund request not found')
    }

    return refund
  },

  async requestRefund(
    userId: string,
    orderId: string,
    reason: string,
    amount?: number
  ) {
    // Check if order exists and belongs to user
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        refundRequests: {
          where: {
            status: { in: ['pending', 'approved'] },
          },
        },
      },
    })

    if (!order) {
      throw new Error('Order not found')
    }

    // Check if there's already a pending/approved refund
    if (order.refundRequests.length > 0) {
      throw new Error('A refund request already exists for this order')
    }

    // Check if order is eligible for refund (within 30 days)
    const orderDate = new Date(order.orderDate)
    const daysSinceOrder = Math.floor(
      (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSinceOrder > 30) {
      throw new Error(
        'Orders older than 30 days are not eligible for refunds. Please contact support for assistance.'
      )
    }

    // Create refund request
    const refundAmount = amount || order.totalAmount
    const refund = await prisma.refundRequest.create({
      data: {
        userId,
        orderId,
        reason,
        amount: refundAmount,
        status: 'pending',
      },
      include: {
        order: {
          select: {
            merchantName: true,
            totalAmount: true,
          },
        },
      },
    })

    return {
      refund,
      message: `Refund request for $${refundAmount.toFixed(2)} has been submitted. You will receive an update within 3-5 business days.`,
    }
  },

  async cancelRefundRequest(refundId: string, userId: string) {
    const refund = await prisma.refundRequest.findFirst({
      where: { id: refundId, userId },
    })

    if (!refund) {
      throw new Error('Refund request not found')
    }

    if (refund.status !== 'pending') {
      throw new Error('Can only cancel pending refund requests')
    }

    return prisma.refundRequest.delete({
      where: { id: refundId },
    })
  },

  async getRefundSummary(userId: string) {
    const refunds = await prisma.refundRequest.findMany({
      where: { userId },
      select: {
        status: true,
        amount: true,
      },
    })

    const pending = refunds.filter((r) => r.status === 'pending')
    const approved = refunds.filter((r) => r.status === 'approved')
    const processed = refunds.filter((r) => r.status === 'processed')

    return {
      totalRequests: refunds.length,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, r) => sum + r.amount, 0),
      approvedCount: approved.length,
      processedCount: processed.length,
      totalRefunded: processed.reduce((sum, r) => sum + r.amount, 0),
    }
  },
}
