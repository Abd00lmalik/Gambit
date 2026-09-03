-- Gambit Supabase Schema
-- Run this in the Supabase SQL Editor or via migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- WALLETS: user profiles linked to on-chain addresses
-- ============================================================
CREATE TABLE wallet_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  pfp_url TEXT,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  biggest_win NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_volume NUMERIC(18, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_profiles_address ON wallet_profiles(address);

-- ============================================================
-- DUELS: on-chain duel records synced from DuelCreated/settle events
-- ============================================================
CREATE TABLE duels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_address TEXT NOT NULL UNIQUE,
  factory_address TEXT NOT NULL,
  player_a TEXT NOT NULL,
  player_b TEXT,
  stake_amount NUMERIC(18, 8) NOT NULL,
  market_address TEXT NOT NULL,
  join_deadline BIGINT NOT NULL,
  state INTEGER NOT NULL DEFAULT 0,
  winner TEXT,
  pot NUMERIC(18, 8) NOT NULL DEFAULT 0,
  asset TEXT,
  interval_sec INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_duels_player_a ON duels(player_a);
CREATE INDEX idx_duels_player_b ON duels(player_b);
CREATE INDEX idx_duels_state ON duels(state);
CREATE INDEX idx_duels_created_at ON duels(created_at DESC);
CREATE INDEX idx_duels_contract ON duels(contract_address);

-- ============================================================
-- SETTLE_EVENTS: audit log of settle transactions
-- ============================================================
CREATE TABLE settle_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  duel_contract TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  block_number BIGINT NOT NULL,
  winner TEXT,
  pot_distributed NUMERIC(18, 8) NOT NULL DEFAULT 0,
  settled_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settle_events_duel ON settle_events(duel_contract);

-- ============================================================
-- RPC cursor: tracks last processed block for the indexer
-- ============================================================
CREATE TABLE indexer_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the indexer cursor (use 0 or the factory deploy block)
INSERT INTO indexer_state (key, value)
VALUES ('last_processed_block', '476195706')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RLS policies (Row Level Security)
-- ============================================================
ALTER TABLE wallet_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE settle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;

-- Public read access for profiles and duels
CREATE POLICY "Public can read wallet profiles"
  ON wallet_profiles FOR SELECT
  USING (true);

CREATE POLICY "Public can read duels"
  ON duels FOR SELECT
  USING (true);

CREATE POLICY "Public can read settle events"
  ON settle_events FOR SELECT
  USING (true);

-- Authenticated users can update their own profile
CREATE POLICY "Users can update own profile"
  ON wallet_profiles FOR UPDATE
  USING (address = lower(auth.uid()::text));

-- Service role can do everything (for the indexer)
CREATE POLICY "Service role full access on wallet_profiles"
  ON wallet_profiles FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on duels"
  ON duels FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on settle_events"
  ON settle_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on indexer_state"
  ON indexer_state FOR ALL
  USING (auth.role() = 'service_role');
