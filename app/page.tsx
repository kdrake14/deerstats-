import { ImageProcessor } from "@/components/image-processor"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      {/* Container with flex layout for logo and heading */}
      <div className="flex items-center mb-6">
        {/* Logo Image */}
        <img
          src="/deer-stats-logo.png"
          alt="Deer Stats Logo"
          className="w-16 h-auto mr-4"
        />

        {/* Heading Text */}
        <h1 className="text-3xl font-bold">Weather Data Analysis Report Generator</h1>
      </div>

      <p className="text-gray-600 mb-8">
        Upload multiple images with timestamps, analyze them with AI to extract date/time information, and generate a
        comprehensive weather analysis report as a professionally formatted PDF document.
      </p>
      <ImageProcessor />
    </main>
  )
}
