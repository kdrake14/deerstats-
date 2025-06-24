import { PDFConverter } from "@/components/pdf-converter"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">PDF Orientation Converter</h1>
      <p className="text-gray-600 mb-8">Convert PDF pages from landscape to portrait orientation.</p>
      <PDFConverter />
    </main>
  )
}
