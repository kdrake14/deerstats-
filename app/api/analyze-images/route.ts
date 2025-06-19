import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import type { NextRequest } from "next/server"
import axios from "axios"
import { format } from "date-fns"

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
    return response.data
  } catch (error) {
    console.error(`Error fetching weather data for timestamp ${timestamp}:`, error)
    throw error
  }
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
            imageIndex: index,
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
        const priorWeatherData = await fetchWeatherData(sixHoursPriorTimestamp, lat, lon, apiKey)

        const currentWeather = weatherData.current
        const priorWeather = priorWeatherData.current

        // Extract wind direction
        const windDeg = currentWeather.wind_deg
        const windDirection = windDeg >= 337.5 || windDeg < 22.5 ? "N" :
                              windDeg < 67.5 ? "NE" :
                              windDeg < 112.5 ? "E" :
                              windDeg < 157.5 ? "SE" :
                              windDeg < 202.5 ? "S" :
                              windDeg < 247.5 ? "SW" :
                              windDeg < 292.5 ? "W" : "NW"

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
          imageIndex: index,
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
          imageIndex: index,
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

    // Generate CSV content
    const csvHeader = "Image Index,Image URL,Date,Time,Wind Direction,Weather,Weather 6 Hours Prior,Temperature (F),Temperature Trend,Pressure Trend\n"
    const csvRows = results.map(result => 
      `${result.imageIndex},"${result.imageUrl}",${result.date},${result.time},${result.windDirection},${result.weather},${result.weatherSixHoursPrior},${result.temperature},${result.tempTrend},${result.pressureTrend}`
    ).join("\n")
    const csvContent = csvHeader + csvRows

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=weather_data.csv",
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
