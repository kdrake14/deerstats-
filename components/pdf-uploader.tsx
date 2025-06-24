"use client"

import type React from "react"

import { useRef, useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Plus } from "lucide-react"
import type { UploadedPDF } from "./pdf-converter"

interface PDFUploaderProps {
  onUpload: (pdfs: UploadedPDF[]) => void
  disabled?: boolean
}

// Generate a unique ID
function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function PDFUploader({ onUpload, disabled = false }: PDFUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files))
    }
  }

  const processFiles = (files: File[]) => {
    const pdfFiles = files.filter((file) => file.type === "application/pdf")

    const uploadedPdfs = pdfFiles.map((file) => ({
      id: generateUniqueId(),
      file,
      name: file.name,
    }))

    if (uploadedPdfs.length > 0) {
      onUpload(uploadedPdfs)
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
      <h3 className="mt-2 text-sm font-medium text-gray-900">Drag and drop PDF files here</h3>
      <p className="mt-1 text-xs text-gray-500">PDF files up to 50MB</p>
      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <Button type="button" onClick={() => fileInputRef.current?.click()} variant="outline" disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          Select PDF Files
        </Button>
      </div>
    </div>
  )
}
