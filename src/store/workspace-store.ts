import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface WorkspaceBasic {
  id: string
  name: string
  slug: string
  icon: string | null
  role: string
}

interface WorkspaceStore {
  currentWorkspaceId: string | null
  workspaces: WorkspaceBasic[]
  setCurrentWorkspace: (id: string) => void
  setWorkspaces: (workspaces: WorkspaceBasic[]) => void
  addWorkspace: (workspace: WorkspaceBasic) => void
  updateWorkspace: (id: string, data: Partial<WorkspaceBasic>) => void
  removeWorkspace: (id: string) => void
  getCurrentWorkspace: () => WorkspaceBasic | null
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      currentWorkspaceId: null,
      workspaces: [],
      setCurrentWorkspace: (id) => set({ currentWorkspaceId: id }),
      setWorkspaces: (workspaces) => {
        const state = get()
        // If current workspace no longer exists, switch to first
        const stillExists = workspaces.some(
          (w) => w.id === state.currentWorkspaceId
        )
        set({
          workspaces,
          currentWorkspaceId:
            stillExists
              ? state.currentWorkspaceId
              : workspaces[0]?.id ?? null,
        })
      },
      addWorkspace: (workspace) =>
        set((state) => ({
          workspaces: [...state.workspaces, workspace],
          currentWorkspaceId: workspace.id,
        })),
      updateWorkspace: (id, data) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, ...data } : w
          ),
        })),
      removeWorkspace: (id) =>
        set((state) => {
          const remaining = state.workspaces.filter((w) => w.id !== id)
          return {
            workspaces: remaining,
            currentWorkspaceId:
              state.currentWorkspaceId === id
                ? remaining[0]?.id ?? null
                : state.currentWorkspaceId,
          }
        }),
      getCurrentWorkspace: () => {
        const state = get()
        return (
          state.workspaces.find((w) => w.id === state.currentWorkspaceId) ??
          null
        )
      },
    }),
    { name: 'friendspace-workspace' }
  )
)
