// In-memory stand-in for @/lib/db used ONLY by the PFP route tests.
const profiles = new Map(); // address → { address, pfp_url, updated_at }

export function __reset() {
  profiles.clear();
}

export function __dump() {
  return [...profiles.entries()].map(([address, p]) => ({
    address,
    pfp_url: p.pfp_url,
  }));
}

export async function updateProfilePfp(address, pfpUrl) {
  profiles.set(String(address).toLowerCase(), {
    address: String(address).toLowerCase(),
    pfp_url: pfpUrl,
    updated_at: new Date().toISOString(),
  });
  return true;
}
