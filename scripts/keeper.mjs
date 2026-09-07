#!/usr/bin/env node
/**
 * Gambit Keeper — Finalizes resolved/voided/expired duels automatically.
 *
 * Polls every 15 seconds. For each active duel (CREATED or LOCKED):
 *   1. Resolves its Market contract via marketId
 *   2. Checks if market resolved/voided or deadline expired
 *   3. Calls settle(), refund(), or cancel() using the deployer wallet
 *
 * Idempotent: checks on-chain state before acting. Safe to run continuously.
 * Nonce: fetches latest nonce before each tx to avoid conflicts with manual actions.
 *
 * Usage: node scripts/keeper.mjs
 */

import { createPublicClient, createWalletClient, http, parseAbiItem, getContract, formatEther } from 'viem';
import { defineChain } from 'viem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────
const RPC_URL        = process.env.RPC_URL || 'https://api.infra.testnet.somnia.network';
const PRIVATE_KEY    = process.env.PRIVATE_KEY || '0x46b00e419189d6c82721b14c9494e4397677dd8ef9dd2a04ff7e130836b4a61a';
const POLL_MS        = parseInt(process.env.POLL_MS || '15000'); // 15 seconds
const CHUNK          = 900; // blocks per getLogs call (Somnia limit: 1000)
const STATE_FILE     = path.join(__dirname, '.keeper-state.json');

// ── Chain & Clients ──────────────────────────────────────
const somniaChain = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const publicClient = createPublicClient({
  chain: somniaChain,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account: PRIVATE_KEY,
  chain: somniaChain,
  transport: http(RPC_URL),
});

const DEPLOYER = walletClient.account.address;
const FACTORY_ADDRESS = '0x7B1A880EDC070FDF6a484DAEbF72e3143e68A9Ea';

// ── Contract ABIs ────────────────────────────────────────
const WAGER_ABI = [
  'function state() view returns (uint8)',
  'function joinDeadline() view returns (uint256)',
  'function owner() view returns (address)',
  'function playerA() view returns (address)',
  'function playerB() view returns (address)',
  'function marketId() view returns (bytes32)',
  'function resolvedMarketContract() view returns (address)',
  'function stakeAmount() view returns (uint256)',
  'function subscriptionFund() view returns (uint256)',
  'function deposits(address) view returns (uint256)',
  'function settle()',
  'function refund()',
  'function cancel()',
];

const MARKET_ABI = [
  'function isResolved() view returns (bool)',
  'function isVoided() view returns (bool)',
  'function status() view returns (uint8)',
];

const BM_ABI = [
  'function markets(bytes32) view returns (tuple(bytes32 oracleQuestionId, uint8 outcomeSlotCount, uint32 voidPolicy, address collateral, bytes32 originOperatorId, bytes32 originVenueId, address oracleAdapter, address creator, address market, bytes32 slug, address resolver, uint32 opensAt, uint32 closesAt, uint8 conditionType))',
];

const FACTORY_ABI = [
  'event DuelCreated(address indexed clone, address indexed playerA, uint256 stakeAmount, address marketAddress, uint256 joinDeadline)',
];

// ── State ────────────────────────────────────────────────
const State = { CREATED: 0, LOCKED: 1, SETTLED: 2, REFUNDED: 3, CANCELLED: 4 };
const StateName = ['CREATED', 'LOCKED', 'SETTLED', 'REFUNDED', 'CANCELLED'];
const FINAL = new Set([State.SETTLED, State.REFUNDED, State.CANCELLED]);

// ── State persistence ────────────────────────────────────
function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const data = JSON.parse(raw);
    return BigInt(data.lastBlock || 0);
  } catch {
    return 482119325n; // v15 factory deploy block
  }
}

function saveState(lastBlock) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastBlock: lastBlock.toString(), updatedAt: new Date().toISOString() }));
}

// ── Helpers ──────────────────────────────────────────────
async function getNonce() {
  return publicClient.getTransactionCount({ address: DEPLOYER, blockTag: 'pending' });
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  process.stderr.write(`[${ts}] ${msg}\n`);
}

async function getDuelInfo(clone) {
  const contract = getContract({ address: clone, abi: WAGER_ABI, client: publicClient });
  const [state, owner, mA, mB, joinDl, mktId, resolved, stake, subFund] = await Promise.all([
    contract.read.state(),
    contract.read.owner(),
    contract.read.playerA(),
    contract.read.playerB(),
    contract.read.joinDeadline(),
    contract.read.marketId(),
    contract.read.resolvedMarketContract(),
    contract.read.stakeAmount(),
    contract.read.subscriptionFund(),
  ]);
  const [depA, depB] = await Promise.all([
    contract.read.deposits([mA]),
    mB !== '0x0000000000000000000000000000000000000000' ? contract.read.deposits([mB]) : 0n,
  ]);
  return {
    state: Number(state), owner, playerA: mA, playerB: mB,
    joinDeadline: joinDl, marketId: mktId, resolvedMarketContract: resolved,
    stakeAmount: stake, subscriptionFund: subFund,
    deposits: { A: depA, B: depB },
  };
}

async function getMarketStatus(addr) {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') {
    return { exists: false, resolved: false, voided: false, status: 0 };
  }
  const code = await publicClient.getCode({ address: addr });
  if (!code || code === '0x') return { exists: false, resolved: false, voided: false, status: 0 };
  const c = getContract({ address: addr, abi: MARKET_ABI, client: publicClient });
  const [resolved, voided, status] = await Promise.all([
    c.read.isResolved().catch(() => false),
    c.read.isVoided().catch(() => false),
    c.read.status().catch(() => 0),
  ]);
  return { exists: true, resolved, voided, status: Number(status) };
}

