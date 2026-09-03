'use client'

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import Image from 'next/image'

interface ImagePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string | null
  imageName?: string
}

export function ImagePreviewModal({
  open,
  onOpenChange,
  imageUrl,
  imageName,
}: ImagePreviewModalProps) {
  if (!imageUrl) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-2 bg-black/95 border-border overflow-hidden">
        <DialogTitle className="sr-only">{imageName || 'Image preview'}</DialogTitle>
        <div className="relative w-full h-[75vh] flex items-center justify-center">
          <Image
            src={imageUrl}
            alt={imageName || 'Preview'}
            fill
            className="object-contain"
            sizes="(max-width: 1200px) 100vw, 1200px"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
