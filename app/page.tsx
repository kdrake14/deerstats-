import { ImageProcessor } from "@/components/image-processor"
import Image from "next/image"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header with Logo */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-4">
            <Image src="/deer-stats-logo.png" alt="Deer Stats Logo" width={80} height={80} className="object-contain" />
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900">Deer Stats</h1>
              <p className="text-lg text-gray-600">Weather Analysis Platform</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-10 px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4 text-gray-800">Weather Data Analysis Report Generator</h2>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Upload multiple images with timestamps, analyze them with AI to extract date/time information, and generate
            a comprehensive weather analysis report as a professionally formatted PDF document.
          </p>
        </div>
        <ImageProcessor />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center gap-3">
            <Image src="/deer-stats-logo.png" alt="Deer Stats" width={40} height={40} className="object-contain" />
            <div className="text-center">
              <p className="text-gray-600">© 2024 Deer Stats. All rights reserved.</p>
              <p className="text-sm text-gray-500">Advanced weather analysis powered by AI</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
