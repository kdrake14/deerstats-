"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { UploadedImage } from "./image-processor"
import Image from "next/image"

interface ImagePreviewProps {
  image: UploadedImage
  onRemove: (id: string) => void
  disabled?: boolean
  uploadProgress?: number
}

export function ImagePreview({ image, onRemove, disabled = false, uploadProgress = 0 }: ImagePreviewProps) {
  const getStatusColor = () => {
    switch (image.uploadStatus) {
      case "uploaded":
        return "bg-green-500"
      case "uploading":
        return "bg-blue-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusText = () => {
    switch (image.uploadStatus) {
      case "uploaded":
        return "Uploaded"
      case "uploading":
        return `${Math.round(uploadProgress)}%`
      case "error":
        return "Error"
      default:
        return "Pending"
    }
  }

  return (
    <div className="relative group rounded-md overflow-hidden border border-gray-200">
      <div className="aspect-square relative">
        <Image src={image.preview || "/placeholder.svg"} alt={image.file.name} fill className="object-cover" />

        {/* Upload progress overlay */}
        {image.uploadStatus === "uploading" && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-sm font-medium">{Math.round(uploadProgress)}%</div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Button
          variant="destructive"
          size="icon"
          className="h-8 w-8"
          onClick={() => onRemove(image.id)}
          disabled={disabled || image.uploadStatus === "uploading"}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove</span>
        </Button>
      </div>

      <div className="p-2 bg-white">
        <div className="truncate text-xs text-gray-500">{image.file.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span className="text-xs text-gray-600">{getStatusText()}</span>
        </div>
      </div>
    </div>
  )
}
