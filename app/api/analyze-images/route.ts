import { generateObject } from "ai";
import { z } from "zod";
import type { NextRequest } from "next/server";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define schemas for validation
const DateTimeSchema = z.object({
  date: z
    .string()
    .describe(
      "The date found in the image in YYYY-MM-DD format, or 'not found' if no date is visible"
    ),
  time: z
    .string()
    .describe(
      "The time found in the image in HH:MM format, or 'not found' if no time is visible"
    ),
  moonPhase: z
    .string()
    .describe(
      "There is small moon image between datetime and temperatetur. moon shape if visible in image (e.g., 'Full Moon', 'New Moon', 'Waning Crescent', ...), or not found if not visible"
    ),
});

const RequestSchema = z.object({
  imageUrls: z.array(z.string().url()),
});

// Helper: run in batches
async function runInBatches<T>(
  items: any[],
  batchSize: number,
  handler: (item: any, index: number) => Promise<T>
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, idx) => handler(item, i + idx))
    );
    results.push(...batchResults);
  }
  return results;
}

// Kelvin to Fahrenheit
const kelvinToFahrenheit = (k: number) =>
  Math.round(((k - 273.15) * 9) / 5 + 32);
// Trends
const getTemperatureTrend = (currentK: number, prevK: number) =>
  currentK > prevK ? "Rising" : currentK < prevK ? "Falling" : "Stable";
const getPressureTrend = (currentP: number, prevP: number) =>
  currentP > prevP ? "Rising" : currentP < prevP ? "Falling" : "Stable";

