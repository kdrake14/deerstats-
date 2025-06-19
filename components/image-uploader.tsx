"use client"

import type React from "react"

import { useRef, useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Plus } from "lucide-react"
import type { UploadedImage } from "./image-processor"

interface ImageUploaderProps {
  onUpload: (images: UploadedImage[]) => void
  disabled?: boolean
}

// Generate a unique ID
function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Generate unique filename with timestamp and random suffix
function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substr(2, 8)
  const extension = originalName.split(".").pop()
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "")

  return `${nameWithoutExt}-${timestamp}-${randomSuffix}.${extension}`
}

export function ImageUploader({ onUpload, disabled = false }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files))
    }
  }

  const processFiles = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"))

    const uploadedImages = imageFiles.map((file) => {
      // Create a new File object with unique name
      const uniqueFilename = generateUniqueFilename(file.name)
      const uniqueFile = new File([file], uniqueFilename, { type: file.type })

      return {
        id: generateUniqueId(),
        file: uniqueFile, // Use the file with unique name
        preview: URL.createObjectURL(file),
      }
    })

    if (uploadedImages.length > 0) {
      onUpload(uploadedImages)
    }

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files))
    }
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center ${
        isDragging ? "border-primary bg-primary/5" : "border-gray-300"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Upload className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">Drag and drop images here</h3>
      <p className="mt-1 text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <Button type="button" onClick={() => fileInputRef.current?.click()} variant="outline" disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          Select Images
        </Button>
      </div>
    </div>
  )
}
