'use client'

import { ViewRoleProvider } from '@/contexts/ViewRoleContext'
import DevRoleSwitcher from '@/components/debug/DevRoleSwitcher'
import PwaReturnBanner from '@/components/ui/PwaReturnBanner'
import type { ReactNode } from 'react'

export default function DashboardClientShell({ children }: { children: ReactNode }) {
  return (
    <ViewRoleProvider>
      {children}
      <PwaReturnBanner />
      <DevRoleSwitcher />
    </ViewRoleProvider>
  )
}
