"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PDFUploader } from "@/components/pdf-uploader"
import { convertPDFOrientation } from "@/lib/pdf-actions"
import { Loader2, Download, CheckCircle, AlertCircle, FileText } from "lucide-react"

export type UploadedPDF = {
  id: string
  file: File
  name: string
}

type ConversionStatus = "idle" | "converting" | "success" | "error"

export function PDFConverter() {
  const [pdfs, setPdfs] = useState<UploadedPDF[]>([])
  const [status, setStatus] = useState<ConversionStatus>("idle")
  const [convertedPdfUrl, setConvertedPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = (newPdfs: UploadedPDF[]) => {
    setPdfs((prev) => [...prev, ...newPdfs])
  }

  const handleRemove = (id: string) => {
    setPdfs((prev) => prev.filter((pdf) => pdf.id !== id))
  }

  const handleConvert = async () => {
    if (pdfs.length === 0) return

    setStatus("converting")
    setError(null)

    try {
      // Convert the first PDF (you can modify this to handle multiple PDFs)
      const result = await convertPDFOrientation(pdfs[0].file)
      setConvertedPdfUrl(result.pdfUrl)
      setStatus("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert PDF")
      setStatus("error")
    }
  }

  const handleReset = () => {
    setPdfs([])
    setStatus("idle")
    setConvertedPdfUrl(null)
    setError(null)
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <PDFUploader onUpload={handleUpload} disabled={status === "converting"} />

          {pdfs.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Selected PDFs ({pdfs.length})</h3>
              <div className="space-y-2">
                {pdfs.map((pdf) => (
                  <div key={pdf.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-medium">{pdf.name}</span>
                      <span className="text-xs text-gray-500">{(pdf.file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(pdf.id)}
                      disabled={status === "converting"}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="bg-red-50 p-4 rounded-md flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Conversion failed</h4>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="bg-green-50 p-4 rounded-md">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-800">Conversion complete</h4>
                  <p className="text-green-700 text-sm">
                    Your PDF has been successfully converted from landscape to portrait orientation.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {status === "idle" && (
              <Button onClick={handleConvert} disabled={pdfs.length === 0}>
                Convert to Portrait
              </Button>
            )}

            {status === "converting" && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting...
              </Button>
            )}

            {status === "success" && convertedPdfUrl && (
              <>
                <Button asChild variant="default">
                  <a href={convertedPdfUrl} download="converted-portrait.pdf">
                    <Download className="mr-2 h-4 w-4" />
                    Download Portrait PDF
                  </a>
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Convert Another PDF
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
