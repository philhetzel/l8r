'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-primary text-black hover:bg-primary-400 active:bg-primary-600':
              variant === 'default',
            'bg-secondary text-white hover:bg-secondary-400 active:bg-secondary-600':
              variant === 'secondary',
            'border border-border bg-transparent hover:bg-muted text-foreground':
              variant === 'outline',
            'hover:bg-muted text-foreground': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-500 active:bg-red-700':
              variant === 'destructive',
          },
          {
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3 text-sm': size === 'sm',
            'h-11 rounded-lg px-8': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
