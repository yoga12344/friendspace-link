'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useWorkspaceStore } from '@/store/workspace-store'
import { toast } from 'sonner'
import { Loader2, Upload, FileUp, X } from 'lucide-react'
import { formatBytes } from '@/lib/utils'

interface UploadFileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  taskId?: string
  onFileUploaded?: (file: any) => void
}

export function UploadFileModal({
  open,
  onOpenChange,
  projectId: defaultProjectId,
  taskId: defaultTaskId,
  onFileUploaded,
}: UploadFileModalProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || '')
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (defaultProjectId) setSelectedProjectId(defaultProjectId)
  }, [defaultProjectId])

  useEffect(() => {
    if (!open || !currentWorkspace?.id) return

    fetch(`/api/workspaces/${currentWorkspace.id}/projects`)
      .then((r) => r.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects)
      })
      .catch(() => {})
  }, [open, currentWorkspace?.id])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File exceeds maximum size of 10MB')
        return
      }
      setSelectedFile(file)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error('Please select a file to upload')
      return
    }

    if (!currentWorkspace?.id) {
      toast.error('No workspace selected')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('workspaceId', currentWorkspace.id)
      if (selectedProjectId) formData.append('projectId', selectedProjectId)
      if (defaultTaskId) formData.append('taskId', defaultTaskId)

      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      toast.success('File uploaded successfully!')
      setSelectedFile(null)
      onOpenChange(false)
      onFileUploaded?.(data.file)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleUpload}>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Upload documents, presentations, images, or archives (up to 10MB).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40"
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground truncate max-w-xs mx-auto">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatBytes(selectedFile.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFile(null)
                    }}
                    className="h-6 text-[10px] text-muted-foreground hover:text-destructive gap-1"
                  >
                    <X className="h-3 w-3" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Upload className="h-7 w-7 text-muted-foreground mx-auto" />
                  <p className="text-xs font-medium text-foreground">
                    Click to browse or drag and drop
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Images, PDF, DOCX, XLSX, PPTX, ZIP (max 10MB)
                  </p>
                </div>
              )}
            </div>

            {/* Project selector */}
            {!defaultTaskId && projects.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="file-project">Assign to Project (Optional)</Label>
                <select
                  id="file-project"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">General Workspace File</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.icon || '📁'} {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedFile}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload File
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
