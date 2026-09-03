import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export interface UploadedFile {
  name: string
  url: string
  size: number
  mimeType: string
}

export interface StorageProvider {
  uploadFile(file: File | Blob, originalFilename: string): Promise<UploadedFile>
  getFileBuffer(fileUrl: string): Promise<Buffer | null>
  deleteFile(fileUrl: string): Promise<boolean>
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Local Disk Storage Provider
 * NOTE: For serverless production (e.g. Vercel), local ephemeral disk will not persist across cold starts.
 * Configure an S3-compatible provider, Cloudflare R2, or Supabase Storage for persistent cloud uploads.
 */
class LocalDiskStorageProvider implements StorageProvider {
  private uploadDir = path.join(process.cwd(), 'public', 'uploads')

  async uploadFile(file: File | Blob, originalFilename: string): Promise<UploadedFile> {
    const mimeType = file.type || 'application/octet-stream'
    const size = file.size

    if (size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds the 10MB limit')
    }

    // Sanitize filename and extract safe extension
    const baseClean = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_')
    const ext = path.extname(baseClean).toLowerCase() || '.bin'
    const safeFilename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`

    await fs.mkdir(this.uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const filePath = path.join(this.uploadDir, safeFilename)
    await fs.writeFile(filePath, buffer)

    return {
      name: originalFilename,
      url: `/uploads/${safeFilename}`,
      size,
      mimeType,
    }
  }

  async getFileBuffer(fileUrl: string): Promise<Buffer | null> {
    const filename = path.basename(fileUrl)
    const filePath = path.join(this.uploadDir, filename)

    try {
      return await fs.readFile(filePath)
    } catch {
      return null
    }
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    const filename = path.basename(fileUrl)
    const filePath = path.join(this.uploadDir, filename)

    try {
      await fs.unlink(filePath)
      return true
    } catch {
      return false
    }
  }
}

// Active storage provider (can be switched dynamically based on process.env.STORAGE_PROVIDER)
export const storage: StorageProvider = new LocalDiskStorageProvider()

// Backward-compatible helper used across existing modules
export async function saveLocalFile(
  file: File | Blob,
  originalFilename: string
): Promise<UploadedFile> {
  return storage.uploadFile(file, originalFilename)
}