// Fetch weather data
async function fetchWeatherData(
  timestamp: number,
  lat: number,
  lon: number,
  apiKey: string
) {
  const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${timestamp}&appid=${apiKey}`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (err) {
    console.error(`Error fetching weather at ${timestamp}:`, err);
    throw err;
  }
}

// Generate deer activity analysis using OpenAI
async function generateDeerActivityAnalysis(results: any[]) {
  const validResults = results.filter(
    (r) => r.date !== "error" && r.date !== "not found"
  );

  if (validResults.length === 0) {
    return "Insufficient data available for deer activity analysis.";
  }

  // Prepare data summary for OpenAI
  const dataSummary = validResults.map((r) => ({
    date: r.date,
    time: r.time,
    weather: r.weather,
    moonPhase: r.moonPhase,
    temperature: r.temperature,
    windDirection: r.windDirection,
    tempTrend: r.tempTrend,
    pressureTrend: r.pressureTrend,
  }));

  try {
    const analysisSchema = z.object({
      topMonth: z
        .string()
        .describe("The month with the most deer activity based on the data"),
      optimalTimes: z
        .array(z.string())
        .describe(
          "The best times of day for deer activity (e.g., '6:00 AM', '7:00 PM')"
        ),
      favorableWeather: z
        .string()
        .describe("The weather condition most associated with deer activity"),
      temperatureRange: z
        .string()
        .describe(
          "The optimal temperature range for deer activity (e.g., 'in the 60s to 70s')"
        ),
      windPatterns: z
        .array(z.string())
        .describe("Preferred wind directions for deer activity"),
      atmosphericTrends: z
        .boolean()
        .describe(
          "Whether active atmospheric changes (rising/falling pressure/temperature) correlate with activity"
        ),
      pressureTrend: z
        .string()
        .describe(
          "Most common pressure trend during deer activity (rising/falling/stable)"
        ),
      temperatureTrend: z
        .string()
        .describe(
          "Most common temperature trend during deer activity (rising/falling/stable)"
        ),
      summary: z
        .string()
        .describe(
          "A natural, engaging summary sentence about when you're most likely to see deer based on this data"
        ),
      moonPhaseCorrelation: z
        .string()
        .describe(
          "Any correlation between moon phases and deer activity if data is available"
        ),
    });

    const result = await generateObject({
      model: openai("o3-mini-2025-01-31"),
      messages: [
        {
          role: "system",
          content:
            "You are a wildlife behavior expert specializing in deer activity patterns. Analyze the provided weather and timing data to determine optimal conditions for deer sightings. Focus on practical hunting and wildlife observation insights.",
        },
        {
          role: "user",
          content: `Analyze this deer sighting data and weather conditions to determine the optimal patterns for deer activity. 

Data points: ${JSON.stringify(dataSummary, null, 2)}

Please identify:
1. The month with most activity
2. The best times of day (limit to top 2)
3. The most favorable weather conditions
4. The optimal temperature range
5. Preferred wind directions (limit to top 2)
6. Whether atmospheric changes (pressure/temperature trends) correlate with activity
7. Any correlation between moon phases and deer activity if data is available
8. A natural summary sentence about when deer are most likely to be seen

Base your analysis on the frequency and patterns in the actual data provided.`,
        },
      ],
      schema: analysisSchema,
    });

    return {
      topMonth: result.object.topMonth,
      topTimes: result.object.optimalTimes,
      topWeather: result.object.favorableWeather,
      tempRange: result.object.temperatureRange,
      topWinds: result.object.windPatterns,
      activeTrends: result.object.atmosphericTrends,
      pressureTrend: result.object.pressureTrend,
      temperatureTrend: result.object.temperatureTrend,
      validCount: validResults.length,
      aiSummary: result.object.summary,
    };
  } catch (error) {
    console.error("Error generating AI analysis:", error);
    // Fallback to simple message if AI analysis fails
    return "Analysis temporarily unavailable. Please try again later.";
  }
}

// Helper to count occurrences
function countOccurrences(data: any[], key: string) {
  const counts: Record<string, number> = {};
  data.forEach((item) => {
    const value = item[key];
    if (value && value !== "N/A" && value !== "error") {
      counts[value] = (counts[value] || 0) + 1;
    }
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// Generate PDF with enhanced structure
async function generatePDF(results: any[], defaultLocation: any) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Load logo
  let logoDataUrl = "";
  try {
    const logoResponse = await fetch(
      "https://www.deerstats.com/deer-stats-logo.png"
    );
    if (logoResponse.ok) {
      const logoBuffer = await logoResponse.arrayBuffer();
      const logoBase64 = Buffer.from(logoBuffer).toString("base64");
      logoDataUrl = `data:image/png;base64,${logoBase64}`;
    }
  } catch (error) {
    console.warn("Could not load logo:", error);
  }

  // Helper function to add footer to all pages (no background)
  const addFooter = () => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      // Footer text without background
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("www.deerstats.com", pageWidth / 2, pageHeight - 6, {
        align: "center",
      });

      // Add descriptive page labels
      let pageLabel = "";
      if (i === 1) {
        pageLabel = "Summary";
      } else if (i === 2) {
        pageLabel = "Data Table";
      } else if (i === 3) {
        pageLabel = "Weather Patterns";
      } else {
        pageLabel = `Image #${i - 3}`;
      }

      doc.text(
        `Page ${i} of ${totalPages} - ${pageLabel}`,
        pageWidth - margin,
        pageHeight - 6,
        { align: "right" }
      );
    }
  };

  // PAGE 1: DEER ACTIVITY SUMMARY

  // Logo positioned next to title
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 15, 25, 25);
  }

  // Title next to logo
  doc.setFontSize(24);
  doc.setTextColor(52, 73, 94);
  doc.text("Weather Data Analysis Report", margin + 30, 30);

  // Subtitle
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Comprehensive Image Analysis & Weather Intelligence",
    margin + 30,
    38
  );

  // Report metadata
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  const now = new Date();
  doc.text(`Generated: ${now.toLocaleString()}`, margin, 55);
  doc.text(`Total Images Processed: ${results.length}`, margin, 62);
  doc.text(
    `Analysis Location: ${defaultLocation.name} (${defaultLocation.lat}°N, ${defaultLocation.lng}°W)`,
    margin,
    69
  );

  // Summary statistics
  const successCount = results.filter(
    (r) => r.date !== "error" && r.date !== "not found"
  ).length;
  const errorCount = results.filter((r) => r.date === "error").length;
  const notFoundCount = results.filter((r) => r.date === "not found").length;

  // Executive Summary Section
  doc.setFontSize(16);
  doc.setTextColor(52, 73, 94);
  doc.text("Executive Summary", margin, 85);

  // Formatted summary text
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  let summaryY = 95;

  const summaryLines = [
    `Analysis completed successfully for ${successCount} out of ${results.length} images processed.`,
    `${errorCount} images encountered processing errors during analysis.`,
    `${notFoundCount} images had no detectable timestamp information.`,
  ];

  summaryLines.forEach((line) => {
    doc.text(line, margin, summaryY);
    summaryY += 6;
  });

  // SUMMARY - Deer Stats Section
  summaryY += 15;
  doc.setFontSize(18);
  doc.setTextColor(52, 73, 94);
  doc.text("SUMMARY - Deer Stats", margin, summaryY);

  summaryY += 15;
  const analysis = await generateDeerActivityAnalysis(results);

  if (typeof analysis === "string") {
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(analysis, margin, summaryY);
  } else {
    // Use the AI-generated summary
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);

    const summaryText =
      analysis.aiSummary ||
      `You're most likely to see a deer in ${
        analysis.topMonth
      }, around ${analysis.topTimes.join(" or ")}, when the weather is ${
        analysis.topWeather
      }, the temperature is ${
        analysis.tempRange
      }, the wind is from the ${analysis.topWinds.join(
        " or "
      )}, with ${analysis.temperatureTrend.toLowerCase()} temperatures and ${analysis.pressureTrend.toLowerCase()} pressure.`;

    // Split the text into multiple lines for better readability
    const lines = doc.splitTextToSize(summaryText, pageWidth - 2 * margin);

    lines.forEach((line: string) => {
      doc.text(line, margin, summaryY);
      summaryY += 8;
    });
  }

  // PAGE 2: DATA TABLE
  doc.addPage();

  // Header for page 2 with prominent identification
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 15, 20, 20);
  }

  doc.setFontSize(18);
  doc.setTextColor(52, 73, 94);
  doc.text("Page 2 - Detailed Analysis Results", margin + 25, 25);

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text("Complete Data Table with Weather Analysis", margin + 25, 32);

  // Prepare table data
  const tableData = results.map((r) => [
    r.imageIndex.toString(),
    r.date,
    r.time,
    r.moonPhase || "N/A",
    r.windDirection,
    r.weather.length > 12 ? r.weather.substring(0, 10) + ".." : r.weather,
    r.weatherSixHoursPrior.length > 12
      ? r.weatherSixHoursPrior.substring(0, 10) + ".."
      : r.weatherSixHoursPrior,
    r.temperature + "°F",
    r.tempTrend,
    r.pressureTrend,
  ]);

  const availableWidth = pageWidth - 2 * margin;

  autoTable(doc, {
    head: [
      [
        "#",
        "Date",
        "Time",
        "Moon",
        "Wind",
        "Weather",
        "Weather 6h",
        "Temp",
        "T.Trend",
        "P.Trend",
      ],
    ],
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
      0: { cellWidth: availableWidth * 0.05 },
      1: { cellWidth: availableWidth * 0.12 },
      2: { cellWidth: availableWidth * 0.08 },
      3: { cellWidth: availableWidth * 0.08 }, // Moon phase column
      4: { cellWidth: availableWidth * 0.07 },
      5: { cellWidth: availableWidth * 0.14 },
      6: { cellWidth: availableWidth * 0.14 },
      7: { cellWidth: availableWidth * 0.08 },
      8: { cellWidth: availableWidth * 0.08 },
      9: { cellWidth: availableWidth * 0.08 },
    },
  });

  // PAGE 3: SUMMARY TABLES
  doc.addPage();

  // Header for summary tables
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 15, 20, 20);
  }

  doc.setFontSize(18);
  doc.setTextColor(52, 73, 94);
  doc.text("Page 3 - Weather Pattern Summary", margin + 25, 25);

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text("Frequency Analysis of Weather Conditions", margin + 25, 32);

  // Prepare data for tables
  const weatherCounts = countOccurrences(results, "weather");
  const tempTrendCounts = countOccurrences(results, "tempTrend");
  const pressureTrendCounts = countOccurrences(results, "pressureTrend");
  const windDirectionCounts = countOccurrences(results, "windDirection");

  // Table layout calculations
  const tableWidth = (pageWidth - 3 * margin) / 2;
  const tableHeight = 60;
  const leftColX = margin;
  const rightColX = margin + tableWidth + margin;
  const firstRowY = 45;
  const secondRowY = firstRowY + tableHeight + 15;

  // Weather Type Table (Top Left)
  autoTable(doc, {
    head: [["Weather Type", "Count"]],
    body: weatherCounts,
    startY: firstRowY,
    margin: { left: leftColX, right: rightColX },
    tableWidth: tableWidth,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [52, 73, 94], textColor: 255 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 30, halign: "right" },
    },
  });

  // Temperature Trend Table (Top Right)
  autoTable(doc, {
    head: [["Temp Trend", "Count"]],
    body: tempTrendCounts,
    startY: firstRowY,
    margin: { left: rightColX },
    tableWidth: tableWidth,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [52, 73, 94], textColor: 255 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 30, halign: "right" },
    },
  });

  // Pressure Trend Table (Bottom Left)
  autoTable(doc, {
    head: [["Pressure Trend", "Count"]],
    body: pressureTrendCounts,
    startY: secondRowY,
    margin: { left: leftColX, right: rightColX },
    tableWidth: tableWidth,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [52, 73, 94], textColor: 255 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 30, halign: "right" },
    },
  });

  // Wind Direction Table (Bottom Right)
  autoTable(doc, {
    head: [["Wind Direction", "Count"]],
    body: windDirectionCounts,
    startY: secondRowY,
    margin: { left: rightColX },
    tableWidth: tableWidth,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [52, 73, 94], textColor: 255 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 30, halign: "right" },
    },
  });

  // PAGES 3+: ANALYZED IMAGES
  for (let i = 0; i < results.length; i++) {
    doc.addPage();

    const result = results[i];

    // Header with clear page and image identification
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", margin, 15, 15, 15);
    }

    doc.setFontSize(16);
    doc.setTextColor(52, 73, 94);
    doc.text(
      `Page ${doc.getCurrentPageInfo().pageNumber} - Image Analysis #${
        result.imageIndex
      }`,
      margin + 20,
      25
    );

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Analyzed Image ${i + 1} of ${results.length}`, margin + 20, 32);

    // Try to load and display the analyzed image
    try {
      const imageResponse = await fetch(result.imageUrl);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString("base64");
        const mimeType =
          imageResponse.headers.get("content-type") || "image/jpeg";
        const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

        // Add image (centered, with reasonable size)
        const imgWidth = 120;
        const imgHeight = 80;
        const imgX = (pageWidth - imgWidth) / 2;
        const imgY = 40;

        doc.addImage(imageDataUrl, "JPEG", imgX, imgY, imgWidth, imgHeight);

        // Analysis details below image (without "Analysis Results" header)
        let detailY = imgY + imgHeight + 20;

        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);

        const details = [
          `Date Extracted: ${result.date}`,
          `Time Extracted: ${result.time}`,
          `Moon Phase: ${result.moonPhase}`,
          `Wind Direction: ${result.windDirection}`,
          `Current Weather: ${result.weather}`,
          `Weather 6h Prior: ${result.weatherSixHoursPrior}`,
          `Temperature: ${result.temperature}`,
          `Temperature Trend: ${result.tempTrend}`,
          `Pressure Trend: ${result.pressureTrend}`,
        ];

        details.forEach((detail) => {
          doc.text(detail, margin, detailY);
          detailY += 8;
        });
      }
    } catch (error) {
      console.warn(`Could not load image ${result.imageUrl}:`, error);

      // Show placeholder if image can't be loaded
      doc.setFillColor(240, 240, 240);
      doc.rect((pageWidth - 120) / 2, 40, 120, 80, "F");
      doc.setTextColor(120, 120, 120);
      doc.text("Image could not be loaded", pageWidth / 2, 85, {
        align: "center",
      });
    }
  }

  // Add footer to all pages
  addFooter();

  return doc.output("arraybuffer");
}

// The main API handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawImages = body.images as {
      url: string;
      location?: { lat: number; lng: number };
    }[];
    const defaultLocation = body.defaultLocation as {
      lat: number;
      lng: number;
      name: string;
    };

    // Resolve relative URLs to absolute so fetch() and OpenAI can reach them
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const images = rawImages.map((img) => ({
      ...img,
      url: img.url.startsWith('http') ? img.url : `${protocol}://${host}${img.url}`,
    }));

    if (!Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No images provided" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const apiKey = process.env.OPENWEATHERMAP_API_KEY!;

    const analyzeImage = async (
      img: { url: string; location?: { lat: number; lng: number } },
      index: number
    ) => {
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
                  text: `Analyze this image and extract any visible date and time information. Focus on timestamps, date stamps, clock displays, calendar dates or indicators. Use the most prominent or relevant one if multiple. Also extract moon phase if visible. moon phase is in small circle image between datetime and temperature. 
                  If MOON PHASE IS white filled circle, it must be 'Full Moon'. If it is black filled circle, it must be 'New Moon'. If it is white crescent shape, it must be 'Waxing Crescent' or 'Waning Crescent' depending on the side. If it is white half circle, it must be 'First Quarter' or 'Third Quarter' depending on the side. If it is mostly white with small dark sliver, it must be 'Waxing Gibbous' or 'Waning Gibbous' depending on the side.
                                    1. 'New Moon'
◉ (Fully dark)

The Sun lights the far side of the Moon—facing away from Earth.

2. 'Waxing Crescent'
◑ (Right sliver white)

A tiny curve on the right becomes visible as the Moon moves.

3. 'First Quarter'
◐ (Right half white)

Half-lit by the Sun (right side in the Northern Hemisphere).

4. 'Waxing Gibbous'
◓ (Mostly right white, left sliver dark)

More than half visible, but not yet full.

5. 'Full Moon'
◉ (Fully white)

The entire near side reflects sunlight—fully illuminated.

6. 'Waning Gibbous'
◒ (Mostly left white, right sliver dark)

The lit area starts shrinking (left side now brighter).

7. 'Third Quarter'
◑ (Left half white)

The left half is lit—opposite of the First Quarter.

8. 'Waning Crescent'
◓ (Left sliver white)

Only a thin curve remains before darkness (New Moon returns).`,
                },
                {
                  type: "image",
                  image: img.url,
                },
              ],
            },
          ],
          schema: DateTimeSchema,
        });

        const { date, time, moonPhase } = result.object;

        if (date === "not found" || time === "not found") {
          return {
            imageIndex: index + 1,
            imageUrl: img.url,
            date,
            time,
            moonPhase: moonPhase || "N/A",
            windDirection: "N/A",
            weather: "N/A",
            weatherSixHoursPrior: "N/A",
            temperature: "N/A",
            tempTrend: "N/A",
            pressureTrend: "N/A",
          };
        }

        // Use image location or fallback to default
        const lat = img.location?.lat ?? defaultLocation.lat;
        const lon = img.location?.lng ?? defaultLocation.lng;

        // Build timestamp
        const dateTimeStr = `${date}T${time}:00-05:00`; // assuming EDT
        const timestamp = Math.floor(new Date(dateTimeStr).getTime() / 1000);
        const sixHoursPrior = timestamp - 6 * 3600;

        // Fetch weather data
        const weatherData = await fetchWeatherData(timestamp, lat, lon, apiKey);
        const priorWeatherData = await fetchWeatherData(
          sixHoursPrior,
          lat,
          lon,
          apiKey
        );

        const currentWeather = weatherData.data[0];
        const priorWeather = priorWeatherData.data[0];

        // Wind direction
        const windDeg = currentWeather.wind_deg;
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
            : "NW";

        const weatherDesc = currentWeather.weather[0]?.description || "N/A";
        const priorDesc = priorWeather.weather[0]?.description || "N/A";

        const temp = kelvinToFahrenheit(currentWeather.temp);
        const priorTemp = kelvinToFahrenheit(priorWeather.temp);

        const tempTrend = getTemperatureTrend(
          currentWeather.temp,
          priorWeather.temp
        );
        const pressureTrend = getPressureTrend(
          currentWeather.pressure,
          priorWeather.pressure
        );

        return {
          imageIndex: index + 1,
          imageUrl: img.url,
          date,
          time,
          moonPhase: moonPhase || "N/A",
          windDirection: windDir,
          weather: weatherDesc,
          weatherSixHoursPrior: priorDesc,
          temperature: temp.toString(),
          tempTrend,
          pressureTrend,
        };
      } catch (err) {
        console.error(`Error analyzing ${img.url}:`, err);
        return {
          imageIndex: index + 1,
          imageUrl: img.url,
          date: "error",
          time: "error",
          moonPhase: "error",
          windDirection: "error",
          weather: "error",
          weatherSixHoursPrior: "error",
          temperature: "error",
          tempTrend: "error",
          pressureTrend: "error",
        };
      }
    };

    const results = await runInBatches(images, 1, analyzeImage);

    const pdfBuffer = await generatePDF(results, defaultLocation);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="weather_report.pdf"',
      },
      status: 200,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message, err }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}
