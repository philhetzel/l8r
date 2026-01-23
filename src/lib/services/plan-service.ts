import { prisma } from '../prisma'

export interface PlanFilters {
  status?: string
  limit?: number
}

export const planService = {
  async getPlans(userId: string, filters?: PlanFilters) {
    const where: Record<string, unknown> = { userId }

    if (filters?.status) {
      where.status = filters.status
    }

    return prisma.installmentPlan.findMany({
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
          },
        },
        payments: {
          orderBy: { dueDate: 'asc' },
          select: {
            id: true,
            amount: true,
            dueDate: true,
            paidDate: true,
            status: true,
          },
        },
      },
    })
  },

  async getPlanById(planId: string, userId: string) {
    const plan = await prisma.installmentPlan.findFirst({
      where: { id: planId, userId },
      include: {
        order: true,
        payments: {
          orderBy: { dueDate: 'asc' },
        },
      },
    })

    if (!plan) {
      throw new Error('Installment plan not found')
    }

    const paidPayments = plan.payments.filter((p) => p.status === 'paid')
    const upcomingPayments = plan.payments.filter((p) => ['scheduled', 'pending'].includes(p.status))
    const failedPayments = plan.payments.filter((p) => p.status === 'failed')

    return {
      ...plan,
      progress: {
        paid: paidPayments.length,
        total: plan.numberOfPayments,
        percentComplete: Math.round((paidPayments.length / plan.numberOfPayments) * 100),
      },
      paidPayments,
      upcomingPayments,
      failedPayments,
    }
  },

  async getActivePlans(userId: string) {
    return prisma.installmentPlan.findMany({
      where: {
        userId,
        status: 'active',
      },
      orderBy: { nextPaymentDate: 'asc' },
      include: {
        order: {
          select: {
            id: true,
            merchantName: true,
            merchantCategory: true,
          },
        },
        payments: {
          where: {
            status: { in: ['scheduled', 'pending'] },
          },
          orderBy: { dueDate: 'asc' },
          take: 1,
        },
      },
    })
  },

  async modifyPlan(
    planId: string,
    userId: string,
    action: 'pause' | 'resume' | 'reschedule',
    newDate?: Date
  ) {
    const plan = await prisma.installmentPlan.findFirst({
      where: { id: planId, userId },
    })

    if (!plan) {
      throw new Error('Installment plan not found')
    }

    switch (action) {
      case 'pause':
        if (plan.status !== 'active') {
          throw new Error('Can only pause active plans')
        }
        return prisma.installmentPlan.update({
          where: { id: planId },
          data: { status: 'paused' },
          include: {
            order: {
              select: { merchantName: true },
            },
          },
        })

      case 'resume':
        if (plan.status !== 'paused') {
          throw new Error('Can only resume paused plans')
        }
        return prisma.installmentPlan.update({
          where: { id: planId },
          data: { status: 'active' },
          include: {
            order: {
              select: { merchantName: true },
            },
          },
        })

      case 'reschedule':
        if (!newDate) {
          throw new Error('New date is required for rescheduling')
        }
        if (plan.status !== 'active') {
          throw new Error('Can only reschedule active plans')
        }

        // Update next payment date
        const updatedPlan = await prisma.installmentPlan.update({
          where: { id: planId },
          data: { nextPaymentDate: newDate },
          include: {
            order: {
              select: { merchantName: true },
            },
          },
        })

        // Update the next scheduled payment
        const nextPayment = await prisma.payment.findFirst({
          where: {
            planId,
            status: { in: ['scheduled', 'pending'] },
          },
          orderBy: { dueDate: 'asc' },
        })

        if (nextPayment) {
          await prisma.payment.update({
            where: { id: nextPayment.id },
            data: { dueDate: newDate },
          })
        }

        return updatedPlan

      default:
        throw new Error('Invalid action')
    }
  },

  async getPlanSummary(userId: string) {
    const plans = await prisma.installmentPlan.findMany({
      where: { userId },
      select: {
        status: true,
        totalAmount: true,
        remainingAmount: true,
      },
    })

    const activePlans = plans.filter((p) => p.status === 'active')
    const totalOwed = activePlans.reduce((sum, p) => sum + p.remainingAmount, 0)
    const totalOriginal = plans.reduce((sum, p) => sum + p.totalAmount, 0)

    return {
      totalPlans: plans.length,
      activePlans: activePlans.length,
      totalOwed,
      totalOriginal,
      paidOff: totalOriginal - totalOwed,
    }
  },
}
