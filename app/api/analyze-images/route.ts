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

// Kelvin to Fahrenheit conversion
const kelvinToFahrenheit = (kelvin: number): number => Math.round(((kelvin - 273.15) * 9) / 5 + 32)

// Trends
const getTemperatureTrend = (currentKelvin: number, previousKelvin: number): string =>
  currentKelvin > previousKelvin ? "Rising" : currentKelvin < previousKelvin ? "Falling" : "Stable"

const getPressureTrend = (currentPressure: number, previousPressure: number): string =>
  currentPressure > previousPressure ? "Rising" : currentPressure < previousPressure ? "Falling" : "Stable"

// Fetch weather data
async function fetchWeatherData(timestamp: number, lat: number, lon: number, apiKey: string) {
  const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${timestamp}&appid=${apiKey}`
  try {
    const response = await axios.get(url)
    return response.data
  } catch (error) {
    console.error(`Error fetching weather for timestamp ${timestamp}:`, error)
    throw error
  }
}

// Load image as base64 string from URL
async function loadImageBase64(imageUrl: string): Promise<string> {
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" })
  const base64 = Buffer.from(response.data).toString("base64")
  // Return a data URI for PNG images
  return `data:${response.headers['content-type']};base64,${base64}`
}

// Generate PDF with embedded logo and footer
async function generatePDF(results: any[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  // Load logo from URL
  const logoUrl = "https://www.deerstats.com/deer-stats-logo.png"
  const logoDataUrl = await loadImageBase64(logoUrl)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10

  // Draw logo at top center
  const logoWidth = 40
  const logoY = 10
  doc.addImage(logoDataUrl, "PNG", (pageWidth - logoWidth) / 2, logoY, logoWidth, 15)

  // Title and info
  doc.setFontSize(18)
  doc.text("Weather Data Analysis Report", margin, logoY + 25)

  doc.setFontSize(10)
  const now = new Date()
  doc.text(`Generated on: ${now.toLocaleString()}`, margin, logoY + 30)
  doc.text(`Total Images Analyzed: ${results.length}`, margin, logoY + 36)

  // Prepare table data
  const tableData = results.map((res) => [
    res.imageIndex.toString(),
    res.date,
    res.time,
    res.windDirection,
    res.weather.length > 12 ? res.weather.substring(0, 10) + ".." : res.weather,
    res.weatherSixHoursPrior.length > 12 ? res.weatherSixHoursPrior.substring(0, 10) + ".." : res.weatherSixHoursPrior,
    res.temperature + "°F",
    res.tempTrend,
    res.pressureTrend,
  ])

  const availableWidth = pageWidth - 2 * margin

  autoTable(doc, {
    head: [["#", "Date", "Time", "Wind", "Weather", "Weather 6h", "Temp", "T.Trend", "P.Trend"]],
    body: tableData,
    startY: logoY + 45,
    margin: { left: margin, right: margin, top: logoY + 45 },
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
    didDrawPage: () => {
      // Add footer on each page
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        const footerText = "YourWebsite.com" // Replace with actual site
        doc.setFontSize(8)
        doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: "center" })
      }
    }
  })

  // Add a summary section at the end
  const finalY = (doc as any).lastAutoTable?.finalY || logoY + 45
  if (finalY < pageHeight - 60) {
    doc.setFontSize(12)
    doc.text("Summary", margin, finalY + 15)

    doc.setFontSize(9)
    const successCount = results.filter(r => r.date !== "error" && r.date !== "not found").length
    const errorCount = results.filter(r => r.date === "error").length
    const notFoundCount = results.filter(r => r.date === "not found").length

    doc.text(`Successfully processed: ${successCount} images`, margin, finalY + 25)
    doc.text(`Errors encountered: ${errorCount} images`, margin, finalY + 32)
    doc.text(`No timestamp found: ${notFoundCount} images`, margin, finalY + 39)

    // Add notes
    doc.setFontSize(7)
    doc.text("Note: Weather descriptions may be abbreviated.", margin, finalY + 50)
    doc.text("Temperature values are in °F.", margin, finalY + 55)
  }

  // Return as ArrayBuffer
  return doc.output("arraybuffer")
}

// Main API handler
export async function POST(request: NextRequest) {
  try {
    const { imageUrls } = RequestSchema.parse(await request.json())

    const apiKey = "c960e1bba9a8804ae8aa152df088e9e3"
    const lat = 29.6516
    const lon = -82.3248

    const analyzeImage = async (url: string, index: number) => {
      try {
        // Extract date/time from image
        const result = await generateObject({
          model: openai("gpt-4o"),
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this image and extract visible date and time information. Look for timestamps, date stamps, clock displays, calendar dates, or indicators. Use the most prominent/relevant if multiple.",
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

        // Create UNIX timestamp from date & time
        const dateTimeStr = `${date}T${time}:00-05:00` // assuming EDT
        const timestamp = Math.floor(new Date(dateTimeStr).getTime() / 1000)
        const priorTimestamp = timestamp - 6 * 3600

        // Fetch weather for current and 6 hours prior
        const weatherData = await fetchWeatherData(timestamp, lat, lon, apiKey)
        const priorWeatherData = await fetchWeatherData(priorTimestamp, lat, lon, apiKey)

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
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
