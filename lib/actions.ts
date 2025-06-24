function generateCSV(results: Array<{ date: string; time: string }>, imageUrls: string[]): string {
  // Create CSV content with logo reference
  const logoPath = "/deer-stats-logo.png"

  const csvContent = [
    "# Deer Stats - Image Analysis Report",
    `# Generated on: ${new Date().toLocaleString()}`,
    "# Logo: " + logoPath,
    "",
    "Image URL,Date,Time,Status",
    ...results.map((result, index) => {
      const imageUrl = imageUrls[index] || ""
      const status = result.date === "error" ? "Failed" : "Success"
      return `"${imageUrl}","${result.date}","${result.time}","${status}"`
    }),
  ].join("\n")

  return csvContent
}

async function processImages(imageUrls: string[]) {
  "use server"

  const results: Array<{ date: string; time: string }> = []

  for (const imageUrl of imageUrls) {
    try {
      // Simulate image processing delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const now = new Date()
      results.push({ date: now.toLocaleDateString(), time: now.toLocaleTimeString() })
    } catch (error) {
      console.error("Error processing image:", error)
      results.push({ date: "error", time: "error" })
    }
  }

  const csvContent = generateCSV(results, imageUrls)
  const csvBlob = new Blob([csvContent], { type: "text/csv" })

  // Create a download URL for the CSV file
  const csvUrl = URL.createObjectURL(csvBlob)

  // In the processImages function, update the return statement to include logo info:
  return {
    csvUrl: csvBlob.url,
    processedCount: results.length,
    success: true,
    dateTimeData: results,
    logoUrl: "/deer-stats-logo.png",
  }
}

export { processImages }
