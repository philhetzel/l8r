'use client'

import * as React from 'react'
import Link from 'next/link'
import { Calendar, ArrowRight, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateRelative } from '@/lib/utils'

interface Payment {
  id: string
  amount: number
  dueDate: string
  status: string
  failureReason?: string
  plan: {
    order: {
      id: string
      merchantName: string
    }
  }
}

export function UpcomingPayments() {
  const [payments, setPayments] = React.useState<Payment[]>([])
  const [failedPayments, setFailedPayments] = React.useState<Payment[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    Promise.all([
      fetch('/api/payments?status=scheduled&limit=5').then((res) => res.json()),
      fetch('/api/payments?status=failed').then((res) => res.json()),
    ])
      .then(([upcoming, failed]) => {
        setPayments(upcoming)
        setFailedPayments(failed)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Upcoming Payments
        </CardTitle>
        <Link href="/dashboard/payments">
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
        ) : (
          <div className="space-y-3">
            {/* Failed payments alert */}
            {failedPayments.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-400">
                    {failedPayments.length} failed payment{failedPayments.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {failedPayments[0].plan.order.merchantName} - {formatCurrency(failedPayments[0].amount)}
                  </p>
                  <Link href="/dashboard/payments">
                    <Button variant="destructive" size="sm" className="mt-2">
                      Retry Payment
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Upcoming payments */}
            {payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No upcoming payments
              </p>
            ) : (
              payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {payment.plan.order.merchantName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Due {formatDateRelative(payment.dueDate)}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                    <Badge variant="outline" className="text-xs">
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
