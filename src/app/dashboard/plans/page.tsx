'use client'

import * as React from 'react'
import { Calendar, Pause, Play, CalendarClock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateRelative } from '@/lib/utils'

interface Payment {
  id: string
  amount: number
  dueDate: string
  paidDate?: string
  status: string
}

interface Plan {
  id: string
  totalAmount: number
  numberOfPayments: number
  remainingAmount: number
  nextPaymentDate?: string
  status: string
  order: {
    id: string
    merchantName: string
    merchantCategory: string
    totalAmount: number
  }
  payments: Payment[]
}

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'secondary' | 'destructive'> = {
  active: 'success',
  paused: 'warning',
  completed: 'secondary',
  cancelled: 'destructive',
}

export default function PlansPage() {
  const [plans, setPlans] = React.useState<Plan[]>([])
  const [loading, setLoading] = React.useState(true)
  const [modifying, setModifying] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch('/api/plans')
      .then((res) => res.json())
      .then((data) => {
        setPlans(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleModify = async (planId: string, action: 'pause' | 'resume') => {
    setModifying(planId)
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const result = await res.json()
      if (!result.error) {
        setPlans((prev) =>
          prev.map((p) =>
            p.id === planId ? { ...p, status: action === 'pause' ? 'paused' : 'active' } : p
          )
        )
      }
    } finally {
      setModifying(null)
    }
  }

  const activePlans = plans.filter((p) => p.status === 'active')
  const totalOwed = activePlans.reduce((sum, p) => sum + p.remainingAmount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6 text-primary" />
          Payment Plans
        </h1>
        <p className="text-muted-foreground">Manage your installment plans</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Plans</p>
                <p className="text-2xl font-bold">{activePlans.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Remaining</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalOwed)}</p>
              </div>
              <CalendarClock className="h-8 w-8 text-secondary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Plans</p>
                <p className="text-2xl font-bold">{plans.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans List */}
      <div className="space-y-4">
        {loading ? (
          [1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-40 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-3/4 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : plans.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No payment plans</p>
            </CardContent>
          </Card>
        ) : (
          plans.map((plan) => {
            const paidPayments = plan.payments.filter((p) => p.status === 'paid')
            const progress = (paidPayments.length / plan.numberOfPayments) * 100

            return (
              <Card key={plan.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="truncate">{plan.order.merchantName}</CardTitle>
                      <Badge variant={statusVariants[plan.status] || 'default'}>
                        {plan.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.order.merchantCategory} • {formatCurrency(plan.totalAmount)} total
                    </p>
                  </div>
                  {plan.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleModify(plan.id, 'pause')}
                      disabled={modifying === plan.id}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  {plan.status === 'paused' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleModify(plan.id, 'resume')}
                      disabled={modifying === plan.id}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Resume
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span>
                        {paidPayments.length} of {plan.numberOfPayments} payments
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Remaining Balance</p>
                      <p className="text-xl font-semibold text-primary">
                        {formatCurrency(plan.remainingAmount)}
                      </p>
                    </div>
                    {plan.nextPaymentDate && plan.status === 'active' && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Next Payment</p>
                        <p className="text-xl font-semibold">
                          {formatDateRelative(plan.nextPaymentDate)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payment Schedule */}
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">Payment Schedule</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {plan.payments.map((payment, idx) => (
                        <div
                          key={payment.id}
                          className={`flex-shrink-0 p-2 rounded-lg text-center min-w-[80px] ${
                            payment.status === 'paid'
                              ? 'bg-green-500/20 text-green-400'
                              : payment.status === 'failed'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <p className="text-xs">#{idx + 1}</p>
                          <p className="font-semibold text-sm">
                            {formatCurrency(payment.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
