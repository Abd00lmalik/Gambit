import { sql } from "@vercel/postgres";

export { sql };

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
// Query helpers
// ============================================================
export async function getOrCreateProfile(
  address: string
): Promise<DbWalletProfile | null> {
  const addr = address.toLowerCase();

  const existing = await sql<DbWalletProfile>`
    SELECT * FROM wallet_profiles WHERE address = ${addr} LIMIT 1
  `;

  if (existing.rows.length > 0) return existing.rows[0];

  const created = await sql<DbWalletProfile>`
    INSERT INTO wallet_profiles (address) VALUES (${addr})
    ON CONFLICT (address) DO NOTHING
    RETURNING *
  `;

  if (created.rows.length > 0) return created.rows[0];

  // If ON CONFLICT returned nothing, fetch it
  const refetch = await sql<DbWalletProfile>`
    SELECT * FROM wallet_profiles WHERE address = ${addr} LIMIT 1
  `;
  return refetch.rows[0] || null;
}

export async function updateProfilePfp(
  address: string,
  pfpUrl: string
): Promise<boolean> {
  const addr = address.toLowerCase();
  await sql`
    UPDATE wallet_profiles
    SET pfp_url = ${pfpUrl}, updated_at = NOW()
    WHERE address = ${addr}
  `;
  return true;
}

export async function updateProfileStats(
  address: string,
  stats: { wins?: number; losses?: number; streak?: number; biggest_win?: number; total_volume?: number }
): Promise<void> {
  const addr = address.toLowerCase();
  const sets: string[] = [];
  if (stats.wins !== undefined) sets.push(`wins = ${stats.wins}`);
  if (stats.losses !== undefined) sets.push(`losses = ${stats.losses}`);
  if (stats.streak !== undefined) sets.push(`streak = ${stats.streak}`);
  if (stats.biggest_win !== undefined) sets.push(`biggest_win = ${stats.biggest_win}`);
  if (stats.total_volume !== undefined) sets.push(`total_volume = ${stats.total_volume}`);
  if (sets.length === 0) return;

  await sql.query(
    `UPDATE wallet_profiles SET ${sets.join(", ")}, updated_at = NOW() WHERE address = $1`,
    [addr]
  );
}

export async function getUserDuelsFromDb(
  address: string
): Promise<DbDuel[]> {
  const addr = address.toLowerCase();
  const result = await sql<DbDuel>`
    SELECT * FROM duels
    WHERE LOWER(player_a) = ${addr} OR LOWER(player_b) = ${addr}
    ORDER BY created_at DESC
  `;
  return result.rows;
}

export async function getRecentDuelsFromDb(
  limit = 20
): Promise<DbDuel[]> {
  const result = await sql<DbDuel>`
    SELECT * FROM duels
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result.rows;
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
  await sql`
    INSERT INTO duels (
      contract_address, factory_address, player_a, player_b,
      stake_amount, market_address, join_deadline, state,
      asset, interval_sec, pot, updated_at
    ) VALUES (
      ${duel.contract_address.toLowerCase()},
      ${duel.factory_address.toLowerCase()},
      ${duel.player_a.toLowerCase()},
      ${duel.player_b?.toLowerCase() || null},
      ${duel.stake_amount},
      ${duel.market_address.toLowerCase()},
      ${duel.join_deadline},
      ${duel.state},
      ${duel.asset},
      ${duel.interval_sec},
      ${duel.stake_amount * 2},
      NOW()
    )
    ON CONFLICT (contract_address) DO UPDATE SET
      player_b = EXCLUDED.player_b,
      state = EXCLUDED.state,
      updated_at = NOW()
  `;
  return true;
}

export async function updateDuelState(
  contractAddress: string,
  state: number,
  winner: string | null
): Promise<void> {
  const addr = contractAddress.toLowerCase();
  await sql`
    UPDATE duels
    SET state = ${state},
        winner = ${winner?.toLowerCase() || null},
        settled_at = NOW(),
        updated_at = NOW()
    WHERE contract_address = ${addr}
  `;
}

export async function insertSettleEvent(event: {
  duel_contract: string;
  tx_hash: string;
  block_number: number;
  winner: string | null;
  pot_distributed: number;
  settled_by: string;
}): Promise<void> {
  await sql`
    INSERT INTO settle_events (
      duel_contract, tx_hash, block_number, winner,
      pot_distributed, settled_by
    ) VALUES (
      ${event.duel_contract.toLowerCase()},
      ${event.tx_hash.toLowerCase()},
      ${event.block_number},
      ${event.winner?.toLowerCase() || null},
      ${event.pot_distributed},
      ${event.settled_by.toLowerCase()}
    )
    ON CONFLICT (tx_hash) DO NOTHING
  `;
}

export async function getLastProcessedBlock(): Promise<number> {
  const result = await sql`
    SELECT value FROM indexer_state WHERE key = 'last_processed_block' LIMIT 1
  `;
  return result.rows.length > 0 ? parseInt(result.rows[0].value, 10) : 0;
}

export async function setLastProcessedBlock(block: number): Promise<void> {
  await sql`
    INSERT INTO indexer_state (key, value, updated_at)
    VALUES ('last_processed_block', ${String(block)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

export async function getActiveDuelContracts(): Promise<string[]> {
  const result = await sql<{ contract_address: string }>`
    SELECT contract_address FROM duels WHERE state IN (0, 1)
  `;
  return result.rows.map((r) => r.contract_address);
}
