'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useWorkspaceStore } from '@/store/workspace-store'
import { UploadFileModal } from '@/components/files/upload-file-modal'
import { getInitials, formatBytes, formatRelativeTime } from '@/lib/utils'
import {
  Paperclip,
  Upload,
  Search,
  Download,
  Trash2,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  Loader2,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { ImagePreviewModal } from '@/components/chat/image-preview-modal'

interface FilesClientProps {
  currentUserId: string
  projectId?: string
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return <FileImage className="h-5 w-5 text-emerald-600" />
  }
  if (mimeType === 'application/pdf') {
    return <FileText className="h-5 w-5 text-rose-600" />
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
  }
  if (mimeType.includes('zip') || mimeType.includes('archive')) {
    return <FileArchive className="h-5 w-5 text-amber-600" />
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText className="h-5 w-5 text-blue-600" />
  }
  return <File className="h-5 w-5 text-slate-500" />
}

export function FilesClient({ currentUserId, projectId }: FilesClientProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // Lightbox preview for images
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)

  const fetchFiles = useCallback(async () => {
    if (!currentWorkspace?.id) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('workspaceId', currentWorkspace.id)
      if (projectId) params.set('projectId', projectId)

      const res = await fetch(`/api/files?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setFiles(data.files || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.id, projectId])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleDeleteFile = async (fileId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Delete failed')
      }
      toast.success('File deleted')
      fetchFiles()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false

    if (typeFilter === 'IMAGES') return f.mimeType.startsWith('image/')
    if (typeFilter === 'PDF') return f.mimeType === 'application/pdf'
    if (typeFilter === 'DOCS')
      return (
        f.mimeType.includes('word') ||
        f.mimeType.includes('document') ||
        f.mimeType.includes('text') ||
        f.mimeType.includes('presentation')
      )
    if (typeFilter === 'SHEETS')
      return (
        f.mimeType.includes('sheet') ||
        f.mimeType.includes('excel') ||
        f.mimeType.includes('csv')
      )
    if (typeFilter === 'ARCHIVES')
      return f.mimeType.includes('zip') || f.mimeType.includes('archive')

    return true
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Paperclip className="h-6 w-6 text-pink-600" />
            Files
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Store, preview, and download team documents and assets in{' '}
            <span className="font-semibold text-foreground">
              {currentWorkspace?.name || 'this workspace'}
            </span>
            .
          </p>
        </div>

        <Button
          onClick={() => setUploadModalOpen(true)}
          className="bg-pink-600 hover:bg-pink-700 text-white text-xs gap-1.5 shrink-0"
        >
          <Upload className="h-4 w-4" /> Upload File
        </Button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'IMAGES', 'PDF', 'DOCS', 'SHEETS', 'ARCHIVES'].map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTypeFilter(tf)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                typeFilter === tf
                  ? 'bg-pink-600 text-white'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf === 'ALL' ? 'All Files' : tf}
            </button>
          ))}
        </div>
      </div>

      {/* FILES TABLE */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading files...
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card">
          <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-pink-950/70 text-pink-600 flex items-center justify-center mx-auto mb-3 text-2xl">
            📎
          </div>
          <h3 className="text-sm font-semibold text-foreground">No files found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {search || typeFilter !== 'ALL'
              ? 'Try changing your search term or filter.'
              : 'Upload images, PDFs, documents, spreadsheets, or zip archives up to 10MB.'}
          </p>
          <Button
            size="sm"
            onClick={() => setUploadModalOpen(true)}
            className="bg-pink-600 hover:bg-pink-700 text-white text-xs gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" /> Upload File
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-4">Filename</th>
                  <th className="py-2.5 px-3">Project / Task</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Uploaded By</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFiles.map((file) => {
                  const isImage = file.mimeType.startsWith('image/')
                  const isOwner = file.uploaderId === currentUserId

                  return (
                    <tr
                      key={file.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Filename & Icon */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(file.mimeType)}
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                              {file.name}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {file.mimeType}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Project / Task */}
                      <td className="py-3 px-3">
                        {file.project ? (
                          <Badge variant="outline" className="text-[10px] gap-1 font-normal">
                            <span>{file.project.icon || '📁'}</span>
                            <span className="truncate max-w-[100px]">{file.project.name}</span>
                          </Badge>
                        ) : file.task ? (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            Task: {file.task.title.slice(0, 15)}...
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>

                      {/* Size */}
                      <td className="py-3 px-3 text-muted-foreground">
                        {formatBytes(file.size)}
                      </td>

                      {/* Uploader */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={file.uploader.image || ''} alt={file.uploader.name} />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(file.uploader.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{file.uploader.name.split(' ')[0]}</span>
                        </div>
                      </td>

                      {/* Uploaded Date */}
                      <td className="py-3 px-3 text-muted-foreground text-[11px]">
                        {formatRelativeTime(file.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Image preview button */}
                          {isImage && (
                            <button
                              type="button"
                              onClick={() => setPreviewImage({ url: file.url, name: file.name })}
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Preview image"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Secure download link */}
                          <a
                            href={`/api/files/${file.id}/download`}
                            download={file.name}
                            className="p-1.5 rounded text-muted-foreground hover:text-indigo-600 hover:bg-muted transition-colors"
                            title="Download file"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteFile(file.id, file.name)}
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UPLOAD FILE MODAL */}
      <UploadFileModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        projectId={projectId}
        onFileUploaded={() => {
          fetchFiles()
        }}
      />

      {/* IMAGE PREVIEW MODAL */}
      <ImagePreviewModal
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null)
        }}
        imageUrl={previewImage?.url || null}
        imageName={previewImage?.name}
      />
    </div>
  )
}
