import { prisma } from '../prisma'

export const userService = {
  async getUser(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
    })
  },

  async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    })
  },

  async getAccountBalance(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        creditLimit: true,
        availableCredit: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const usedCredit = user.creditLimit - user.availableCredit

    return {
      userId: user.id,
      name: user.name,
      creditLimit: user.creditLimit,
      availableCredit: user.availableCredit,
      usedCredit,
      utilizationPercent: Math.round((usedCredit / user.creditLimit) * 100),
    }
  },

  async updateAvailableCredit(userId: string, amount: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { availableCredit: amount },
    })
  },
}
