"use server"

import { PDFDocument, degrees } from "pdf-lib"

export async function convertPDFOrientation(file: File) {
  try {
    console.log(`Converting PDF orientation for: ${file.name}`)

    // Read the PDF file
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)

    // Get all pages
    const pages = pdfDoc.getPages()
    console.log(`Processing ${pages.length} pages`)

    // Process each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const { width, height } = page.getSize()

      console.log(`Page ${i + 1}: ${width}x${height}`)

      // Check if page is landscape (width > height)
      if (width > height) {
        console.log(`Converting page ${i + 1} from landscape to portrait`)

        // Rotate the page 90 degrees counterclockwise
        page.setRotation(degrees(90))

        // Optionally, you can also resize the page to standard portrait dimensions
        // page.setSize(height, width)
      }
    }

    // Serialize the PDF
    const pdfBytes = await pdfDoc.save()

    // Create a blob URL for download
    const blob = new Blob([pdfBytes], { type: "application/pdf" })
    const pdfUrl = URL.createObjectURL(blob)

    console.log("PDF conversion completed successfully")

    return {
      pdfUrl,
      success: true,
      pageCount: pages.length,
    }
  } catch (error) {
    console.error("Error converting PDF:", error)
    throw new Error(`Failed to convert PDF: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
