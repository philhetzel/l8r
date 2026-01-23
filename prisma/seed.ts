import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean existing data
  await prisma.payment.deleteMany()
  await prisma.refundRequest.deleteMany()
  await prisma.installmentPlan.deleteMany()
  await prisma.order.deleteMany()
  await prisma.user.deleteMany()

  // Create demo user
  const user = await prisma.user.create({
    data: {
      id: 'user_demo_001',
      email: 'alex.johnson@email.com',
      name: 'Alex Johnson',
      creditLimit: 5000,
      availableCredit: 2847.50,
    },
  })

  console.log('Created user:', user.name)

  // Create orders with varied merchants and dates
  const orders = await Promise.all([
    prisma.order.create({
      data: {
        id: 'order_001',
        userId: user.id,
        merchantName: 'Apple Store',
        merchantCategory: 'Electronics',
        totalAmount: 1299.00,
        status: 'completed',
        orderDate: new Date('2024-12-15'),
      },
    }),
    prisma.order.create({
      data: {
        id: 'order_002',
        userId: user.id,
        merchantName: 'Nike',
        merchantCategory: 'Apparel',
        totalAmount: 245.00,
        status: 'completed',
        orderDate: new Date('2024-12-20'),
      },
    }),
    prisma.order.create({
      data: {
        id: 'order_003',
        userId: user.id,
        merchantName: 'IKEA',
        merchantCategory: 'Home & Furniture',
        totalAmount: 589.50,
        status: 'completed',
        orderDate: new Date('2025-01-02'),
      },
    }),
    prisma.order.create({
      data: {
        id: 'order_004',
        userId: user.id,
        merchantName: 'Best Buy',
        merchantCategory: 'Electronics',
        totalAmount: 449.99,
        status: 'completed',
        orderDate: new Date('2025-01-08'),
      },
    }),
    prisma.order.create({
      data: {
        id: 'order_005',
        userId: user.id,
        merchantName: 'Sephora',
        merchantCategory: 'Beauty',
        totalAmount: 127.00,
        status: 'completed',
        orderDate: new Date('2025-01-12'),
      },
    }),
    prisma.order.create({
      data: {
        id: 'order_006',
        userId: user.id,
        merchantName: 'Amazon',
        merchantCategory: 'General',
        totalAmount: 89.99,
        status: 'pending',
        orderDate: new Date('2025-01-18'),
      },
    }),
  ])

  console.log(`Created ${orders.length} orders`)

  // Create installment plans for larger orders
  const plans = await Promise.all([
    // Apple Store - 4 payments, 2 paid, 2 remaining
    prisma.installmentPlan.create({
      data: {
        id: 'plan_001',
        userId: user.id,
        orderId: 'order_001',
        totalAmount: 1299.00,
        numberOfPayments: 4,
        remainingAmount: 649.50,
        nextPaymentDate: new Date('2025-02-15'),
        status: 'active',
      },
    }),
    // IKEA - 4 payments, 1 paid, 3 remaining
    prisma.installmentPlan.create({
      data: {
        id: 'plan_002',
        userId: user.id,
        orderId: 'order_003',
        totalAmount: 589.50,
        numberOfPayments: 4,
        remainingAmount: 442.13,
        nextPaymentDate: new Date('2025-02-02'),
        status: 'active',
      },
    }),
    // Best Buy - 4 payments, all pending
    prisma.installmentPlan.create({
      data: {
        id: 'plan_003',
        userId: user.id,
        orderId: 'order_004',
        totalAmount: 449.99,
        numberOfPayments: 4,
        remainingAmount: 449.99,
        nextPaymentDate: new Date('2025-02-08'),
        status: 'active',
      },
    }),
  ])

  console.log(`Created ${plans.length} installment plans`)

  // Create payments
  const payments = await Promise.all([
    // Apple Store payments - 2 paid, 2 upcoming
    prisma.payment.create({
      data: {
        userId: user.id,
        planId: 'plan_001',
        amount: 324.75,
        dueDate: new Date('2024-12-15'),
        paidDate: new Date('2024-12-15'),
        status: 'paid',
      },
    }),
    prisma.payment.create({
      data: {
        userId: user.id,
        planId: 'plan_001',
        amount: 324.75,
        dueDate: new Date('2025-01-15'),
        paidDate: new Date('2025-01-15'),
        status: 'paid',
      },
    }),
    prisma.payment.create({
      data: {
        id: 'payment_upcoming_001',
        userId: user.id,
        planId: 'plan_001',
        amount: 324.75,
        dueDate: new Date('2025-02-15'),
        status: 'scheduled',
      },
    }),
    prisma.payment.create({
      data: {
        userId: user.id,
        planId: 'plan_001',
        amount: 324.75,
        dueDate: new Date('2025-03-15'),
        status: 'scheduled',
      },
    }),

    // IKEA payments - 1 paid, 1 FAILED, 2 upcoming
    prisma.payment.create({
      data: {
        userId: user.id,
        planId: 'plan_002',
        amount: 147.38,
        dueDate: new Date('2025-01-02'),
        paidDate: new Date('2025-01-02'),
        status: 'paid',
      },
    }),
    prisma.payment.create({
      data: {
        id: 'payment_failed_001',
        userId: user.id,
        planId: 'plan_002',
        amount: 147.38,
        dueDate: new Date('2025-02-02'),
        status: 'failed',
        failureReason: 'Insufficient funds in linked payment method',
      },
    }),
    prisma.payment.create({
      data: {
        userId: user.id,
        planId: 'plan_002',
        amount: 147.37,
        dueDate: new Date('2025-03-02'),
        status: 'scheduled',
      },
    }),
    prisma.payment.create({
      data: {
        userId: user.id,
        planId: 'plan_002',
        amount: 147.37,
        dueDate: new Date('2025-04-02'),
        status: 'scheduled',
      },
    }),

    // Best Buy payments - all pending
    prisma.payment.create({
      data: {
        userId: user.id,
        planId: 'plan_003',
        amount: 112.50,
        dueDate: new Date('2025-02-08'),
        status: 'scheduled',
      },
    }),
    prisma.payment.create({
      data: {
        userId: user.id,
        planId: 'plan_003',
        amount: 112.50,
        dueDate: new Date('2025-03-08'),
        status: 'scheduled',
      },
    }),
    prisma.payment.create({
      data: {
        userId: user.id,
        planId: 'plan_003',
        amount: 112.50,
        dueDate: new Date('2025-04-08'),
        status: 'scheduled',
      },
    }),
    prisma.payment.create({
      data: {
        userId: user.id,
        planId: 'plan_003',
        amount: 112.49,
        dueDate: new Date('2025-05-08'),
        status: 'scheduled',
      },
    }),
  ])

  console.log(`Created ${payments.length} payments`)

  // Create a sample refund request
  const refund = await prisma.refundRequest.create({
    data: {
      userId: user.id,
      orderId: 'order_002',
      reason: 'Item did not fit as expected',
      amount: 245.00,
      status: 'pending',
    },
  })

  console.log('Created refund request for Nike order')

  console.log('\n✅ Seed completed successfully!')
  console.log('\nDemo account:')
  console.log(`  Email: ${user.email}`)
  console.log(`  Credit Limit: $${user.creditLimit}`)
  console.log(`  Available Credit: $${user.availableCredit}`)
  console.log(`\nDemo scenarios:`)
  console.log('  - Failed payment on IKEA order (payment_failed_001)')
  console.log('  - Pending refund request for Nike order')
  console.log('  - Multiple active payment plans')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
