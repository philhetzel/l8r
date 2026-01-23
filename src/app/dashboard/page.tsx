import {
  AccountSummary,
  RecentOrders,
  UpcomingPayments,
  SpendingChart,
} from '@/components/dashboard'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold">Welcome back, Alex</h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your l8r account
        </p>
      </div>

      {/* Account Summary Cards */}
      <AccountSummary />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentOrders />
        <UpcomingPayments />
      </div>

      {/* Spending Chart */}
      <SpendingChart />
    </div>
  )
}
