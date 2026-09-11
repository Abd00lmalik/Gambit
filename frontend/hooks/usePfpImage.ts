"use client";

import { useEffect, useState } from "react";

/**
 * P1 (PFP regression fix): derive a wallet's PFP source from its ADDRESS via
 * the per-address proxy route — the blob store is the source of truth, NOT the
 * Supabase profile row. Previously the display was gated on `pfp_url` from the
 * DB, so any Supabase hiccup made uploads appear to "not save" (UI fell back
 * to initials even though the blob was stored per-address and readable).
 *
 * Returns the proxy src until the image fails to load (e.g. this wallet has no
 * PFP yet → proxy 404s), at which point src becomes null so the caller can
 * render the initial-letter fallback.
 *
 * Flicker hardening: every mounted consumer subscribes to a tiny broadcast
 * (`notifyPfpUpdated`). After a successful upload the uploader dispatches it
 * and ALL avatars on the page re-fetch with a fresh cache-busting version at
 * the same moment — previously only the uploader's own copy bust the cache,
 * so nav/card avatars kept showing the stale cached image (or the initial
 * letter if they had 404'd before the first upload) until a remount.
 */

const PFP_EVENT = "gambit:pfp-updated";

export function notifyPfpUpdated(address: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PFP_EVENT, { detail: { address: address.toLowerCase() } })
  );
}

export function usePfpImage(address: string | undefined) {
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  // Reset when the address changes (or a remount happens after upload)
  useEffect(() => {
    setFailed(false);
    setVersion(0);
  }, [address]);

  // Refresh in lockstep when this wallet's PFP is (re)uploaded anywhere
  useEffect(() => {
    if (!address) return;
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.address === address.toLowerCase()) {
        setFailed(false);
        setVersion(Date.now());
      }
    };
    window.addEventListener(PFP_EVENT, onUpdate);
    return () => window.removeEventListener(PFP_EVENT, onUpdate);
  }, [address]);

  const src =
    address && !failed
      ? `/api/pfp/${address.toLowerCase()}${version ? `?v=${version}` : ""}`
      : null;
  return {
    src,
    onError: () => setFailed(true),
  };
}
