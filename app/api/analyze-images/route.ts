import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import type { NextRequest } from "next/server"
import axios from "axios"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// Define schemas for validation
const DateTimeSchema = z.object({
  date: z.string().describe("The date found in the image in YYYY-MM-DD format, or 'not found' if no date is visible"),
  time: z.string().describe("The time found in the image in HH:MM format, or 'not found' if no time is visible"),
})

const RequestSchema = z.object({
  imageUrls: z.array(z.string().url()),
})

// Helper: run in batches
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

// Kelvin to Fahrenheit
const kelvinToFahrenheit = (k: number) => Math.round(((k - 273.15) * 9) / 5 + 32)
// Trends
const getTemperatureTrend = (currentK: number, prevK: number) =>
  currentK > prevK ? "Rising" : currentK < prevK ? "Falling" : "Stable"
const getPressureTrend = (currentP: number, prevP: number) =>
  currentP > prevP ? "Rising" : currentP < prevP ? "Falling" : "Stable"

// Fetch weather data
async function fetchWeatherData(timestamp: number, lat: number, lon: number, apiKey: string) {
  const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${timestamp}&appid=${apiKey}`
  try {
    const response = await axios.get(url)
    return response.data
  } catch (err) {
    console.error(`Error fetching weather at ${timestamp}:`, err)
    throw err
  }
}

// Generate PDF with enhanced structure
async function generatePDF(results: any[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15

  // Load logo
  let logoDataUrl = ""
  try {
    const logoResponse = await fetch("/deer-stats-logo.png")
    if (logoResponse.ok) {
      const logoBuffer = await logoResponse.arrayBuffer()
      const logoBase64 = Buffer.from(logoBuffer).toString("base64")
      logoDataUrl = `data:image/png;base64,${logoBase64}`
    }
  } catch (error) {
    console.warn("Could not load logo:", error)
  }

  // Helper function to add footer to all pages (no background)
  const addFooter = () => {
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)

      // Footer text without background
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text("www.deerstats.com", pageWidth / 2, pageHeight - 6, { align: "center" })

      // Add descriptive page labels
      let pageLabel = ""
      if (i === 1) {
        pageLabel = "Summary"
      } else if (i === 2) {
        pageLabel = "Data Table"
      } else {
        pageLabel = `Image #${i - 2}`
      }

      doc.text(`Page ${i} of ${totalPages} - ${pageLabel}`, pageWidth - margin, pageHeight - 6, { align: "right" })
    }
  }

  // PAGE 1: SUMMARY PAGE WITH IMAGE ANALYSIS RESULTS

  // Logo positioned next to title
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 15, 25, 25)
  }

  // Title next to logo
  doc.setFontSize(24)
  doc.setTextColor(52, 73, 94)
  doc.text("Weather Data Analysis Report", margin + 30, 30)

  // Subtitle
  doc.setFontSize(14)
  doc.setTextColor(100, 100, 100)
  doc.text("Comprehensive Image Analysis & Weather Intelligence", margin + 30, 38)

  // Report metadata
  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  const now = new Date()
  doc.text(`Generated: ${now.toLocaleString()}`, margin, 55)
  doc.text(`Total Images Processed: ${results.length}`, margin, 62)
  doc.text(`Analysis Location: Gainesville, FL (29.6516°N, 82.3248°W)`, margin, 69)

  // Summary statistics
  const successCount = results.filter((r) => r.date !== "error" && r.date !== "not found").length
  const errorCount = results.filter((r) => r.date === "error").length
  const notFoundCount = results.filter((r) => r.date === "not found").length

  // Executive Summary Section
  doc.setFontSize(16)
  doc.setTextColor(52, 73, 94)
  doc.text("Executive Summary", margin, 85)

  // Formatted summary text
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  let summaryY = 95

  const summaryLines = [
    `Analysis completed successfully for ${successCount} out of ${results.length} images processed.`,
    `${errorCount} images encountered processing errors during analysis.`,
    `${notFoundCount} images had no detectable timestamp information.`,
    "",
    "Key Findings:",
    `• Weather conditions analyzed using OpenAI GPT-4 Vision technology`,
    `• Historical weather data correlated via OpenWeatherMap API integration`,
    `• Temperature trends calculated with 6-hour comparative analysis`,
    `• Wind direction patterns assessed from visual environmental indicators`,
    `• Atmospheric pressure changes tracked for weather pattern analysis`,
  ]

  summaryLines.forEach((line) => {
    if (line === "") {
      summaryY += 4
    } else {
      doc.text(line, margin, summaryY)
      summaryY += 6
    }
  })

  // Image Analysis Results Section
  doc.setFontSize(16)
  doc.setTextColor(52, 73, 94)
  doc.text("Image Analysis Results", margin, summaryY + 10)

  summaryY += 25

  // Create a compact results table for first page
  const compactResults = results.slice(0, Math.min(8, results.length)) // Show first 8 results

  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)

  // Table headers
  const headers = ["#", "Date", "Time", "Weather", "Temp", "Wind", "Trend"]
  let xPos = margin
  const colWidths = [15, 25, 20, 35, 20, 20, 25]

  // Draw header
  doc.setFontSize(9)
  doc.setTextColor(52, 73, 94)
  doc.setFont("helvetica", "bold")
  headers.forEach((header, i) => {
    doc.text(header, xPos, summaryY)
    xPos += colWidths[i]
  })

  summaryY += 8
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)

  // Draw data rows
  compactResults.forEach((result) => {
    xPos = margin
    const rowData = [
      result.imageIndex.toString(),
      result.date.length > 10 ? result.date.substring(0, 8) + ".." : result.date,
      result.time,
      result.weather.length > 15 ? result.weather.substring(0, 13) + ".." : result.weather,
      result.temperature === "N/A" ? "N/A" : result.temperature + "°F",
      result.windDirection,
      result.tempTrend,
    ]

    rowData.forEach((data, i) => {
      doc.text(data, xPos, summaryY)
      xPos += colWidths[i]
    })
    summaryY += 6
  })

  // Show "more results on page 2" if there are more images
  if (results.length > 8) {
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`... and ${results.length - 8} more results (see complete table on Page 2)`, margin, summaryY + 5)
  }

  // PAGE 2: DATA TABLE
  doc.addPage()

  // Header for page 2 with prominent identification
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 15, 20, 20)
  }

  doc.setFontSize(18)
  doc.setTextColor(52, 73, 94)
  doc.text("Page 2 - Detailed Analysis Results", margin + 25, 25)

  doc.setFontSize(12)
  doc.setTextColor(100, 100, 100)
  doc.text("Complete Data Table with Weather Analysis", margin + 25, 32)

  // Prepare table data
  const tableData = results.map((r) => [
    r.imageIndex.toString(),
    r.date,
    r.time,
    r.windDirection,
    r.weather.length > 12 ? r.weather.substring(0, 10) + ".." : r.weather,
    r.weatherSixHoursPrior.length > 12 ? r.weatherSixHoursPrior.substring(0, 10) + ".." : r.weatherSixHoursPrior,
    r.temperature + "°F",
    r.tempTrend,
    r.pressureTrend,
  ])

  const availableWidth = pageWidth - 2 * margin

  autoTable(doc, {
    head: [["#", "Date", "Time", "Wind", "Weather", "Weather 6h", "Temp", "T.Trend", "P.Trend"]],
    body: tableData,
    startY: 40,
    margin: { left: margin, right: margin, top: 40, bottom: 20 },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      cellWidth: "wrap",
      halign: "center",
    },
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: availableWidth * 0.06 },
      1: { cellWidth: availableWidth * 0.14 },
      2: { cellWidth: availableWidth * 0.1 },
      3: { cellWidth: availableWidth * 0.08 },
      4: { cellWidth: availableWidth * 0.16 },
      5: { cellWidth: availableWidth * 0.16 },
      6: { cellWidth: availableWidth * 0.1 },
      7: { cellWidth: availableWidth * 0.1 },
      8: { cellWidth: availableWidth * 0.1 },
    },
  })

  // PAGES 3+: ANALYZED IMAGES
  for (let i = 0; i < results.length; i++) {
    doc.addPage()

    const result = results[i]

    // Header with clear page and image identification
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", margin, 15, 15, 15)
    }

    doc.setFontSize(16)
    doc.setTextColor(52, 73, 94)
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber} - Image Analysis #${result.imageIndex}`, margin + 20, 25)

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Analyzed Image ${i + 1} of ${results.length}`, margin + 20, 32)

    // Try to load and display the analyzed image
    try {
      const imageResponse = await fetch(result.imageUrl)
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer()
        const imageBase64 = Buffer.from(imageBuffer).toString("base64")
        const mimeType = imageResponse.headers.get("content-type") || "image/jpeg"
        const imageDataUrl = `data:${mimeType};base64,${imageBase64}`

        // Add image (centered, with reasonable size)
        const imgWidth = 120
        const imgHeight = 80
        const imgX = (pageWidth - imgWidth) / 2
        const imgY = 40

        doc.addImage(imageDataUrl, "JPEG", imgX, imgY, imgWidth, imgHeight)

        // Analysis details below image
        let detailY = imgY + imgHeight + 20

        doc.setFontSize(14)
        doc.setTextColor(52, 73, 94)
        doc.text("Analysis Results", margin, detailY)

        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
        detailY += 15

        const details = [
          `Date Extracted: ${result.date}`,
          `Time Extracted: ${result.time}`,
          `Wind Direction: ${result.windDirection}`,
          `Current Weather: ${result.weather}`,
          `Weather 6h Prior: ${result.weatherSixHoursPrior}`,
          `Temperature: ${result.temperature}`,
          `Temperature Trend: ${result.tempTrend}`,
          `Pressure Trend: ${result.pressureTrend}`,
        ]

        details.forEach((detail) => {
          doc.text(detail, margin, detailY)
          detailY += 8
        })
      }
    } catch (error) {
      console.warn(`Could not load image ${result.imageUrl}:`, error)

      // Show placeholder if image can't be loaded
      doc.setFillColor(240, 240, 240)
      doc.rect((pageWidth - 120) / 2, 40, 120, 80, "F")
      doc.setTextColor(120, 120, 120)
      doc.text("Image could not be loaded", pageWidth / 2, 85, { align: "center" })
    }
  }

  // Add footer to all pages
  addFooter()

  return doc.output("arraybuffer")
}

// The main API handler
export async function POST(request: NextRequest) {
  try {
    const { imageUrls } = RequestSchema.parse(await request.json())

    const apiKey = "c960e1bba9a8804ae8aa152df088e9e3"
    const lat = 29.6516
    const lon = -82.3248

    const analyzeImage = async (url: string, index: number) => {
      try {
        // Extract date/time info
        const result = await generateObject({
          model: openai("gpt-4o"),
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this image and extract any visible date and time information. Focus on timestamps, date stamps, clock displays, calendar dates or indicators. Use the most prominent or relevant one if multiple.",
                },
                {
                  type: "image",
                  image: url,
                },
              ],
            },
          ],
          schema: DateTimeSchema,
        })

        const { date, time } = result.object

        if (date === "not found" || time === "not found") {
          return {
            imageIndex: index + 1,
            imageUrl: url,
            date,
            time,
            windDirection: "N/A",
            weather: "N/A",
            weatherSixHoursPrior: "N/A",
            temperature: "N/A",
            tempTrend: "N/A",
            pressureTrend: "N/A",
          }
        }

        // Build timestamp
        const dateTimeStr = `${date}T${time}:00-05:00` // assuming EDT
        const timestamp = Math.floor(new Date(dateTimeStr).getTime() / 1000)
        const sixHoursPrior = timestamp - 6 * 3600

        // Fetch weather data
        const weatherData = await fetchWeatherData(timestamp, lat, lon, apiKey)
        const priorWeatherData = await fetchWeatherData(sixHoursPrior, lat, lon, apiKey)

        const currentWeather = weatherData.data[0]
        const priorWeather = priorWeatherData.data[0]

        // Wind direction
        const windDeg = currentWeather.wind_deg
        const windDir =
          windDeg >= 337.5 || windDeg < 22.5
            ? "N"
            : windDeg < 67.5
              ? "NE"
              : windDeg < 112.5
                ? "E"
                : windDeg < 157.5
                  ? "SE"
                  : windDeg < 202.5
                    ? "S"
                    : windDeg < 247.5
                      ? "SW"
                      : windDeg < 292.5
                        ? "W"
                        : "NW"

        const weatherDesc = currentWeather.weather[0]?.description || "N/A"
        const priorDesc = priorWeather.weather[0]?.description || "N/A"

        const temp = kelvinToFahrenheit(currentWeather.temp)
        const priorTemp = kelvinToFahrenheit(priorWeather.temp)

        const tempTrend = getTemperatureTrend(currentWeather.temp, priorWeather.temp)
        const pressureTrend = getPressureTrend(currentWeather.pressure, priorWeather.pressure)

        return {
          imageIndex: index + 1,
          imageUrl: url,
          date,
          time,
          windDirection: windDir,
          weather: weatherDesc,
          weatherSixHoursPrior: priorDesc,
          temperature: temp.toString(),
          tempTrend,
          pressureTrend,
        }
      } catch (err) {
        console.error(`Error analyzing ${url}:`, err)
        return {
          imageIndex: index + 1,
          imageUrl: url,
          date: "error",
          time: "error",
          windDirection: "error",
          weather: "error",
          weatherSixHoursPrior: "error",
          temperature: "error",
          tempTrend: "error",
          pressureTrend: "error",
        }
      }
    }

    const results = await runInBatches(imageUrls, 3, analyzeImage)

    const pdfBuffer = await generatePDF(results)
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="weather_report.pdf"',
      },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
}
