'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useWorkspaceStore } from '@/store/workspace-store'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'
import {
  User,
  Shield,
  Bell,
  Palette,
  Sliders,
  Building2,
  AlertTriangle,
  Sun,
  Moon,
  Monitor,
  Loader2,
  Save,
  Trash2,
  ExternalLink,
} from 'lucide-react'

interface SettingsClientProps {
  initialUser: {
    id: string
    name: string
    email: string
    username: string
    bio: string | null
    image: string | null
    timezone: string
  }
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
]

export function SettingsClient({ initialUser }: SettingsClientProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces)
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace)

  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'notifications' | 'appearance' | 'preferences' | 'workspace'
  >('profile')

  // Profile state
  const [name, setName] = useState(initialUser.name)
  const [username, setUsername] = useState(initialUser.username)
  const [bio, setBio] = useState(initialUser.bio || '')
  const [image, setImage] = useState(initialUser.image || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Security state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Notification preferences state
  const [prefs, setPrefs] = useState({
    messages: true,
    mentions: true,
    taskAssignments: true,
    taskDue: true,
    events: true,
    fileShared: true,
    documentUpdated: true,
  })
  const [loadingPrefs, setLoadingPrefs] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Preferences state
  const [timezone, setTimezone] = useState(initialUser.timezone || 'UTC')
  const [savingPreferences, setSavingPreferences] = useState(false)

  // Workspace settings state
  const [wsName, setWsName] = useState('')
  const [wsDesc, setWsDesc] = useState('')
  const [wsIcon, setWsIcon] = useState('')
  const [savingWs, setSavingWs] = useState(false)

  // Delete workspace dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmWsName, setConfirmWsName] = useState('')
  const [deletingWs, setDeletingWs] = useState(false)

  // Determine current workspace role
  const isOwner = currentWorkspace?.role === 'OWNER'
  const isAdmin = currentWorkspace?.role === 'ADMIN' || isOwner

  useEffect(() => {
    if (currentWorkspace) {
      setWsName(currentWorkspace.name || '')
      setWsIcon(currentWorkspace.icon || '💼')
    }
  }, [currentWorkspace])

  // Fetch notification preferences
  useEffect(() => {
    if (activeTab === 'notifications') {
      setLoadingPrefs(true)
      fetch('/api/settings/notifications')
        .then((res) => res.json())
        .then((data) => {
          if (data.preferences) {
            setPrefs({
              messages: data.preferences.messages ?? true,
              mentions: data.preferences.mentions ?? true,
              taskAssignments: data.preferences.taskAssignments ?? true,
              taskDue: data.preferences.taskDue ?? true,
              events: data.preferences.events ?? true,
              fileShared: data.preferences.fileShared ?? true,
              documentUpdated: data.preferences.documentUpdated ?? true,
            })
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPrefs(false))
    }
  }, [activeTab])

  // Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, bio, image: image || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update profile')
      toast.success('Profile updated successfully')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingProfile(false)
    }
  }

  // Save Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/settings/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to change password')
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingPassword(false)
    }
  }

  // Save Notification Preferences
  const handleSavePrefs = async () => {
    setSavingPrefs(true)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save preferences')
      toast.success('Notification preferences updated')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingPrefs(false)
    }
  }

  // Save Timezone / General Preferences
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPreferences(true)
    try {
      const res = await fetch('/api/settings/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save preferences')
      toast.success('Preferences updated successfully')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingPreferences(false)
    }
  }

  // Save Workspace Settings
  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentWorkspace?.id) return
    setSavingWs(true)
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: wsName.trim(),
          description: wsDesc.trim() || null,
          icon: wsIcon.trim() || '💼',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update workspace')
      toast.success('Workspace updated successfully')

      // Update Zustand store
      const updated = workspaces.map((w) =>
        w.id === currentWorkspace.id
          ? { ...w, name: data.workspace.name, icon: data.workspace.icon }
          : w
      )
      setWorkspaces(updated)
      setCurrentWorkspace(currentWorkspace.id)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingWs(false)
    }
  }

  // Delete Workspace
  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace?.id || confirmWsName !== currentWorkspace.name) return
    setDeletingWs(true)
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete workspace')
      }
      toast.success('Workspace deleted')
      const remaining = workspaces.filter((w) => w.id !== currentWorkspace.id)
      setWorkspaces(remaining)
      if (remaining.length > 0) {
        setCurrentWorkspace(remaining[0].id)
      }
      setDeleteDialogOpen(false)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeletingWs(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'preferences', label: 'Preferences', icon: Sliders },
    ...(isAdmin ? [{ id: 'workspace', label: 'Workspace', icon: Building2 }] : []),
  ]

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your personal account, security, and workspace settings
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Navigation Sidebar */}
        <nav className="w-full md:w-56 shrink-0 flex md:flex-col gap-1 overflow-x-auto border-b md:border-b-0 md:border-r border-border pb-2 md:pb-0 md:pr-4">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left shrink-0 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Content Area */}
        <div className="flex-1 w-full space-y-6">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Profile Details</CardTitle>
                <CardDescription className="text-xs">
                  Your identity across FriendSpace workspaces
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={image} alt={name} />
                      <AvatarFallback className="text-base">{getInitials(name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-foreground">Avatar Image URL</label>
                      <Input
                        value={image}
                        onChange={(e) => setImage(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Display Name</label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Username</label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Bio</label>
                    <Textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="A short note about yourself..."
                      className="text-xs min-h-[80px]"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={savingProfile}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5"
                    >
                      {savingProfile ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Security & Password</CardTitle>
                <CardDescription className="text-xs">
                  Keep your account secure with a strong password
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                  <span className="text-muted-foreground">Account Email</span>
                  <p className="font-semibold text-foreground">{initialUser.email}</p>
                </div>

                <form onSubmit={handleSavePassword} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Current Password</label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">New Password</label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Confirm New Password</label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={savingPassword}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5"
                    >
                      {savingPassword ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Shield className="h-3.5 w-3.5" />
                      )}
                      Change Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Notification Preferences</CardTitle>
                <CardDescription className="text-xs">
                  Choose what events trigger in-app notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingPrefs ? (
                  <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading preferences...
                  </div>
                ) : (
                  <div className="space-y-3 divide-y divide-border/60">
                    {[
                      { key: 'taskAssignments', label: 'Task Assignments', desc: 'When you are assigned to a task' },
                      { key: 'taskDue', label: 'Task Deadlines', desc: 'When your assigned tasks are approaching due dates' },
                      { key: 'messages', label: 'Direct & Group Messages', desc: 'When you receive a new chat message' },
                      { key: 'mentions', label: 'Mentions', desc: 'When someone mentions you in a conversation' },
                      { key: 'events', label: 'Calendar Event Invites', desc: 'When you are invited to a calendar event' },
                      { key: 'documentUpdated', label: 'Document Shares & Updates', desc: 'When documents are shared with you' },
                      { key: 'fileShared', label: 'File Uploads', desc: 'When workspace files are shared' },
                    ].map((item) => (
                      <div key={item.key} className="pt-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-foreground">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={(prefs as any)[item.key]}
                          onChange={(e) =>
                            setPrefs({ ...prefs, [item.key]: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                    ))}

                    <div className="pt-4 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSavePrefs}
                        disabled={savingPrefs}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5"
                      >
                        {savingPrefs ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save Preferences
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Appearance & Theme</CardTitle>
                <CardDescription className="text-xs">
                  Customize the interface theme for your device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'light', label: 'Light', icon: Sun },
                    { key: 'dark', label: 'Dark', icon: Moon },
                    { key: 'system', label: 'System', icon: Monitor },
                  ].map((t) => {
                    const Icon = t.icon
                    const isSelected = theme === t.key
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTheme(t.key)}
                        className={`p-4 rounded-xl border text-center flex flex-col items-center gap-2 transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 shadow-sm'
                            : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-xs font-semibold">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === 'preferences' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Regional & Time Preferences</CardTitle>
                <CardDescription className="text-xs">
                  Adjust timezone and formatting for calendar and deadlines
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePreferences} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {COMMON_TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={savingPreferences}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5"
                    >
                      {savingPreferences ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save Preferences
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* WORKSPACE SETTINGS TAB (Admin/Owner only) */}
          {activeTab === 'workspace' && isAdmin && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Workspace Settings</CardTitle>
                  <CardDescription className="text-xs">
                    Configure details for &ldquo;{currentWorkspace?.name}&rdquo;
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveWorkspace} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-xs font-medium text-foreground">Icon</label>
                        <Input
                          value={wsIcon}
                          onChange={(e) => setWsIcon(e.target.value)}
                          maxLength={2}
                          className="text-xs h-8 text-center"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-3">
                        <label className="text-xs font-medium text-foreground">Workspace Name</label>
                        <Input
                          value={wsName}
                          onChange={(e) => setWsName(e.target.value)}
                          required
                          className="text-xs h-8"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Description</label>
                      <Textarea
                        value={wsDesc}
                        onChange={(e) => setWsDesc(e.target.value)}
                        placeholder="Purpose of this workspace..."
                        className="text-xs min-h-[60px]"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/members')}
                        className="text-xs h-8 gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Manage Members
                      </Button>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={savingWs}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5"
                      >
                        {savingWs ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save Workspace
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* DANGER ZONE (Owner only) */}
              {isOwner && (
                <Card className="border-rose-300 dark:border-rose-950 bg-rose-50/20 dark:bg-rose-950/10">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="h-4 w-4" />
                      <CardTitle className="text-sm font-semibold">Danger Zone</CardTitle>
                    </div>
                    <CardDescription className="text-xs text-rose-600/80 dark:text-rose-400/80">
                      Irreversible and destructive actions for this workspace
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-background">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Delete this workspace</p>
                        <p className="text-[11px] text-muted-foreground">
                          Permanently deletes all tasks, projects, documents, files, and chat messages.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-xs h-8 shrink-0 gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Workspace
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Workspace Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Delete Workspace
            </DialogTitle>
            <DialogDescription className="text-xs">
              This action cannot be undone. To confirm, type{' '}
              <strong className="text-foreground">{currentWorkspace?.name}</strong> below:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              value={confirmWsName}
              onChange={(e) => setConfirmWsName(e.target.value)}
              placeholder="Workspace name"
              className="text-xs h-8"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={confirmWsName !== currentWorkspace?.name || deletingWs}
              onClick={handleDeleteWorkspace}
              className="text-xs h-8 gap-1.5"
            >
              {deletingWs && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
