import { ImageProcessor } from "@/components/image-processor"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img src="/deer-stats-logo.png" alt="Deer Stats Logo" className="h-16 w-auto" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Weather Analysis System</h1>
              <p className="text-lg text-gray-600 mt-2">Powered by Deer Stats</p>
            </div>
          </div>
          <p className="text-gray-700 max-w-2xl mx-auto">
            Upload images to generate comprehensive weather analysis reports using AI vision technology. Extract
            timestamps, weather conditions, wind direction, temperature estimates, and more.
          </p>
        </div>

        {/* Main Component */}
        <ImageProcessor />

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-600">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src="/deer-stats-logo.png" alt="Deer Stats" className="h-6 w-auto" />
            <span className="text-sm">© 2024 Deer Stats. All rights reserved.</span>
          </div>
          <p className="text-xs">Advanced weather analysis powered by artificial intelligence</p>
        </footer>
      </div>
    </main>
  )
}
