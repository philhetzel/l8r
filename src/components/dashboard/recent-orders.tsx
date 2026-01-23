'use client'

import * as React from 'react'
import Link from 'next/link'
import { ShoppingBag, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Order {
  id: string
  merchantName: string
  merchantCategory: string
  totalAmount: number
  status: string
  orderDate: string
}

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  completed: 'success',
  pending: 'warning',
  cancelled: 'destructive',
  refunded: 'secondary',
}

export function RecentOrders() {
  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/orders?limit=5')
      .then((res) => res.json())
      .then((data) => {
        setOrders(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          Recent Orders
        </CardTitle>
        <Link href="/dashboard/orders">
          <Button variant="ghost" size="sm">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-zinc-700" />
                  <div className="h-3 w-24 rounded bg-zinc-700" />
                </div>
                <div className="h-4 w-16 rounded bg-zinc-700" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No orders yet</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/dashboard/orders/${order.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{order.merchantName}</p>
                    <Badge variant={statusVariants[order.status] || 'default'}>
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {order.merchantCategory} • {formatDate(order.orderDate)}
                  </p>
                </div>
                <p className="font-semibold ml-4">{formatCurrency(order.totalAmount)}</p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
