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
 */
export function usePfpImage(address: string | undefined) {
  const [failed, setFailed] = useState(false);

  // Reset when the address changes (or a remount happens after upload)
  useEffect(() => {
    setFailed(false);
  }, [address]);

  const src = address && !failed ? `/api/pfp/${address.toLowerCase()}` : null;
  return {
    src,
    onError: () => setFailed(true),
  };
}
