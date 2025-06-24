import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import type { NextRequest } from "next/server"
import axios from "axios"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const DateTimeSchema = z.object({
  date: z.string().describe("The date found in the image in YYYY-MM-DD format, or 'not found' if no date is visible"),
  time: z.string().describe("The time found in the image in HH:MM format, or 'not found' if no time is visible"),
})

const RequestSchema = z.object({
  imageUrls: z.array(z.string().url()),
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

// Helper function to convert temperature from Kelvin to Fahrenheit
const kelvinToFahrenheit = (kelvin: number): number => {
  return Math.round(((kelvin - 273.15) * 9) / 5 + 32)
}

// Helper function to determine if temperature is rising or dropping
const getTemperatureTrend = (currentTemp: number, previousTemp: number): string => {
  return currentTemp > previousTemp ? "Rising" : currentTemp < previousTemp ? "Falling" : "Stable"
}

// Helper function to determine if pressure is rising or dropping
const getPressureTrend = (currentPressure: number, previousPressure: number): string => {
  return currentPressure > previousPressure ? "Rising" : currentPressure < previousPressure ? "Falling" : "Stable"
}

// Helper function to fetch weather data from OpenWeatherMap
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

// Helper function to generate PDF with logo and branding
async function generatePDF(results: any[]) {
  // Use A4 landscape for more width
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  })

  // Get page dimensions
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margins = 15

  // Add logo to PDF header
  try {
    // Load the logo image
    const logoResponse = await fetch("/deer-stats-logo.png")
    if (logoResponse.ok) {
      const logoBuffer = await logoResponse.arrayBuffer()
      const logoBase64 = Buffer.from(logoBuffer).toString("base64")

      // Add logo to PDF (top-left corner)
      doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", margins, 10, 25, 25)
    }
  } catch (error) {
    console.warn("Could not add logo to PDF:", error)
  }

  // Add title with logo space
  doc.setFontSize(20)
  doc.setTextColor(52, 73, 94) // Dark blue-gray
  doc.text("Deer Stats - Weather Analysis Report", margins + 30, 20)

  // Add generation date and info
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated on: ${new Date().toLocaleString()}`, margins + 30, 28)
  doc.text(`Total Images Analyzed: ${results.length}`, margins + 30, 34)

  // Prepare table data with truncated content
  const tableData = results.map((result) => [
    result.imageIndex.toString(),
    result.date,
    result.time,
    result.windDirection,
    // Truncate weather descriptions to fit
    result.weather.length > 12 ? result.weather.substring(0, 10) + ".." : result.weather,
    result.weatherSixHoursPrior.length > 12
      ? result.weatherSixHoursPrior.substring(0, 10) + ".."
      : result.weatherSixHoursPrior,
    result.temperature + "°F",
    result.tempTrend,
    result.pressureTrend,
  ])

  // Calculate available width
  const availableWidth = pageWidth - margins * 2

  // Add table with optimized column widths for landscape
  autoTable(doc, {
    head: [["#", "Date", "Time", "Wind", "Weather", "Weather 6h", "Temp", "T.Trend", "P.Trend"]],
    body: tableData,
    startY: 45,
    margin: { top: 45, left: margins, right: margins, bottom: 30 },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      cellWidth: "wrap",
      halign: "center",
    },
    headStyles: {
      fillColor: [52, 73, 94], // Match title color
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: availableWidth * 0.06 }, // # - 6%
      1: { cellWidth: availableWidth * 0.14 }, // Date - 14%
      2: { cellWidth: availableWidth * 0.1 }, // Time - 10%
      3: { cellWidth: availableWidth * 0.08 }, // Wind - 8%
      4: { cellWidth: availableWidth * 0.16 }, // Weather - 16%
      5: { cellWidth: availableWidth * 0.16 }, // Weather 6h - 16%
      6: { cellWidth: availableWidth * 0.1 }, // Temp - 10%
      7: { cellWidth: availableWidth * 0.1 }, // T.Trend - 10%
      8: { cellWidth: availableWidth * 0.1 }, // P.Trend - 10%
    },
    tableWidth: availableWidth,
    didDrawPage: (data) => {
      // Add page numbers in header area
      const pageCount = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth - margins - 30, 15)
    },
  })

  // Add summary section
  const finalY = (doc as any).lastAutoTable.finalY || 45
  if (finalY < pageHeight - 80) {
    doc.setFontSize(12)
    doc.setTextColor(52, 73, 94)
    doc.text("Analysis Summary", margins, finalY + 15)

    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    const successCount = results.filter((r) => r.date !== "error" && r.date !== "not found").length
    const errorCount = results.filter((r) => r.date === "error").length
    const notFoundCount = results.filter((r) => r.date === "not found").length

    doc.text(`✓ Successfully processed: ${successCount} images`, margins, finalY + 25)
    doc.text(`⚠ Errors encountered: ${errorCount} images`, margins, finalY + 32)
    doc.text(`ℹ No timestamp found: ${notFoundCount} images`, margins, finalY + 39)

    // Add note about data formatting
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text("Note: Weather descriptions may be abbreviated to fit the table format.", margins, finalY + 50)
    doc.text(
      "Temperature values are displayed in Fahrenheit (°F). Data sourced from OpenWeatherMap API.",
      margins,
      finalY + 55,
    )
  }

  // Add footer to all pages
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    // Footer background
    doc.setFillColor(52, 73, 94)
    doc.rect(0, pageHeight - 15, pageWidth, 15, "F")

    // Footer text
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text("Generated by Deer Stats Weather Analysis Platform", margins, pageHeight - 8)
    doc.text("Visit us at: www.deerstats.com", pageWidth - margins - 50, pageHeight - 8)
  }

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

        // Parse date and time to create a timestamp
        const dateTimeString = `${date}T${time}:00-05:00` // Assuming Gainesville, FL is in EDT (UTC-5)
        const timestamp = Math.floor(new Date(dateTimeString).getTime() / 1000)
        const sixHoursPriorTimestamp = timestamp - 6 * 60 * 60 // 6 hours earlier

        // Fetch weather data for the timestamp
        const weatherData = await fetchWeatherData(timestamp, lat, lon, apiKey)
        console.log(weatherData)
        const priorWeatherData = await fetchWeatherData(sixHoursPriorTimestamp, lat, lon, apiKey)
        console.log(priorWeatherData)

        const currentWeather = weatherData.data[0]
        const priorWeather = priorWeatherData.data[0]

        // Extract wind direction
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

        // Extract weather description
        const weatherDescription = currentWeather.weather[0]?.description || "N/A"
        const priorWeatherDescription = priorWeather.weather[0]?.description || "N/A"

        // Extract temperature
        const temperature = kelvinToFahrenheit(currentWeather.temp)
        const priorTemperature = kelvinToFahrenheit(priorWeather.temp)

        // Determine temperature and pressure trends
        const tempTrend = getTemperatureTrend(currentWeather.temp, priorWeather.temp)
        const pressureTrend = getPressureTrend(currentWeather.pressure, priorWeather.pressure)

        return {
          imageIndex: index + 1,
          imageUrl: url,
          date: date,
          time: time,
          windDirection: windDirection,
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

    // Process with concurrency limit of 3 to avoid rate limits
    const results = await runInBatches(imageUrls, 3, analyzeImage)

    // Generate PDF
    const pdfBuffer = generatePDF(results)

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
