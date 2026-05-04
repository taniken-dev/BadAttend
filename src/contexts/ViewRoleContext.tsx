'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/lib/types'

const DEV_STORAGE_KEY = 'devViewRole'

type ViewRoleContextValue = {
  realRole: Role | null
  viewRole: Role | null
  setViewRole: (role: Role) => void
}

const ViewRoleContext = createContext<ViewRoleContextValue>({
  realRole: null,
  viewRole: null,
  setViewRole: () => {},
})

export function ViewRoleProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [realRole, setRealRole] = useState<Role | null>(null)
  const [viewRole, setViewRoleState] = useState<Role | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          const role = (data?.role ?? null) as Role | null
          setRealRole(role)

          if (process.env.NODE_ENV === 'development') {
            const stored = localStorage.getItem(DEV_STORAGE_KEY) as Role | null
            setViewRoleState(stored ?? role)
          } else {
            setViewRoleState(role)
          }
        })
    })
  }, [])

  function setViewRole(role: Role) {
    setViewRoleState(role)
    if (process.env.NODE_ENV === 'development') {
      localStorage.setItem(DEV_STORAGE_KEY, role)
    }
  }

  return (
    <ViewRoleContext.Provider value={{ realRole, viewRole, setViewRole }}>
      {children}
    </ViewRoleContext.Provider>
  )
}

export function useViewRole() {
  return useContext(ViewRoleContext)
}
