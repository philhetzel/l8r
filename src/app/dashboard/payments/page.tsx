'use client'

import * as React from 'react'
import { CreditCard, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, formatDateRelative } from '@/lib/utils'

interface Payment {
  id: string
  amount: number
  dueDate: string
  paidDate?: string
  status: string
  failureReason?: string
  plan: {
    order: {
      id: string
      merchantName: string
    }
  }
}

const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'destructive'; icon: React.ReactNode }> = {
  paid: { variant: 'success', icon: <CheckCircle className="h-4 w-4" /> },
  scheduled: { variant: 'default', icon: <Clock className="h-4 w-4" /> },
  pending: { variant: 'warning', icon: <Clock className="h-4 w-4" /> },
  failed: { variant: 'destructive', icon: <AlertCircle className="h-4 w-4" /> },
}

export default function PaymentsPage() {
  const [payments, setPayments] = React.useState<Payment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<'all' | 'upcoming' | 'paid' | 'failed'>('all')
  const [retrying, setRetrying] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch('/api/payments')
      .then((res) => res.json())
      .then((data) => {
        setPayments(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleRetry = async (paymentId: string) => {
    setRetrying(paymentId)
    try {
      const res = await fetch(`/api/payments/${paymentId}/retry`, { method: 'POST' })
      const result = await res.json()
      if (result.success) {
        // Update payment in state
        setPayments((prev) =>
          prev.map((p) => (p.id === paymentId ? { ...p, status: 'paid', paidDate: new Date().toISOString() } : p))
        )
      }
    } finally {
      setRetrying(null)
    }
  }

  const filteredPayments = payments.filter((payment) => {
    switch (filter) {
      case 'upcoming':
        return ['scheduled', 'pending'].includes(payment.status)
      case 'paid':
        return payment.status === 'paid'
      case 'failed':
        return payment.status === 'failed'
      default:
        return true
    }
  })

  const failedCount = payments.filter((p) => p.status === 'failed').length
  const upcomingCount = payments.filter((p) => ['scheduled', 'pending'].includes(p.status)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Payments
        </h1>
        <p className="text-muted-foreground">Manage your payment schedule</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold">{upcomingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{payments.filter((p) => p.status === 'paid').length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className={failedCount > 0 ? 'border-red-500/50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-400">{failedCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'upcoming', 'paid', 'failed'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredPayments.length} Payment{filteredPayments.length !== 1 ? 's' : ''}
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
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No payments found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPayments.map((payment) => {
                const config = statusConfig[payment.status] || statusConfig.pending
                return (
                  <div
                    key={payment.id}
                    className={`flex items-center justify-between p-4 rounded-lg bg-muted/50 ${
                      payment.status === 'failed' ? 'border border-red-500/30' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{payment.plan.order.merchantName}</p>
                        <Badge variant={config.variant} className="flex items-center gap-1">
                          {config.icon}
                          {payment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {payment.status === 'paid'
                          ? `Paid ${formatDate(payment.paidDate!)}`
                          : `Due ${formatDateRelative(payment.dueDate)}`}
                      </p>
                      {payment.failureReason && (
                        <p className="text-xs text-red-400 mt-1">{payment.failureReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                      {payment.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRetry(payment.id)}
                          disabled={retrying === payment.id}
                        >
                          {retrying === payment.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            'Retry'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
