"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUploader } from "@/components/image-uploader";
import { ImagePreview } from "@/components/image-preview";
import {
  Loader2,
  Download,
  CheckCircle,
  AlertCircle,
  FileText,
} from "lucide-react";

export type UploadedImage = {
  id: string;
  file: File;
  preview: string;
  s3Url?: string;
  uploadStatus?: "pending" | "uploading" | "uploaded" | "error";
  location?: {
    lat: number;
    lng: number;
    name?: string;
  };
};

type ProcessingStatus = "idle" | "processing" | "success" | "error";

export function ImageProcessor() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    name?: string;
  }>({
    lat: 29.6516,
    lng: -82.3248,
    name: "Gainesville, FL, USA"
  });

  const handleUpload = (newImages: UploadedImage[]) => {
    const imagesWithStatus = newImages.map((img) => ({
      ...img,
      uploadStatus: "pending" as const,
      location: selectedLocation,
    }));
    setImages((prev) => [...prev, ...imagesWithStatus]);
  };

  const handleLocationSelect = (location: {
    lat: number;
    lng: number;
    name?: string;
  }) => {
    setSelectedLocation(location);
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        location: img.uploadStatus === "pending" ? location : img.location,
      }))
    );
  };

  const handleRemove = (id: string) => {
    setImages((prev) => prev.filter((image) => image.id !== id));
    setUploadProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[id];
      return newProgress;
    });
  };

  const uploadToS3 = async (image: UploadedImage): Promise<UploadedImage> => {
    try {
      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id ? { ...img, uploadStatus: "uploading" } : img
        )
      );

      const formData = new FormData();
      formData.append("file", image.file);
      if (image.location) {
        formData.append("location", JSON.stringify(image.location));
      }

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress((prev) => ({
            ...prev,
            [image.id]: progress,
          }));
        }
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const { publicUrl } = await response.json();

      const updatedImage = {
        ...image,
        s3Url: publicUrl,
        uploadStatus: "uploaded" as const,
      };

      setImages((prev) =>
        prev.map((img) => (img.id === image.id ? updatedImage : img))
      );

      return updatedImage;
    } catch (error) {
      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id ? { ...img, uploadStatus: "error" } : img
        )
      );
      throw error;
    }
  };

  const handleProcess = async () => {
    if (images.length === 0) return;

    setStatus("processing");
    setError(null);

    try {
      // Upload all pending images to S3
      const uploadPromises = images.map((image) => {
        if (image.uploadStatus === "uploaded" && image.s3Url) {
          return Promise.resolve(image);
        }
        return uploadToS3(image);
      });

      const uploadedImages = await Promise.all(uploadPromises);
      const imageData = uploadedImages
        .filter((img) => img.s3Url)
        .map((img) => ({
          url: img.s3Url!,
          location: img.location,
        }));

      // Generate weather report
      const response = await fetch("/api/analyze-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images: imageData,
          defaultLocation: selectedLocation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to generate report: ${response.statusText}`
        );
      }

      const pdfBlob = await response.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);

      setPdfUrl(pdfUrl);
      setStatus("success");
    } catch (err) {
      console.error("Processing error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to process images"
      );
      setStatus("error");
    }
  };

  const handleReset = () => {
    setImages([]);
    setStatus("idle");
    setPdfUrl(null);
    setError(null);
    setUploadProgress({});
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <ImageUploader
            onUpload={handleUpload}
            onLocationSelect={handleLocationSelect}
            disabled={status === "processing"}
          />

          {images.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  Selected Images ({images.length})
                </h3>
                {selectedLocation?.name && (
                  <p className="text-sm text-muted-foreground">
                    Location: {selectedLocation.name}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image) => (
                  <ImagePreview
                    key={image.id}
                    image={image}
                    onRemove={handleRemove}
                    disabled={status === "processing"}
                    uploadProgress={uploadProgress[image.id]}
                  />
                ))}
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="bg-red-50 p-4 rounded-md flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Processing failed</h4>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {status === "success" && pdfUrl && (
            <div className="bg-green-50 p-4 rounded-md">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-800">
                    Analysis complete
                  </h4>
                  <p className="text-green-700 text-sm">
                    Successfully analyzed {images.length} images and generated a
                    comprehensive weather analysis report.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {status === "idle" && (
              <Button
                onClick={handleProcess}
                disabled={images.length === 0}
                className="min-w-[180px]"
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate Weather Report
              </Button>
            )}

            {status === "processing" && (
              <Button disabled className="min-w-[180px]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Report...
              </Button>
            )}

            {status === "success" && pdfUrl && (
              <>
                <Button asChild variant="default" className="min-w-[180px]">
                  <a href={pdfUrl} download="weather_analysis_report.pdf">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF Report
                  </a>
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Process More Images
                </Button>
              </>
            )}

            {status === "error" && (
              <Button variant="outline" onClick={handleReset}>
                Try Again
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}