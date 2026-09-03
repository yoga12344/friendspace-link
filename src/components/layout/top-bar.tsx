'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Menu,
  Sun,
  Moon,
  Monitor,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Keyboard,
  Building2,
} from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'
import { NotificationCenter } from '@/components/notifications/notification-center'
import { CommandPalette } from '@/components/search/command-palette'
import { useState } from 'react'
import { Search } from 'lucide-react'

interface TopBarProps {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  onToggleSidebar: () => void
}

export function TopBar({ user, onToggleSidebar }: TopBarProps) {
  const { setTheme, theme } = useTheme()
  const [commandOpen, setCommandOpen] = useState(false)

  const ThemeIcon =
    theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <>
      <header className="h-12 border-b border-border bg-card flex items-center px-3 gap-3 flex-shrink-0 z-40">
        {/* Hamburger + Logo + Workspace Switcher */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex h-8 w-8"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">F</span>
            </div>
            <span className="font-semibold text-foreground text-sm hidden sm:block">
              FriendSpace
            </span>
          </Link>
          <span className="text-muted-foreground/40 mx-0.5 hidden sm:inline">/</span>
          <WorkspaceSwitcher />
        </div>

        {/* Global Search Bar Trigger */}
        <div className="flex-1 max-w-sm mx-auto hidden md:block">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground bg-muted/40 hover:bg-muted/70 rounded-lg border border-border/80 transition-colors shadow-none"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Search workspace or jump to...</span>
            </div>
            <kbd className="text-[10px] bg-background text-muted-foreground px-1.5 py-0.5 rounded border border-border font-mono font-medium">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Mobile Search Icon */}
        <div className="md:hidden flex-1 flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setCommandOpen(true)}
            title="Search"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Notification Center */}
          <NotificationCenter />
        {/* Theme toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Toggle theme"
            >
              <ThemeIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="mr-2 h-4 w-4" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="mr-2 h-4 w-4" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="mr-2 h-4 w-4" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 flex items-center gap-2 px-2 rounded-full"
              aria-label="User menu"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.image || ''} alt={user.name} />
                <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 text-[10px] font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:block max-w-[100px] truncate">
                {user.name.split(' ')[0]}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Building2 className="mr-2 h-4 w-4" />
                Workspace Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCommandOpen(true)} className="cursor-pointer">
              <Keyboard className="mr-2 h-4 w-4" />
              Keyboard Shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 cursor-pointer"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    {/* Command Palette & Global Search Modal */}
    <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
  </>
  )
}