async function resolveMarket(marketId) {
  const factoryCode = await publicClient.getCode({ address: FACTORY_ADDRESS });
  if (!factoryCode || factoryCode === '0x') return null;
  const c = getContract({ address: FACTORY_ADDRESS, abi: BM_ABI, client: publicClient });
  const r = await c.read.markets([marketId]);
  return r.market;
}

// ── Contract calls ───────────────────────────────────────
async function callSettle(clone) {
  const nonce = await getNonce();
  const { request } = await publicClient.simulateContract({
    address: clone, abi: WAGER_ABI, functionName: 'settle',
    account: DEPLOYER, nonce, gas: 500000n,
  });
  const hash = await walletClient.writeContract(request);
  return publicClient.waitForTransactionReceipt({ hash });
}

async function callRefund(clone) {
  const nonce = await getNonce();
  const { request } = await publicClient.simulateContract({
    address: clone, abi: WAGER_ABI, functionName: 'refund',
    account: DEPLOYER, nonce, gas: 500000n,
  });
  const hash = await walletClient.writeContract(request);
  return publicClient.waitForTransactionReceipt({ hash });
}

async function callCancel(clone) {
  const nonce = await getNonce();
  const { request } = await publicClient.simulateContract({
    address: clone, abi: WAGER_ABI, functionName: 'cancel',
    account: DEPLOYER, nonce, gas: 500000n,
  });
  const hash = await walletClient.writeContract(request);
  return publicClient.waitForTransactionReceipt({ hash });
}

// ── Core logic ───────────────────────────────────────────
async function processDuel(clone) {
  let info;
  try {
    info = await getDuelInfo(clone);
  } catch { return; }

  if (FINAL.has(info.state)) return; // already done

  let market;
  try {
    const resolved = info.resolvedMarketContract !== '0x0000000000000000000000000000000000000000'
      ? info.resolvedMarketContract
      : await resolveMarket(info.marketId);
    market = await getMarketStatus(resolved);
  } catch { market = { exists: false, resolved: false, voided: false }; }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const deadlinePassed = now > info.joinDeadline;

  // CREATED: unjoined
  if (info.state === State.CREATED) {
    if (market.resolved || deadlinePassed) {
      log(`CANCEL ${clone} — stake: ${formatEther(info.stakeAmount)} STT, reason: ${market.resolved ? 'market resolved' : 'deadline passed'}`);
      try {
        const r = await callCancel(clone);
        log(`  ✅ tx: ${r.transactionHash}  gas: ${r.gasUsed}`);
      } catch (e) {
        log(`  ❌ ${e.shortMessage || e.message?.slice(0, 120)}`);
      }
    }
    return;
  }

  // LOCKED: both joined
  if (info.state === State.LOCKED) {
    if (market.voided) {
      log(`REFUND ${clone} — market voided`);
      try {
        const r = await callRefund(clone);
        log(`  ✅ tx: ${r.transactionHash}  gas: ${r.gasUsed}`);
      } catch (e) {
        log(`  ❌ ${e.shortMessage || e.message?.slice(0, 120)}`);
      }
    } else if (market.resolved) {
      log(`SETTLE ${clone} — pot: ${formatEther(info.stakeAmount * 2n)} STT`);
      try {
        const r = await callSettle(clone);
        log(`  ✅ tx: ${r.transactionHash}  gas: ${r.gasUsed}`);
      } catch (e) {
        log(`  ❌ ${e.shortMessage || e.message?.slice(0, 120)}`);
      }
    }
  }
}

// ── Event scanning ───────────────────────────────────────
async function scanEvents(fromBlock, toBlock) {
  const clones = [];
  for (let start = Number(fromBlock); start <= Number(toBlock); start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, Number(toBlock));
    try {
      const logs = await publicClient.getLogs({
        address: FACTORY_ADDRESS,
        event: parseAbiItem('event DuelCreated(address indexed clone, address indexed playerA, uint256 stakeAmount, address marketAddress, uint256 joinDeadline)'),
        fromBlock: BigInt(start), toBlock: BigInt(end),
      });
      for (const log_ of logs) clones.push(log_.args.clone);
    } catch (e) {
      log(`  ⚠ getLogs error ${start}-${end}: ${e.message?.slice(0, 80)}`);
    }
  }
  return clones;
}

// ── Main loop ────────────────────────────────────────────
let lastScanClones = [];
let lastScanTime = 0;

async function tick() {
  try {
    const latest = await publicClient.getBlockNumber();
    let lastBlock = loadState();

    if (latest > lastBlock) {
      const newClones = await scanEvents(lastBlock + 1n, latest);
      if (newClones.length) {
        lastScanClones = [...new Set([...lastScanClones, ...newClones])];
        log(`Found ${newClones.length} new duel(s) — total tracked: ${lastScanClones.length}`);
      }
      lastBlock = latest;
      saveState(lastBlock);
      lastScanTime = Date.now();
    }

    for (const clone of [...lastScanClones]) {
      await processDuel(clone);
    }
  } catch (e) {
    log(`Loop error: ${e.shortMessage || e.message?.slice(0, 120)}`);
  }
}

// ── Entry ────────────────────────────────────────────────
log('===============================================');
log(' Gambit Keeper v15');
log(` Deployer: ${DEPLOYER}`);
log(` Factory:  ${FACTORY_ADDRESS}`);
log(` Poll:     ${POLL_MS / 1000}s`);
log(` Start:    ${new Date().toISOString()}`);
log('===============================================');

// Initial scan
await tick();

// Poll loop
setInterval(tick, POLL_MS);
