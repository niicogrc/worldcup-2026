import React from 'react'
import { type LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface EmptyStateProps {
  title: string
  description: string
  icon?: LucideIcon
  action?: {
    label: string
    href: string
  }
}

export default function EmptyState({ title, description, icon: Icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {Icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#13151c] border border-[#1f2333]">
          <Icon className="h-8 w-8 text-zinc-700" />
        </div>
      )}
      <h2 className="text-lg font-semibold text-zinc-300">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
