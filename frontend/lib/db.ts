import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Supabase client — use service role key for server-side ops (bypasses RLS)
// ============================================================
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer service role key (bypasses RLS) for server-side API routes
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("SUPABASE_URL / SUPABASE_KEY not set — DB features disabled");
}

// ============================================================
// Types
// ============================================================
export interface DbWalletProfile {
  id: string;
  address: string;
  display_name: string | null;
  pfp_url: string | null;
  wins: number;
  losses: number;
  streak: number;
  biggest_win: number;
  total_volume: number;
  created_at: string;
  updated_at: string;
}

export interface DbDuel {
  id: string;
  contract_address: string;
  factory_address: string;
  player_a: string;
  player_b: string | null;
  stake_amount: number;
  market_address: string;
  join_deadline: number;
  state: number;
  winner: string | null;
  pot: number;
  asset: string | null;
  interval_sec: number | null;
  created_at: string;
  settled_at: string | null;
  updated_at: string;
}

export interface DbSettleEvent {
  id: string;
  duel_contract: string;
  tx_hash: string;
  block_number: number;
  winner: string | null;
  pot_distributed: number;
  settled_by: string;
  created_at: string;
}

// ============================================================
// Query helpers (all gracefully return null/[] if DB unavailable)
// ============================================================
export async function getOrCreateProfile(
  address: string
): Promise<DbWalletProfile | null> {
  if (!supabase) return null;
  const addr = address.toLowerCase();

  try {
    const { data: existing } = await supabase
      .from("wallet_profiles")
      .select("*")
      .eq("address", addr)
      .limit(1)
      .single();

    if (existing) return existing as DbWalletProfile;

    const { data: created, error: insertErr } = await supabase
      .from("wallet_profiles")
      .insert({ address: addr })
      .select()
      .single();

    if (created) return created as DbWalletProfile;

    // Race condition: another request created it — fetch again
    const { data: refetched } = await supabase
      .from("wallet_profiles")
      .select("*")
      .eq("address", addr)
      .limit(1)
      .single();

    return (refetched as DbWalletProfile) || null;
  } catch (e) {
    console.warn("getOrCreateProfile failed:", e);
    return null;
  }
}

export async function updateProfilePfp(
  address: string,
  pfpUrl: string
): Promise<boolean> {
  if (!supabase) {
    console.warn("updateProfilePfp: no supabase client");
    return false;
  }
  const addr = address.toLowerCase();
  try {
    // Upsert: insert if not exists, update if exists
    const { error } = await supabase
      .from("wallet_profiles")
      .upsert(
        { address: addr, pfp_url: pfpUrl, updated_at: new Date().toISOString() },
        { onConflict: "address" }
      );

    if (error) {
      console.warn("updateProfilePfp upsert error:", error.message, error.details);
      return false;
    }
    console.log("updateProfilePfp: saved pfp for", addr);
    return true;
  } catch (e) {
    console.warn("updateProfilePfp failed:", e);
    return false;
  }
}

export async function updateProfileDisplayName(
  address: string,
  displayName: string
): Promise<boolean> {
  if (!supabase) return false;
  const addr = address.toLowerCase();
  const name = displayName.trim() || null;
  try {
    // Ensure profile exists
    await supabase
      .from("wallet_profiles")
      .insert({ address: addr })
      .select()
      .maybeSingle();

    const { error } = await supabase
      .from("wallet_profiles")
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq("address", addr);

    if (error) {
      console.warn("updateProfileDisplayName error:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("updateProfileDisplayName failed:", e);
    return false;
  }
}

export async function updateProfileStats(
  address: string,
  stats: { wins?: number; losses?: number; streak?: number; biggest_win?: number; total_volume?: number }
): Promise<void> {
  if (!supabase) return;
  const addr = address.toLowerCase();
  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (stats.wins !== undefined) update.wins = stats.wins;
  if (stats.losses !== undefined) update.losses = stats.losses;
  if (stats.streak !== undefined) update.streak = stats.streak;
  if (stats.biggest_win !== undefined) update.biggest_win = stats.biggest_win;
  if (stats.total_volume !== undefined) update.total_volume = stats.total_volume;

  try {
    await supabase
      .from("wallet_profiles")
      .update(update)
      .eq("address", addr);
  } catch (e) {
    console.warn("updateProfileStats failed:", e);
  }
}

export async function getUserDuelsFromDb(
  address: string
): Promise<DbDuel[]> {
  if (!supabase) return [];
  const addr = address.toLowerCase();
  try {
    const { data } = await supabase
      .from("duels")
      .select("*")
      .or(`player_a.eq.${addr},player_b.eq.${addr}`)
      .order("created_at", { ascending: false });

    return (data as DbDuel[]) || [];
  } catch (e) {
    console.warn("getUserDuelsFromDb failed:", e);
    return [];
  }
}

export async function getRecentDuelsFromDb(
  limit = 20
): Promise<DbDuel[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("duels")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data as DbDuel[]) || [];
  } catch (e) {
    console.warn("getRecentDuelsFromDb failed:", e);
    return [];
  }
}

