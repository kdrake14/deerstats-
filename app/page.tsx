import { ImageProcessor } from "@/components/image-processor"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Image Processing Tool</h1>
      <p className="text-gray-600 mb-8">
        Upload multiple images, process them with our API, and download the results as a CSV file.
      </p>
      <ImageProcessor />
    </main>
  )
}
