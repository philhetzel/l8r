'use client'

import * as React from 'react'
import Link from 'next/link'
import { ShoppingBag, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Order {
  id: string
  merchantName: string
  merchantCategory: string
  totalAmount: number
  status: string
  orderDate: string
  installmentPlan?: {
    id: string
    status: string
    remainingAmount: number
  }
}

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  completed: 'success',
  pending: 'warning',
  cancelled: 'destructive',
  refunded: 'secondary',
}

const categories = ['All', 'Electronics', 'Apparel', 'Home & Furniture', 'Beauty', 'General']

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState('All')

  React.useEffect(() => {
    fetch('/api/orders')
      .then((res) => res.json())
      .then((data) => {
        setOrders(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.merchantName.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || order.merchantCategory === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Orders
          </h1>
          <p className="text-muted-foreground">View and manage your orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="whitespace-nowrap"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredOrders.length} Order{filteredOrders.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted animate-pulse">
                  <div className="space-y-2">
                    <div className="h-4 w-40 rounded bg-zinc-700" />
                    <div className="h-3 w-32 rounded bg-zinc-700" />
                  </div>
                  <div className="h-6 w-20 rounded bg-zinc-700" />
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{order.merchantName}</p>
                      <Badge variant={statusVariants[order.status] || 'default'}>
                        {order.status}
                      </Badge>
                      {order.installmentPlan && (
                        <Badge variant="outline" className="text-xs">
                          Payment Plan
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.merchantCategory} • {formatDate(order.orderDate)}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
                    {order.installmentPlan && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(order.installmentPlan.remainingAmount)} remaining
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
