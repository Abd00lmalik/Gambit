"use client";

import { useState, useRef } from "react";
import { useAccount } from "wagmi";

interface PfpUploadProps {
  currentPfp?: string | null;
  onUploaded?: (url: string) => void;
}

export default function PfpUpload({ currentPfp, onUploaded }: PfpUploadProps) {
  const { address } = useAccount();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("address", address);

      const res = await fetch("/api/pfp", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      onUploaded?.(data.pfpUrl);
    } catch (e) {
      setError("Upload failed. Try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const displayUrl = preview || currentPfp;

  return (
    <div className="relative group">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onClick={() => fileRef.current?.click()}
        className="cursor-pointer relative"
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Profile"
            className="h-20 w-20 rounded-full object-cover border-2 border-teal/30"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-teal/15 border-2 border-teal/30 flex items-center justify-center">
            <span className="font-display text-2xl font-bold text-teal">
              {address?.charAt(2).toUpperCase() || "?"}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {isUploading ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-white text-xs font-bold">Change</span>
          )}
        </div>
      </div>

      {error && (
        <p className="font-body text-[10px] text-down mt-1 text-center">{error}</p>
      )}
    </div>
  );
}
