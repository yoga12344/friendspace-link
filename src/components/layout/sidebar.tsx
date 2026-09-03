'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Inbox,
  MessageSquare,
  CheckSquare,
  FolderKanban,
  FileText,
  Calendar,
  Paperclip,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home', enabled: true },
  { href: '/inbox', icon: Inbox, label: 'Inbox', enabled: true },
  { href: '/chat', icon: MessageSquare, label: 'Chat', enabled: true },
  { href: '/tasks', icon: CheckSquare, label: 'My Tasks', enabled: true },
  { href: '/projects', icon: FolderKanban, label: 'Projects', enabled: true },
  { href: '/docs', icon: FileText, label: 'Docs', enabled: true },
  { href: '/calendar', icon: Calendar, label: 'Calendar', enabled: true },
  { href: '/files', icon: Paperclip, label: 'Files', enabled: true },
  { href: '/members', icon: Users, label: 'Members', enabled: true },
  { href: '/settings', icon: Settings, label: 'Settings', enabled: true },
]

interface SidebarProps {
  collapsed: boolean
  onCollapse: (collapsed: boolean) => void
  className?: string
}

export function Sidebar({ collapsed, onCollapse, className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-card transition-all duration-200 flex-shrink-0',
        collapsed ? 'w-[52px]' : 'w-56',
        className
      )}
    >
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const isDisabled = !item.enabled

          const linkContent = (
            <span
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors w-full',
                isActive && !isDisabled
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                isDisabled && 'opacity-40 cursor-not-allowed'
              )}
            >
              <item.icon
                className={cn(
                  'h-4 w-4 flex-shrink-0',
                  isActive && !isDisabled
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : ''
                )}
              />
              {!collapsed && (
                <>
                  <span className="truncate flex-1">{item.label}</span>
                  {isDisabled && (
                    <span className="text-[10px] font-normal bg-muted rounded px-1 py-0.5 text-muted-foreground">
                      Soon
                    </span>
                  )}
                </>
              )}
            </span>
          )

          const node = isDisabled ? (
            <div key={item.href} aria-disabled="true">
              {linkContent}
            </div>
          ) : (
            <Link key={item.href} href={item.href} className="block">
              {linkContent}
            </Link>
          )

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  {isDisabled ? (
                    <div aria-disabled="true">{linkContent}</div>
                  ) : (
                    <Link href={item.href} className="block">
                      {linkContent}
                    </Link>
                  )}
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}
                  {isDisabled && ' (Coming Soon)'}
                </TooltipContent>
              </Tooltip>
            )
          }

          return node
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'w-full text-muted-foreground hover:text-foreground',
            collapsed ? 'justify-center px-0' : 'justify-start gap-2'
          )}
          onClick={() => onCollapse(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
