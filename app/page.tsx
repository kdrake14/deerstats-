import { ImageProcessor } from "@/components/image-processor"
import Image from "next/image"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      {/* Header with Logo */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-4">
          <Image src="/deer-stats-logo.png" alt="Deer Stats Logo" width={80} height={80} className="object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deer Stats</h1>
            <p className="text-lg text-gray-600">Weather Data Analysis Report Generator</p>
          </div>
        </div>
      </div>

      <div className="text-center mb-8">
        <p className="text-gray-600 max-w-3xl mx-auto">
          Upload multiple images with timestamps, analyze them with AI to extract date/time information, and generate a
          comprehensive weather analysis report as a professionally formatted PDF document.
        </p>
      </div>

      <ImageProcessor />
    </main>
  )
}
