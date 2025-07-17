// api/upload/route.ts
import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const location = JSON.parse(formData.get('location') as string)

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const fileExtension = file.name.split('.').pop()
    const key = `uploads/${uuidv4()}.${fileExtension}`

    // Create signed URL for direct upload
    const putObjectCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      ContentType: file.type,
      Metadata: {
        latitude: location.lat.toString(),
        longitude: location.lng.toString(),
      },
    })

    const signedUrl = await getSignedUrl(s3Client, putObjectCommand, {
      expiresIn: 3600,
    })

    // Upload the file directly to S3 using the signed URL
    const uploadResponse = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file to S3')
    }

    // Return the public URL for the client to use
    const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`

    return NextResponse.json({
      publicUrl,
      key,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}