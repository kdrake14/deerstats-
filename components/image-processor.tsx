"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ImageUploader } from "@/components/image-uploader"
import { ImagePreview } from "@/components/image-preview"
import { Loader2, Download, CheckCircle, AlertCircle } from "lucide-react"
import { upload } from "@vercel/blob/client"

export type UploadedImage = {
  id: string
  file: File
  preview: string
  blobUrl?: string
  uploadStatus?: "pending" | "uploading" | "uploaded" | "error"
}

type ProcessingStatus = "idle" | "processing" | "success" | "error"

export function ImageProcessor() {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [status, setStatus] = useState<ProcessingStatus>("idle")
  const [csvUrl, setCsvUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  const handleUpload = (newImages: UploadedImage[]) => {
    const imagesWithStatus = newImages.map((img) => ({
      ...img,
      uploadStatus: "pending" as const,
    }))
    setImages((prev) => [...prev, ...imagesWithStatus])
  }

  const handleRemove = (id: string) => {
    setImages((prev) => prev.filter((image) => image.id !== id))
  }

  const uploadToBlob = async (image: UploadedImage): Promise<UploadedImage> => {
    try {
      setImages((prev) => prev.map((img) => (img.id === image.id ? { ...img, uploadStatus: "uploading" } : img)))

      const blob = await upload(image.file.name, image.file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        onUploadProgress: (progress) => {
          setUploadProgress((prev) => ({
            ...prev,
            [image.id]: progress.percentage,
          }))
        },
      })

      const updatedImage = {
        ...image,
        blobUrl: blob.url,
        uploadStatus: "uploaded" as const,
      }

      setImages((prev) => prev.map((img) => (img.id === image.id ? updatedImage : img)))

      return updatedImage
    } catch (error) {
      setImages((prev) => prev.map((img) => (img.id === image.id ? { ...img, uploadStatus: "error" } : img)))
      throw error
    }
  }

  const handleProcess = async () => {
    if (images.length === 0) return

    setStatus("processing")
    setError(null)

    try {
      // First, upload all images to Vercel Blob
      const uploadPromises = images.map((image) => {
        if (image.uploadStatus === "uploaded" && image.blobUrl) {
          return Promise.resolve(image)
        }
        return uploadToBlob(image)
      })

      const uploadedImages = await Promise.all(uploadPromises)
      const imageUrls = uploadedImages.map((img) => img.blobUrl!).filter(Boolean)

      // Call the new analyze-images API
      const response = await fetch("/api/analyze-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrls }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      // Create a blob URL from the CSV response
      const csvBlob = await response.blob()
      const csvUrl = URL.createObjectURL(csvBlob)

      setCsvUrl(csvUrl)
      setStatus("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze images")
      setStatus("error")
    }
  }

  const handleReset = () => {
    setImages([])
    setStatus("idle")
    setCsvUrl(null)
    setError(null)
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <ImageUploader onUpload={handleUpload} disabled={status === "processing"} />

          {images.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Selected Images ({images.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image) => (
                  <ImagePreview
                    key={image.id}
                    image={image}
                    onRemove={handleRemove}
                    disabled={status === "processing"}
                    uploadProgress={uploadProgress[image.id]}
                  />
                ))}
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="bg-red-50 p-4 rounded-md flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Processing failed</h4>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="bg-green-50 p-4 rounded-md">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-800">Analysis complete</h4>
                  <p className="text-green-700 text-sm">
                    Successfully analyzed {images.length} images and extracted weather data including timestamps, wind
                    direction, weather conditions, and temperature trends.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {status === "idle" && (
              <Button onClick={handleProcess} disabled={images.length === 0}>
                Process Images
              </Button>
            )}

            {status === "processing" && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </Button>
            )}

            {status === "success" && csvUrl && (
              <>
                <Button asChild variant="default">
                  <a href={csvUrl} download="processed-results.csv">
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </a>
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Process More Images
                </Button>
              </>
            )}

            {status === "error" && (
              <Button variant="outline" onClick={handleReset}>
                Try Again
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
