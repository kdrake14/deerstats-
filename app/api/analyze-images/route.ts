import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import jsPDF from "jspdf"

const analysisSchema = z.object({
  timestamp: z.string().describe("Date and time when the photo was taken (if visible)"),
  windDirection: z.string().describe("Wind direction based on visual cues like flags, smoke, trees, etc."),
  weatherCondition: z.string().describe("Current weather condition (sunny, cloudy, rainy, snowy, etc.)"),
  temperature: z.string().describe("Estimated temperature range based on clothing, vegetation, frost, etc."),
  visibility: z.string().describe("Visibility conditions (clear, hazy, foggy, etc.)"),
  precipitation: z.string().describe("Any signs of precipitation (rain, snow, etc.)"),
  cloudCover: z.string().describe("Cloud coverage (clear, partly cloudy, overcast, etc.)"),
  additionalNotes: z.string().describe("Any other relevant weather observations"),
})

// Helper function to run tasks in batches
async function runInBatches<T>(
  items: string[],
  batchSize: number,
  handler: (item: string, index: number) => Promise<T>,
): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map((item, idx) => handler(item, i + idx)))
    results.push(...batchResults)
  }
  return results
}

// Helper function to fetch weather data from OpenWeatherMap
async function fetchWeatherData(timestamp: number, lat: number, lon: number, apiKey: string) {
  const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${timestamp}&appid=${apiKey}`
  try {
    const response = await fetch(url)
    const data = await response.json()
    console.log(`Weather API response for timestamp ${timestamp}:`, JSON.stringify(data, null, 2))
    return data
  } catch (error) {
    console.error(`Error fetching weather data for timestamp ${timestamp}:`, error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrls } = await request.json()

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "No image URLs provided" }, { status: 400 })
    }

    console.log(`Processing ${imageUrls.length} images...`)

    // Process images in batches to avoid rate limits
    const batchSize = 3
    const results = []

    for (let i = 0; i < imageUrls.length; i += batchSize) {
      const batch = imageUrls.slice(i, i + batchSize)
      const batchPromises = batch.map(async (imageUrl: string, index: number) => {
        try {
          console.log(`Analyzing image ${i + index + 1}: ${imageUrl}`)

          const result = await generateObject({
            model: openai("gpt-4o"),
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this image for weather-related information. Extract the timestamp if visible, determine wind direction from visual cues (flags, smoke, tree movement), assess weather conditions, estimate temperature based on context clues, and note visibility and precipitation. Provide detailed observations.",
                  },
                  {
                    type: "image",
                    image: imageUrl,
                  },
                ],
              },
            ],
            schema: analysisSchema,
          })

          return {
            imageUrl,
            imageNumber: i + index + 1,
            ...result.object,
          }
        } catch (error) {
          console.error(`Error analyzing image ${i + index + 1}:`, error)
          return {
            imageUrl,
            imageNumber: i + index + 1,
            timestamp: "Unable to determine",
            windDirection: "Unable to determine",
            weatherCondition: "Unable to determine",
            temperature: "Unable to determine",
            visibility: "Unable to determine",
            precipitation: "Unable to determine",
            cloudCover: "Unable to determine",
            additionalNotes: "Error occurred during analysis",
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Add delay between batches to respect rate limits
      if (i + batchSize < imageUrls.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log(`Analysis complete. Generating PDF report...`)

    // Create PDF with logo
    const pdf = new jsPDF()

    // Add logo to PDF header
    try {
      // Load the logo image
      const logoResponse = await fetch(new URL("/deer-stats-logo.png", request.url))
      if (logoResponse.ok) {
        const logoBuffer = await logoResponse.arrayBuffer()
        const logoBase64 = Buffer.from(logoBuffer).toString("base64")

        // Add logo to PDF (top-left corner)
        pdf.addImage(`data:image/png;base64,${logoBase64}`, "PNG", 15, 15, 30, 15)
      }
    } catch (error) {
      console.warn("Could not add logo to PDF:", error)
    }

    // Add title with logo space
    pdf.setFontSize(20)
    pdf.setFont("helvetica", "bold")
    pdf.text("Weather Analysis Report", 50, 25)

    // Add subtitle
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "normal")
    pdf.text("Powered by Deer Stats", 50, 32)

    // Add generation date
    pdf.setFontSize(10)
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 15, 45)

    // Add summary
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.text("Analysis Summary", 15, 60)

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Total Images Analyzed: ${results.length}`, 15, 70)
    pdf.text(`Report Generated: ${new Date().toLocaleDateString()}`, 15, 77)

    let yPosition = 90

    // Add detailed results for each image
    results.forEach((result, index) => {
      // Check if we need a new page
      if (yPosition > 250) {
        pdf.addPage()
        yPosition = 20
      }

      // Image header
      pdf.setFontSize(12)
      pdf.setFont("helvetica", "bold")
      pdf.text(`Image ${result.imageNumber}`, 15, yPosition)
      yPosition += 10

      // Analysis details
      pdf.setFontSize(9)
      pdf.setFont("helvetica", "normal")

      const details = [
        `Timestamp: ${result.timestamp}`,
        `Weather Condition: ${result.weatherCondition}`,
        `Temperature: ${result.temperature}`,
        `Wind Direction: ${result.windDirection}`,
        `Cloud Cover: ${result.cloudCover}`,
        `Visibility: ${result.visibility}`,
        `Precipitation: ${result.precipitation}`,
        `Additional Notes: ${result.additionalNotes}`,
      ]

      details.forEach((detail) => {
        // Handle long text by splitting it
        const lines = pdf.splitTextToSize(detail, 180)
        lines.forEach((line: string) => {
          pdf.text(line, 20, yPosition)
          yPosition += 5
        })
      })

      yPosition += 5 // Extra space between images
    })

    // Add footer with branding
    const pageCount = pdf.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "italic")
      pdf.text("Generated by Deer Stats Weather Analysis System", 15, 285)
      pdf.text(`Page ${i} of ${pageCount}`, 180, 285)
    }

    // Generate PDF buffer
    const pdfBuffer = pdf.output("arraybuffer")

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="weather_analysis_report.pdf"',
      },
    })
  } catch (error) {
    console.error("Error in analyze-images API:", error)
    return NextResponse.json(
      { error: "Failed to analyze images", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
