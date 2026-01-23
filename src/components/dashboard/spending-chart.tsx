'use client'

import * as React from 'react'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface CategorySpending {
  category: string
  amount: number
  color: string
}

const categoryColors: Record<string, string> = {
  Electronics: '#00D4AA',
  Apparel: '#6366F1',
  'Home & Furniture': '#F59E0B',
  Beauty: '#EC4899',
  General: '#8B5CF6',
}

export function SpendingChart() {
  const [data, setData] = React.useState<CategorySpending[]>([])
  const [loading, setLoading] = React.useState(true)
  const [total, setTotal] = React.useState(0)

  React.useEffect(() => {
    fetch('/api/orders')
      .then((res) => res.json())
      .then((orders) => {
        // Calculate spending by category
        const byCategory: Record<string, number> = {}
        let totalAmount = 0

        orders.forEach((order: { merchantCategory: string; totalAmount: number }) => {
          byCategory[order.merchantCategory] =
            (byCategory[order.merchantCategory] || 0) + order.totalAmount
          totalAmount += order.totalAmount
        })

        const chartData = Object.entries(byCategory)
          .map(([category, amount]) => ({
            category,
            amount,
            color: categoryColors[category] || '#6366F1',
          }))
          .sort((a, b) => b.amount - a.amount)

        setData(chartData)
        setTotal(totalAmount)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const maxAmount = Math.max(...data.map((d) => d.amount), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Spending by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
                <div className="h-3 w-full rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No spending data</p>
        ) : (
          <>
            <div className="mb-4 text-center">
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(total)}</p>
            </div>

            <div className="space-y-4">
              {data.map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.category}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(item.amount / maxAmount) * 100}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