export async function upsertDuelFromEvent(duel: {
  contract_address: string;
  factory_address: string;
  player_a: string;
  player_b: string | null;
  stake_amount: number;
  market_address: string;
  join_deadline: number;
  state: number;
  asset: string | null;
  interval_sec: number | null;
}): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("duels")
      .upsert(
        {
          contract_address: duel.contract_address.toLowerCase(),
          factory_address: duel.factory_address.toLowerCase(),
          player_a: duel.player_a.toLowerCase(),
          player_b: duel.player_b?.toLowerCase() || null,
          stake_amount: duel.stake_amount,
          market_address: duel.market_address.toLowerCase(),
          join_deadline: duel.join_deadline,
          state: duel.state,
          asset: duel.asset,
          interval_sec: duel.interval_sec,
          pot: duel.stake_amount * 2,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "contract_address" }
      );

    if (error) {
      console.warn("upsertDuelFromEvent error:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("upsertDuelFromEvent failed:", e);
    return false;
  }
}

export async function updateDuelState(
  contractAddress: string,
  state: number,
  winner: string | null
): Promise<void> {
  if (!supabase) return;
  const addr = contractAddress.toLowerCase();
  try {
    await supabase
      .from("duels")
      .update({
        state,
        winner: winner?.toLowerCase() || null,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("contract_address", addr);
  } catch (e) {
    console.warn("updateDuelState failed:", e);
  }
}

export async function insertSettleEvent(event: {
  duel_contract: string;
  tx_hash: string;
  block_number: number;
  winner: string | null;
  pot_distributed: number;
  settled_by: string;
}): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from("settle_events")
      .upsert(
        {
          duel_contract: event.duel_contract.toLowerCase(),
          tx_hash: event.tx_hash.toLowerCase(),
          block_number: event.block_number,
          winner: event.winner?.toLowerCase() || null,
          pot_distributed: event.pot_distributed,
          settled_by: event.settled_by.toLowerCase(),
        },
        { onConflict: "tx_hash" }
      );
  } catch (e) {
    console.warn("insertSettleEvent failed:", e);
  }
}

export async function getLastProcessedBlock(): Promise<number> {
  if (!supabase) return 0;
  try {
    const { data } = await supabase
      .from("indexer_state")
      .select("value")
      .eq("key", "last_processed_block")
      .limit(1)
      .single();

    return data ? parseInt(data.value, 10) : 0;
  } catch (e) {
    console.warn("getLastProcessedBlock failed:", e);
    return 0;
  }
}

export async function setLastProcessedBlock(block: number): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from("indexer_state")
      .upsert(
        { key: "last_processed_block", value: String(block), updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
  } catch (e) {
    console.warn("setLastProcessedBlock failed:", e);
  }
}

export async function getActiveDuelContracts(): Promise<string[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("duels")
      .select("contract_address")
      .in("state", [0, 1]);

    return (data as { contract_address: string }[]).map((r) => r.contract_address);
  } catch (e) {
    console.warn("getActiveDuelContracts failed:", e);
    return [];
  }
}
