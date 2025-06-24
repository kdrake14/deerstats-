"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, Download, FileText, Upload } from "lucide-react"

export function ImageProcessor() {
  const [images, setImages] = useState<File[]>([])
  const [results, setResults] = useState<{
    processedCount: number
    csvUrl: string
  } | null>(null)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setImages(Array.from(event.target.files))
    }
  }

  const processImages = async () => {
    if (images.length === 0) {
      alert("Please upload images first.")
      return
    }

    // Simulate processing (replace with actual API call)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulate results
    setResults({
      processedCount: images.length,
      csvUrl:
        "data:text/csv;charset=utf-8," +
        encodeURIComponent("Date,Time,Filename\n2024-07-20,14:30:00,image1.jpg\n2024-07-20,14:31:00,image2.jpg"),
    })
  }

  return (
    <div className="container mx-auto p-4">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img src="/deer-stats-logo.png" alt="Deer Stats Logo" className="h-12 w-auto" />
          <h1 className="text-3xl font-bold">Deer Stats - Image Analysis</h1>
        </div>
        <p className="text-gray-600">Upload images to extract date and time information using AI vision</p>
      </div>

      <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6">
        <label htmlFor="image-upload" className="cursor-pointer text-blue-600 hover:text-blue-800">
          <div className="flex flex-col items-center">
            <Upload className="h-6 w-6 mb-2" />
            <span>Click to upload images</span>
          </div>
        </label>
        <input
          id="image-upload"
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        {images.length > 0 && <div className="mt-4">Selected {images.length} images</div>}
      </div>

      <Button onClick={processImages} disabled={images.length === 0} className="mt-4 w-full">
        Process Images
      </Button>

      {results && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Analysis Results</h2>
            <div className="flex items-center gap-2">
              <img src="/deer-stats-logo.png" alt="Deer Stats" className="h-6 w-auto" />
              <span className="text-sm text-gray-600">Powered by Deer Stats</span>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">Processing Complete</span>
            </div>
            <p className="text-green-700">Successfully processed {results.processedCount} images</p>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => {
                const link = document.createElement("a")
                link.href = results.csvUrl
                link.download = `deer-stats-analysis-${new Date().toISOString().split("T")[0]}.csv`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download CSV Report
            </Button>

            <Button
              variant="outline"
              onClick={() => window.open(results.csvUrl, "_blank")}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Preview Report
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
