"use client";

import type React from "react";
import { useRef, useState, type ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Plus, MapPin } from "lucide-react";
import type { UploadedImage } from "./image-processor";

interface LocationData {
  lat: number;
  lng: number;
  name?: string;
}

interface ImageUploaderProps {
  onUpload: (images: UploadedImage[]) => void;
  onLocationSelect?: (location: LocationData) => void;
  disabled?: boolean;
}

function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substr(2, 8);
  const extension = originalName.split(".").pop();
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
  return `${nameWithoutExt}-${timestamp}-${randomSuffix}.${extension}`;
}

export function ImageUploader({
  onUpload,
  onLocationSelect,
  disabled = false,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData>({
    lat: 29.6516,
    lng: -82.3248,
    name: "Gainesville, FL, USA"
  });
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // Load Google Maps script
  useEffect(() => {
    if (!window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
    }
  }, []);

  // Initialize map and geocoder when shown and loaded
  useEffect(() => {
    if (showMap && mapLoaded && mapRef.current && !mapInstanceRef.current) {
      const map = new google.maps.Map(mapRef.current, {
        center: selectedLocation,
        zoom: 8,
      });

      mapInstanceRef.current = map;
      geocoderRef.current = new google.maps.Geocoder();

      // Add initial marker if location exists
      if (selectedLocation) {
        markerRef.current = new google.maps.Marker({
          position: selectedLocation,
          map: map,
        });
      }

      // Add click listener to set location
      map.addListener("click", async (e: google.maps.MapMouseEvent) => {
        if (!e.latLng || !geocoderRef.current) return;

        try {
          const response = await geocoderRef.current.geocode({
            location: e.latLng
          });

          const locationName = response.results[0]?.formatted_address || "Unknown location";
          
          const location: LocationData = {
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
            name: locationName
          };

          setSelectedLocation(location);
          if (onLocationSelect) onLocationSelect(location);

          // Update or create marker
          if (markerRef.current) {
            markerRef.current.setPosition(e.latLng);
          } else {
            markerRef.current = new google.maps.Marker({
              position: e.latLng,
              map: map,
            });
          }
        } catch (error) {
          console.error("Geocoding error:", error);
        }
      });
    }
  }, [showMap, mapLoaded, onLocationSelect]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    const uploadedImages = imageFiles.map((file) => {
      const uniqueFilename = generateUniqueFilename(file.name);
      const uniqueFile = new File([file], uniqueFilename, { type: file.type });

      return {
        id: generateUniqueId(),
        file: uniqueFile,
        preview: URL.createObjectURL(file),
        location: selectedLocation,
      };
    });

    if (uploadedImages.length > 0) {
      onUpload(uploadedImages);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const toggleMap = () => {
    setShowMap(!showMap);
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          isDragging ? "border-primary bg-primary/5" : "border-gray-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          Drag and drop images here
        </h3>
        <p className="mt-1 text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
        <div className="mt-4 flex gap-2 justify-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={disabled}
          >
            <Plus className="mr-2 h-4 w-4" />
            Select Images
          </Button>
          <Button
            type="button"
            onClick={toggleMap}
            variant={selectedLocation ? "default" : "outline"}
            disabled={disabled}
          >
            <MapPin className="mr-2 h-4 w-4" />
            {selectedLocation ? "Location Selected" : "Set Location"}
          </Button>
        </div>
        {selectedLocation?.name && (
          <p className="mt-2 text-xs text-gray-500">
            Location: {selectedLocation.name}
          </p>
        )}
      </div>

      {showMap && (
        <div className="border rounded-lg overflow-hidden">
          <div ref={mapRef} className="w-full h-64" />
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {selectedLocation?.name || "Click on the map to select a location"}
            </p>
            <Button size="sm" variant="outline" onClick={toggleMap}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}