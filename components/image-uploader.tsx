"use client";

import type React from "react";
import { useRef, useState, useEffect, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Plus, MapPin, Search } from "lucide-react";
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
  const [showMap, setShowMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData>({
    lat: 29.6516,
    lng: -82.3248,
    name: "Gainesville, FL, USA",
  });
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  // Initialize Leaflet map when shown
  useEffect(() => {
    if (!showMap) return;

    let cancelled = false;

    const initMap = async () => {
      // Dynamically import Leaflet (client-side only)
      const L = (await import("leaflet")).default;

      // Fix default marker icon paths broken by webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (cancelled || !mapRef.current || mapInstanceRef.current) return;

      leafletRef.current = L;

      const map = L.map(mapRef.current).setView(
        [selectedLocation.lat, selectedLocation.lng],
        9
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Place initial marker
      markerRef.current = L.marker([selectedLocation.lat, selectedLocation.lng]).addTo(map);

      // Click to set location
      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;

        // Reverse geocode via Nominatim
        let name = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          const data = await res.json();
          name = data.display_name || name;
        } catch {}

        const location: LocationData = { lat, lng, name };
        setSelectedLocation(location);
        if (onLocationSelect) onLocationSelect(location);

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        }
      });
    };

    // Load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [showMap]);

  // Search location using Nominatim
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`
      );
      const data = await res.json();
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const name = result.display_name;
    const location: LocationData = { lat, lng, name };

    setSelectedLocation(location);
    if (onLocationSelect) onLocationSelect(location);
    setSearchResults([]);
    setSearchQuery("");

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 10);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else if (leafletRef.current) {
        markerRef.current = leafletRef.current
          .marker([lat, lng])
          .addTo(mapInstanceRef.current);
      }
    }
  };

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
    if (uploadedImages.length > 0) onUpload(uploadedImages);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files));
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
            onClick={() => setShowMap(!showMap)}
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
          {/* Search bar */}
          <div className="p-3 border-b bg-white flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search for a location..."
              className="flex-1 border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={searching}
              type="button"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="bg-white border-b max-h-40 overflow-y-auto">
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 border-b last:border-b-0"
                  onClick={() => selectSearchResult(result)}
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          )}

          {/* Map */}
          <div ref={mapRef} className="w-full h-64" />

          <div className="p-3 bg-gray-50 border-t flex justify-between items-center">
            <p className="text-sm text-gray-600 truncate max-w-xs">
              {selectedLocation?.name || "Click on the map to select a location"}
            </p>
            <Button size="sm" variant="outline" onClick={() => setShowMap(false)} type="button">
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
