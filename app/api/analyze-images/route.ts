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

// Generate weather analysis summary
function generateWeatherAnalysis(results: any[]) {
  const validResults = results.filter((r) => r.date !== "error" && r.date !== "not found")

  if (validResults.length === 0) {
    return "No valid weather data available for analysis."
  }

  // Temperature analysis
  const temperatures = validResults
    .filter((r) => r.temperature !== "N/A" && !isNaN(Number.parseInt(r.temperature)))
    .map((r) => Number.parseInt(r.temperature))

  const avgTemp =
    temperatures.length > 0 ? Math.round(temperatures.reduce((a, b) => a + b, 0) / temperatures.length) : 0
  const minTemp = temperatures.length > 0 ? Math.min(...temperatures) : 0
  const maxTemp = temperatures.length > 0 ? Math.max(...temperatures) : 0

  // Weather conditions analysis
  const weatherConditions = validResults.filter((r) => r.weather !== "N/A").map((r) => r.weather.toLowerCase())

  const conditionCounts = weatherConditions.reduce(
    (acc, condition) => {
      acc[condition] = (acc[condition] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const mostCommonCondition = Object.entries(conditionCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "unknown"

  // Wind direction analysis
  const windDirections = validResults.filter((r) => r.windDirection !== "N/A").map((r) => r.windDirection)

  const windCounts = windDirections.reduce(
    (acc, direction) => {
      acc[direction] = (acc[direction] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const predominantWind = Object.entries(windCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "variable"

  // Temperature trends
  const risingTrends = validResults.filter((r) => r.tempTrend === "Rising").length
  const fallingTrends = validResults.filter((r) => r.tempTrend === "Falling").length
  const stableTrends = validResults.filter((r) => r.tempTrend === "Stable").length

  // Time period analysis
  const timeRanges = validResults
    .filter((r) => r.time !== "not found")
    .map((r) => {
      const hour = Number.parseInt(r.time.split(":")[0])
      if (hour >= 6 && hour < 12) return "Morning"
      if (hour >= 12 && hour < 18) return "Afternoon"
      if (hour >= 18 && hour < 24) return "Evening"
      return "Night"
    })

  const timeCounts = timeRanges.reduce(
    (acc, period) => {
      acc[period] = (acc[period] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return {
    avgTemp,
    minTemp,
    maxTemp,
    mostCommonCondition,
    predominantWind,
    risingTrends,
    fallingTrends,
    stableTrends,
    timeCounts,
    validCount: validResults.length,
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
    const logoResponse = await fetch("https://www.deerstats.com/deer-stats-logo.png")
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

  // PAGE 1: SUMMARY PAGE WITH WEATHER ANALYSIS

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
  ]

  summaryLines.forEach((line) => {
    doc.text(line, margin, summaryY)
    summaryY += 6
  })

  // Weather and Time Analysis Section - Split into two columns
  summaryY += 10
  doc.setFontSize(16)
  doc.setTextColor(52, 73, 94)
  doc.text("Weather & Time Analysis", margin, summaryY)

  summaryY += 15
  const analysis = generateWeatherAnalysis(results)

  if (typeof analysis === "string") {
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    doc.text(analysis, margin, summaryY)
  } else {
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)

    // Left column content
    const leftColumnX = margin
    const rightColumnX = pageWidth / 2 + 10
    let leftY = summaryY
    let rightY = summaryY

    // Left Column - Temperature & Weather Analysis
    doc.setFont("helvetica", "bold")
    doc.text("Temperature Analysis:", leftColumnX, leftY)
    leftY += 8
    doc.setFont("helvetica", "normal")

    const leftColumnLines = [
      `• Average temperature: ${analysis.avgTemp}°F`,
      `• Temperature range: ${analysis.minTemp}°F to ${analysis.maxTemp}°F`,
      `• Rising trends: ${analysis.risingTrends} images`,
      `• Falling trends: ${analysis.fallingTrends} images`,
      `• Stable trends: ${analysis.stableTrends} images`,
      "",
      "Weather Conditions:",
      `• Most common condition: ${analysis.mostCommonCondition}`,
      `• Predominant wind direction: ${analysis.predominantWind}`,
    ]

    leftColumnLines.forEach((line) => {
      if (line === "") {
        leftY += 4
      } else if (line.endsWith(":")) {
        doc.setFont("helvetica", "bold")
        doc.text(line, leftColumnX, leftY)
        leftY += 8
        doc.setFont("helvetica", "normal")
      } else {
        doc.text(line, leftColumnX, leftY)
        leftY += 6
      }
    })

    // Right Column - Time Period & Data Quality
    doc.setFont("helvetica", "bold")
    doc.text("Time Period Distribution:", rightColumnX, rightY)
    rightY += 8
    doc.setFont("helvetica", "normal")

    // Add time period breakdown
    Object.entries(analysis.timeCounts).forEach(([period, count]) => {
      doc.text(`• ${period}: ${count} images`, rightColumnX, rightY)
      rightY += 6
    })

    rightY += 4
    doc.setFont("helvetica", "bold")
    doc.text("Data Quality Assessment:", rightColumnX, rightY)
    rightY += 8
    doc.setFont("helvetica", "normal")

    const rightColumnLines = [
      `• Successfully analyzed: ${analysis.validCount} images`,
      `• Weather pattern trend: ${analysis.risingTrends > analysis.fallingTrends ? "warming" : analysis.fallingTrends > analysis.risingTrends ? "cooling" : "stable"}`,
      `• Wind pattern: ${analysis.predominantWind} directional`,
    ]

    rightColumnLines.forEach((line) => {
      doc.text(line, rightColumnX, rightY)
      rightY += 6
    })
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

        // Analysis details below image (without "Analysis Results" header)
        let detailY = imgY + imgHeight + 20

        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)

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
