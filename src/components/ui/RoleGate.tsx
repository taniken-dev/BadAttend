'use client'

import { useViewRole } from '@/contexts/ViewRoleContext'
import type { ReactNode } from 'react'

export function HideFor({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { viewRole } = useViewRole()
  if (!viewRole || roles.includes(viewRole)) return null
  return <>{children}</>
}
