import { PDFDocument, degrees } from "pdf-lib"
import fs from "fs"

async function convertPDFOrientation() {
  try {
    // Example: Read a PDF file from the file system
    const existingPdfBytes = fs.readFileSync("input.pdf")

    // Load the PDF
    const pdfDoc = await PDFDocument.load(existingPdfBytes)

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

        // Alternative: Rotate 270 degrees clockwise for different orientation
        // page.setRotation(degrees(270));
      }
    }

    // Save the modified PDF
    const pdfBytes = await pdfDoc.save()
    fs.writeFileSync("output-portrait.pdf", pdfBytes)

    console.log("PDF conversion completed successfully!")
    console.log("Output saved as: output-portrait.pdf")
  } catch (error) {
    console.error("Error converting PDF:", error)
  }
}

// Run the conversion
convertPDFOrientation()
