"use server"

import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

// Schema for the extracted date and time
const DateTimeSchema = z.object({
  date: z.string().describe("The date found in the image in YYYY-MM-DD format, or 'not found' if no date is visible"),
  time: z.string().describe("The time found in the image in HH:MM format, or 'not found' if no time is visible"),
})

export async function processImages(imageUrls: string[]) {
  try {
    console.log(`Processing ${imageUrls.length} images with OpenAI Vision...`)

    // Process each image with OpenAI Vision
    const analysisPromises = imageUrls.map(async (url, index) => {
      try {
        console.log(`Processing image ${index + 1}: ${url}`)

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

        console.log(`Successfully processed image ${index + 1}:`, result.object)

        return {
          url,
          filename: url.split("/").pop() || `image-${index + 1}`,
          ...result.object,
          success: true,
        }
      } catch (error) {
        console.error(`Error processing image ${url}:`, error)
        return {
          url,
          filename: url.split("/").pop() || `image-${index + 1}`,
          date: "error",
          time: "error",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    })

    const results = await Promise.all(analysisPromises)

    // Generate CSV with the extracted data
    const headers = ["filename", "url", "date", "time", "status", "error"]
    const csvRows = [
      headers.join(","),
      ...results.map((item) =>
        [
          `"${item.filename}"`,
          `"${item.url}"`,
          `"${item.date}"`,
          `"${item.time}"`,
          item.success ? "success" : "error",
          `"${item.error || ""}"`,
        ].join(","),
      ),
    ]

    const csvContent = csvRows.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const csvUrl = URL.createObjectURL(blob)

    // Return the structured data as requested
    const dateTimeArray = results.map((result) => ({
      date: result.date,
      time: result.time,
    }))

    console.log(`Processing complete. Processed ${results.length} images.`)

    return {
      csvUrl,
      processedCount: imageUrls.length,
      success: true,
      dateTimeData: dateTimeArray, // The requested date/time array
      results, // Full results for debugging
    }
  } catch (error) {
    console.error("Error in processImages:", error)
    throw new Error(`Failed to process images: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
