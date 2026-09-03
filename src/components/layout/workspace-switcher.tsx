'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWorkspaceStore } from '@/store/workspace-store'
import { Check, ChevronDown, Plus, Settings2, Building2 } from 'lucide-react'
import { CreateWorkspaceModal } from '@/components/workspace/create-workspace-modal'
import { EditWorkspaceModal } from '@/components/workspace/edit-workspace-modal'
import { useRouter } from 'next/navigation'

export function WorkspaceSwitcher() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  const {
    workspaces,
    currentWorkspaceId,
    setCurrentWorkspace,
    getCurrentWorkspace,
  } = useWorkspaceStore()

  const currentWorkspace = getCurrentWorkspace()

  const handleSwitch = (id: string) => {
    setCurrentWorkspace(id)
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 px-2 text-sm font-medium hover:bg-muted"
            >
              <div className="w-5 h-5 bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 rounded flex items-center justify-center text-xs shrink-0">
                {currentWorkspace?.icon || <Building2 className="h-3 w-3" />}
              </div>
              <span className="max-w-[140px] truncate text-foreground font-semibold">
                {currentWorkspace?.name || 'Select Workspace'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Workspaces
            </DropdownMenuLabel>

            {workspaces.map((ws) => {
              const isSelected = ws.id === currentWorkspaceId
              return (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => handleSwitch(ws.id)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-sm shrink-0">{ws.icon || '🏠'}</span>
                    <span className="truncate font-medium">{ws.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 uppercase">
                      {ws.role.toLowerCase()}
                    </Badge>
                    {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                  </div>
                </DropdownMenuItem>
              )
            })}

            {workspaces.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                No workspaces yet
              </div>
            )}

            <DropdownMenuSeparator />

            {currentWorkspace && (currentWorkspace.role === 'OWNER' || currentWorkspace.role === 'ADMIN') && (
              <DropdownMenuItem
                onClick={() => setEditOpen(true)}
                className="cursor-pointer gap-2"
              >
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span>Workspace Settings</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => setCreateOpen(true)}
              className="cursor-pointer gap-2 text-indigo-600 dark:text-indigo-400 font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>Create workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreateWorkspaceModal open={createOpen} onOpenChange={setCreateOpen} />
      <EditWorkspaceModal
        open={editOpen}
        onOpenChange={setEditOpen}
        workspace={currentWorkspace}
      />
    </>
  )
}
