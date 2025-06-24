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

// Helper to run tasks in batches
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

// Convert Kelvin to Fahrenheit
const kelvinToFahrenheit = (kelvin: number): number => {
  return Math.round(((kelvin - 273.15) * 9) / 5 + 32)
}

// Determine trend of temperature
const getTemperatureTrend = (currentKelvin: number, previousKelvin: number): string => {
  return currentKelvin > previousKelvin ? "Rising" : currentKelvin < previousKelvin ? "Falling" : "Stable"
}

// Determine trend of pressure
const getPressureTrend = (currentPressure: number, previousPressure: number): string => {
  return currentPressure > previousPressure ? "Rising" : currentPressure < previousPressure ? "Falling" : "Stable"
}

// Fetch weather data from OpenWeatherMap
async function fetchWeatherData(timestamp: number, lat: number, lon: number, apiKey: string) {
  const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${timestamp}&appid=${apiKey}`
  try {
    const response = await axios.get(url)
    console.log(`Weather API response for timestamp ${timestamp}:`, JSON.stringify(response.data, null, 2))
    return response.data
  } catch (error) {
    console.error(`Error fetching weather data for timestamp ${timestamp}:`, error)
    if (axios.isAxiosError(error)) {
      console.error("Response status:", error.response?.status)
      console.error("Response data:", error.response?.data)
    }
    throw error
  }
}

// Load image as base64
async function loadImageBase64(path: string): Promise<string> {
  const response = await fetch(path)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Generate PDF with embed logo and footer
async function generatePDF(results: any[]) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  })

  // Load logo image from public directory
  const logoPath = "/deer-stats-logo.png" // Adjust if needed
  const logoDataUrl = await loadImageBase64(logoPath)

  // Add logo at the top center
  const logoWidth = 40
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 10
  const headerY = 10
  doc.addImage(logoDataUrl, "PNG", (pageWidth - logoWidth) / 2, headerY, logoWidth, 15)

  // Add title
  doc.setFontSize(18)
  doc.text("Weather Data Analysis Report", margin, headerY + 25)

  // Add generation date and info
  doc.setFontSize(10)
  const now = new Date()
  doc.text(`Generated on: ${now.toLocaleString()}`, margin, headerY + 30)
  doc.text(`Total Images Analyzed: ${results.length}`, margin, headerY + 36)

  // Prepare table data
  const tableData = results.map((result) => [
    result.imageIndex.toString(),
    result.date,
    result.time,
    result.windDirection,
    result.weather.length > 12 ? result.weather.substring(0, 10) + ".." : result.weather,
    result.weatherSixHoursPrior.length > 12 ? result.weatherSixHoursPrior.substring(0, 10) + ".." : result.weatherSixHoursPrior,
    result.temperature + "°F",
    result.tempTrend,
    result.pressureTrend,
  ])

  const availableWidth = doc.internal.pageSize.getWidth() - 20

  autoTable(doc, {
    head: [["#", "Date", "Time", "Wind", "Weather", "Weather 6h", "Temp", "T.Trend", "P.Trend"]],
    body: tableData,
    startY: headerY + 45,
    margin: { left: margin, right: margin, top: headerY + 45, bottom: 20 },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      cellWidth: "wrap",
      halign: "center",
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
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
    didDrawPage: (data) => {
      // Add footer with website info
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        const footerText = "YourWebsite.com" // Replace with your actual website
        doc.setFontSize(8)
        doc.text(footerText, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
      }
    },
  })

  // Add summary at the end
  const finalY = (doc as any).lastAutoTable?.finalY || headerY + 45
  if (finalY < doc.internal.pageSize.getHeight() - 60) {
    doc.setFontSize(12)
    doc.text("Summary", margin, finalY + 15)

    doc.setFontSize(9)
    const successCount = results.filter((r) => r.date !== "error" && r.date !== "not found").length
    const errorCount = results.filter((r) => r.date === "error").length
    const notFoundCount = results.filter((r) => r.date === "not found").length

    doc.text(`Successfully processed: ${successCount} images`, margin, finalY + 25)
    doc.text(`Errors encountered: ${errorCount} images`, margin, finalY + 32)
    doc.text(`No timestamp found: ${notFoundCount} images`, margin, finalY + 39)

    // Notes
    doc.setFontSize(7)
    doc.text("Note: Weather descriptions may be abbreviated to fit the table format.", margin, finalY + 50)
    doc.text("Temperature values are displayed in Fahrenheit (°F).", margin, finalY + 55)
  }

  // Output PDF as ArrayBuffer
  return doc.output("arraybuffer")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageUrls } = RequestSchema.parse(body)

    console.log(`Analyzing ${imageUrls.length} images with OpenAI Vision...`)

    const apiKey = "c960e1bba9a8804ae8aa152df088e9e3"
    const lat = 29.6516 // Gainesville, FL latitude
    const lon = -82.3248 // Gainesville, FL longitude

    const analyzeImage = async (url: string, index: number) => {
      try {
        console.log(`Analyzing image: ${url}`)

        // Extract date and time from image
        const result = await generateObject({
          model: openai("gpt-4o"),
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this image and extract any visible date and time information. Look for timestamps, date stamps, clock displays, calendar dates, or any other date/time indicators in the image. If you find multiple dates or times, use the most prominent or relevant one.",
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

        console.log(`Successfully analyzed image: ${url}`, result.object)

        const { date, time } = result.object

        if (date === "not found" || time === "not found") {
          return {
            imageIndex: index + 1,
            imageUrl: url,
            date: date,
            time: time,
            windDirection: "N/A",
            weather: "N/A",
            weatherSixHoursPrior: "N/A",
            temperature: "N/A",
            tempTrend: "N/A",
            pressureTrend: "N/A",
          }
        }

        // Create timestamp
        const dateTimeString = `${date}T${time}:00-05:00` // assuming EDT
        const timestamp = Math.floor(new Date(dateTimeString).getTime() / 1000)
        const sixHoursPriorTimestamp = timestamp - 6 * 60 * 60

        // Fetch weather data
        const weatherData = await fetchWeatherData(timestamp, lat, lon, apiKey)
        const priorWeatherData = await fetchWeatherData(sixHoursPriorTimestamp, lat, lon, apiKey)

        const currentWeather = weatherData.data[0]
        const priorWeather = priorWeatherData.data[0]

        // Wind direction
        const windDeg = currentWeather.wind_deg
        const windDirection =
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

        // Weather description
        const weatherDescription = currentWeather.weather[0]?.description || "N/A"
        const priorWeatherDescription = priorWeather.weather[0]?.description || "N/A"

        // Temperature
        const temperature = kelvinToFahrenheit(currentWeather.temp)
        const priorTemperature = kelvinToFahrenheit(priorWeather.temp)

        // Trends
        const tempTrend = getTemperatureTrend(currentWeather.temp, priorWeather.temp)
        const pressureTrend = getPressureTrend(currentWeather.pressure, priorWeather.pressure)

        return {
          imageIndex: index + 1,
          imageUrl: url,
          date,
          time,
          windDirection,
          weather: weatherDescription,
          weatherSixHoursPrior: priorWeatherDescription,
          temperature: temperature.toString(),
          tempTrend: tempTrend,
          pressureTrend: pressureTrend,
        }
      } catch (error) {
        console.error(`Error analyzing image ${url}:`, error)
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

    // Process with limit of 3 concurrent requests
    const results = await runInBatches(imageUrls, 3, analyzeImage)

    const pdfBuffer = await generatePDF(results)

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=weather_analysis_report.pdf",
      },
    })
  } catch (error) {
    console.error("Error in analyze-images API:", error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
