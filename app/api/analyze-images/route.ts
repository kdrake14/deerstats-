// pages/api/weather-report.ts

import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import type { NextRequest } from "next/server"
import axios from "axios"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import sizeOf from "image-size" // for image dimension detection

// Data validation schemas
const DateTimeSchema = z.object({
  date: z.string().describe("The date in YYYY-MM-DD or 'not found'"),
  time: z.string().describe("Time in HH:MM or 'not found'"),
})

const RequestSchema = z.object({
  imageUrls: z.array(z.string().url()),
})

// Load image from URL, keep aspect ratio
async function loadImageWithSize(imageUrl: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" })
  const mimeType = response.headers['content-type'] || 'image/png'
  const buffer = Buffer.from(response.data)
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`
  const dimensions = sizeOf(buffer)
  return { dataUrl, width: dimensions.width, height: dimensions.height }
}

// Helper functions for weather data and trends
const kelvinToFahrenheit = (k: number) => Math.round(((k - 273.15) * 9) / 5 + 32)

const getTemperatureTrend = (currentK: number, prevK: number) =>
  currentK > prevK ? "Rising" : currentK < prevK ? "Falling" : "Stable"

const getPressureTrend = (currentP: number, prevP: number) =>
  currentP > prevP ? "Rising" : currentP < prevP ? "Falling" : "Stable"

// Fetch historical weather data
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

// Generate PDF with header and table
async function generatePDF(results: any[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10

  // Load logo and get dimensions
  const logoUrl = "https://www.deerstats.com/deer-stats-logo.png"
  const logoInfo = await loadImageWithSize(logoUrl)

  // Scale logo to fit within 40mm width while keeping aspect ratio
  const maxWidth = 40
  const scaleRatio = maxWidth / logoInfo.width
  const scaledHeight = logoInfo.height * scaleRatio

  const logoX = margin
  const logoY = 10
  // Draw logo
  doc.addImage(logoInfo.dataUrl, "PNG", logoX, logoY, maxWidth, scaledHeight)

  // Draw title next to logo, vertically aligned
  const titleText = "Weather Data Analysis Report"
  const titleX = logoX + maxWidth + 5
  const titleY = logoY + scaledHeight / 2 + 3 // approximate vertical centering
  doc.setFontSize(18)
  doc.text(titleText, titleX, titleY)

  // Additional info below header
  doc.setFontSize(10)
  const now = new Date()
  doc.text(`Generated on: ${now.toLocaleString()}`, margin, logoY + 25)
  doc.text(`Total Images Analyzed: ${results.length}`, margin, logoY + 31)

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
        const footerText = "www.deerstats.com" // replace as needed
        doc.setFontSize(8)
        doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: "center" })
      }
    }
  })

  // Add summary at the end
  const finalY = (doc as any).lastAutoTable?.finalY || logoY + 45
  if (finalY < pageHeight - 60) {
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
    doc.text("Note: Weather descriptions may be abbreviated.", margin, finalY + 50)
    doc.text("Temperature in Fahrenheit (°F).", margin, finalY + 55)
  }

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

        // Build timestamps
        const dateTimeStr = `${date}T${time}:00-05:00` // modify as needed for timezone
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

        const tempF = kelvinToFahrenheit(currentWeather.temp)
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
          temperature: tempF.toString(),
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
