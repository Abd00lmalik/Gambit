"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { usePfpImage, notifyPfpUpdated } from "@/hooks/usePfpImage";

interface PfpUploadProps {
  currentPfp?: string | null;
  onUploaded?: (url: string) => void;
}

export default function PfpUpload({ currentPfp, onUploaded }: PfpUploadProps) {
  const { address } = useAccount();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedAt, setUploadedAt] = useState(0);
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

      // Upload succeeded — set timestamp to cache-bust the proxy URL
      // This ensures the browser fetches the new image, not the cached old one
      setUploadedAt(Date.now());
      // Clear preview AFTER setting timestamp, so the proxy URL takes over immediately
      setPreview(null);
      // Broadcast so EVERY mounted avatar (navbar, cards, duels) refetches the
      // new blob in the same tick — prevents stale-image flicker elsewhere.
      notifyPfpUpdated(address);
      onUploaded?.(data.pfpUrl);
    } catch (e) {
      setError("Upload failed. Try again.");
      // Drop the optimistic preview — leaving it up makes a FAILED upload look
      // like it stuck (until the next reload shows the old/default avatar).
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  // P1 fix: display is ADDRESS-derived via the proxy (blob store = source of
  // truth). The DB record (currentPfp) is no longer required to show the image,
  // so a Supabase hiccup can't make an upload "not stick" visually.
  const { src: proxySrc, onError } = usePfpImage(address);
  const displayUrl = preview
    || (uploadedAt > 0 && address ? `/api/pfp/${address.toLowerCase()}?t=${uploadedAt}` : null)
    || proxySrc;

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
            key={displayUrl}
            src={displayUrl}
            onError={onError}
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
