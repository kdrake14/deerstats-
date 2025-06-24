import { ImageProcessor } from "@/components/image-processor"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Weather Data Analysis Report Generator</h1>
      <p className="text-gray-600 mb-8">
        Upload multiple images with timestamps, analyze them with AI to extract date/time information, and generate a
        comprehensive weather analysis report as a professionally formatted PDF document.
      </p>
      <ImageProcessor />
    </main>
  )
}
