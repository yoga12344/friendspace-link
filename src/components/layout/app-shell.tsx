'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/top-bar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useWorkspaceStore, type WorkspaceBasic } from '@/store/workspace-store'

interface AppShellProps {
  children: React.ReactNode
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  initialWorkspaces?: WorkspaceBasic[]
}

export function AppShell({ children, user, initialWorkspaces = [] }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces)

  useEffect(() => {
    if (initialWorkspaces.length > 0) {
      setWorkspaces(initialWorkspaces)
    }
  }, [initialWorkspaces, setWorkspaces])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        <TopBar
          user={user}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
            className="hidden md:flex"
          />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    </TooltipProvider>
  )
}
