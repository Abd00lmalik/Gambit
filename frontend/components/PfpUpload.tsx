"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

interface PfpUploadProps {
  currentPfp?: string | null;
  onUploaded?: (url: string) => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

export default function PfpUpload({ currentPfp, onUploaded }: PfpUploadProps) {
  const { address } = useAccount();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Proxy URL we are waiting to confirm; null once it has loaded.
  const [pendingProxyUrl, setPendingProxyUrl] = useState<string | null>(null);
  // Once the proxy serves our upload, keep rendering that URL even if the
  // parent's profile refetch hasn't caught up yet (no flicker window).
  const [verifiedUrl, setVerifiedUrl] = useState<string | null>(null);
  const [initialFailed, setInitialFailed] = useState(false);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addrLower = address?.toLowerCase();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // If the parent hands us a freshly-fetched pfp_url, allow another shot at it.
  useEffect(() => {
    setInitialFailed(false);
  }, [currentPfp, addrLower]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;

    // Local preview — shown immediately and KEPT until the server proxy
    // confirms it can serve the new image (no more blank/placeholder flicker).
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setIsUploading(true);
    setError(null);
    attemptRef.current = 0;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("address", address);

      const res = await fetch("/api/pfp", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      // Upload + DB write are confirmed complete (the POST only returns 200
      // after BOTH succeed). Start verifying the proxy URL; preview stays up
      // until it loads. Cache-buster defeats any earlier cached 404/image.
      setPendingProxyUrl(`/api/pfp/${addrLower}?t=${Date.now()}`);
      onUploaded?.(data.pfpUrl);
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Verification loop: preload the pending proxy URL in a detached Image.
  // Only when it decodes successfully do we hand rendering over to it.
  useEffect(() => {
    if (!pendingProxyUrl) return;
    let cancelled = false;

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setVerifiedUrl(pendingProxyUrl);
      setPendingProxyUrl(null);
      setPreview(null);
      setError(null);
    };
    img.onerror = () => {
      if (cancelled) return;
      if (attemptRef.current < MAX_RETRIES) {
        attemptRef.current += 1;
        timerRef.current = setTimeout(() => {
          if (!cancelled && addrLower) {
            setPendingProxyUrl(`/api/pfp/${addrLower}?t=${Date.now()}`);
          }
        }, RETRY_DELAY_MS);
      } else {
        // Proxy still failing after retries: the image IS saved (upload + DB
        // both returned success) — keep the local preview for this session so
        // the user sees their new PFP, and tell them the server view lags.
        setError("Saved. Image takes a moment to appear for others — refresh shortly.");
      }
    };
    img.src = pendingProxyUrl;

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pendingProxyUrl, addrLower]);

  // Pre-upload: show the stored PFP via the proxy when the parent says one exists.
  const initialSrc =
    !preview && !pendingProxyUrl && !verifiedUrl && currentPfp && addrLower
      ? `/api/pfp/${addrLower}`
      : null;
  const displayUrl = pendingProxyUrl || preview || verifiedUrl || (!initialFailed ? initialSrc : null);

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
            onError={() => {
              // Only the initial stored-pfp load can hit this now (upload
              // previews are data URLs). Treat a 404 as "no pfp yet" rather
              // than showing a broken image.
              if (!preview && !pendingProxyUrl) setInitialFailed(true);
            }}
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-teal/15 border-2 border-teal/30 flex items-center justify-center">
            <span className="font-display text-2xl font-bold text-teal">
              {addrLower?.charAt(2).toUpperCase() || "?"}
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
