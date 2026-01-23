import { prisma } from '../prisma'

export interface OrderFilters {
  status?: string
  merchantCategory?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}

export const orderService = {
  async getOrders(userId: string, filters?: OrderFilters) {
    const where: Record<string, unknown> = { userId }

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.merchantCategory) {
      where.merchantCategory = filters.merchantCategory
    }

    if (filters?.startDate || filters?.endDate) {
      where.orderDate = {}
      if (filters.startDate) {
        (where.orderDate as Record<string, Date>).gte = filters.startDate
      }
      if (filters.endDate) {
        (where.orderDate as Record<string, Date>).lte = filters.endDate
      }
    }

    return prisma.order.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      take: filters?.limit || 50,
      include: {
        installmentPlan: {
          select: {
            id: true,
            status: true,
            remainingAmount: true,
            numberOfPayments: true,
          },
        },
      },
    })
  },

  async getOrderById(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        installmentPlan: {
          include: {
            payments: {
              orderBy: { dueDate: 'asc' },
            },
          },
        },
        refundRequests: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!order) {
      throw new Error('Order not found')
    }

    return order
  },

  async getRecentOrders(userId: string, limit = 5) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { orderDate: 'desc' },
      take: limit,
      include: {
        installmentPlan: {
          select: {
            id: true,
            status: true,
            remainingAmount: true,
          },
        },
      },
    })
  },

  async getOrderStats(userId: string) {
    const orders = await prisma.order.findMany({
      where: { userId },
      select: {
        totalAmount: true,
        status: true,
        merchantCategory: true,
      },
    })

    const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0)
    const orderCount = orders.length

    const byCategory = orders.reduce((acc, order) => {
      acc[order.merchantCategory] = (acc[order.merchantCategory] || 0) + order.totalAmount
      return acc
    }, {} as Record<string, number>)

    return {
      totalSpent,
      orderCount,
      averageOrderValue: orderCount > 0 ? totalSpent / orderCount : 0,
      byCategory,
    }
  },
}
