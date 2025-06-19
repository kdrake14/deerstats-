import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Add any validation logic here
        // For example, check file size, type, user permissions, etc.

        // Return an object with the pathname if validation passes
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB
          addRandomSuffix: true, // Move this option to server-side
          cacheControlMaxAge: 60 * 60 * 24 * 30, // 30 days cache
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This runs after the upload is complete
        // You can add logging, database updates, etc. here
        console.log("Upload completed:", blob.url)
      },
    })

    return Response.json(jsonResponse)
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 })
  }
}
