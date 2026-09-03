# Gambit — Manual Testing Guide

A step-by-step guide to testing the full Gambit flow through the live app. No scripts, no CLI — just click through like a real user.

---

## Reference: Current Contract Addresses

| Contract | Address |
|----------|---------|
| **Factory (v6)** | `0x9e66dD3D9C75825bbe2f2D5B494cE89E08828a06` |
| Implementation | `0xEa6971C152341C0c92c292908b2215BE260114d5` |
| Fee Recipient | `0x25265b9dBEb6c653b0CA281110Bb0697a9685107` |

**Block Explorer:** [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network)
**Oracle Explorer:** [prd.oracle.somnia.host](https://prd.oracle.somnia.host)
**DreamDEX API:** [stg.api.dreamdex.io](https://stg.api.dreamdex.io)

---

## 1. Setup

### Start the dev server

```bash
cd Gambit/frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

### Wallet Setup

You need **two wallets** on Somnia Testnet (Chain ID: `50312`). Use MetaMask or any EVM wallet.

**To add Somnia Testnet to your wallet:**

1. Go to [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network)
2. Click "Add to MetaMask" or manually add:
   - **Network Name:** Somnia Testnet
   - **RPC URL:** `https://api.infra.testnet.somnia.network`
   - **Chain ID:** `50312`
   - **Currency Symbol:** STT

**Wallet A (Player A — the creator):**
- Address: `0x0022EC010030158cC27B283BA640706eDBa6080f`
- Needs: ~2 STT minimum (0.1 stake + gas + subscription)

**Wallet B (Player B — the joiner):**
- Address: `0x5E2D3BD4ad0aE1CDF49DdB0F0C96d55790199cE6`
- Needs: ~1 STT minimum (0.1 stake + gas)

**Get testnet STT from the faucet:**
- Visit [faucet.somnia.network](https://faucet.somnia.network)
- Paste your wallet address
- Wait 24 hours between requests (cooldown enforced)

### Factory Funding

The v6 Factory must hold at least **35 STT** to fund reactive subscriptions. As of testing, it holds **50 STT** — enough for 1 duel cycle. If the factory runs low, it recycles funds automatically after each settlement.

---

## 2. Profile

### Step 1: Connect Wallet

1. Open http://localhost:3000
2. Click the **"Connect Wallet"** button in the top right
3. Select your wallet (MetaMask, etc.)
4. Approve the connection
5. **Expected:** The button changes to show your truncated address (e.g., `0x0022...800f`)

### Step 2: Navigate to Profile

1. Click **"Profile"** in the top navigation bar
2. **Expected:** You see your profile page with:
   - Your truncated address as the title
   - A default avatar (first character of your address)
   - Stats panel showing: Wins, Losses, Win Rate, Biggest Win
   - All values at **0** for a fresh wallet with no history

### Step 3: Upload a Profile Picture

1. On your profile page, click the default avatar circle
2. Select an image from your device
3. Upload it
4. **Expected:**
   - The avatar updates to show your uploaded image
   - It appears with a teal border ring
   - If you visit the profile again later, the image persists
   - Other users visiting your profile see this image

### What indicates a problem:
- Avatar upload fails silently or shows an error — the Supabase storage connection may be down
- Stats show negative numbers or NaN — the on-chain event parsing is broken

---

## 3. Create Duel

### Step 1: Navigate to Create Duel

1. Click **"Create Duel"** in the top navigation
2. **Expected:** You see the create page with:
   - Asset selector (BTC / ETH) — BTC selected by default
   - Interval selector (15m / 1h) — 15m selected by default
   - A live chart showing the current price
   - A countdown timer showing time remaining in the current interval

### Step 2: Verify the Timer

1. Look at the countdown timer
2. It should show a decreasing time (e.g., "12:34" meaning 12 minutes 34 seconds left)
3. **How to verify it's real:** Switch your browser to a different tab for 30 seconds, then come back. The timer should have decreased by ~30 seconds.
4. **Also verify against DreamDEX:** Open the DreamDEX API in a new tab and check that the market's expiry timestamp aligns with what the timer shows.

### Step 3: Check the Market Sentiment Bar

1. Scroll down slightly on the create page
2. You should see a **"DreamDEX Market Sentiment"** bar with:
   - A green (UP) percentage and a red (DOWN) percentage
   - A visual bar showing the split
   - Mid price and spread values
   - "From DreamDEX CLOB" label
3. **How to verify it's real:** The percentages should add up to 100%. If they show 0/0 or don't load, the DreamDEX GraphQL API is unreachable.

### Step 4: Pick a Side

1. Click **"▲ Up"** or **"▼ Down"**
2. **Expected:** The selected side highlights with a colored border (green for UP, red for DOWN)
3. The summary panel updates to show your selection

### Step 5: Enter a Stake

1. Click one of the preset stake buttons (0.1, 0.5, 1, 2.5, 5 STT)
2. Or type a custom amount in the input field (min: 0.1 STT)
3. **Expected:** The summary panel shows:
   - Your Side: ▲ Up or ▼ Down
   - Stake: X STT
   - Potential Payout: approximately (stake × 2 × 0.975) STT (the 0.975 is the 2.5% fee)

### Step 6: Submit the Duel

1. Click **"Create Duel"**
2. **Expected:**
   - Your wallet pops up with a transaction prompt
   - The transaction calls the Factory's `createDuel` function
   - You need to confirm the transaction
3. **After confirmation:**
   - You see a success screen with a green checkmark
   - The clone contract address is displayed
   - A "View on Explorer" link appears
   - A "Share Duel" button appears
   - **If using Player A's wallet:** The transaction should succeed (the factory has funds)

### What indicates a problem:
- Transaction fails with "insufficient funds" — your wallet doesn't have enough STT
- Transaction fails with "execution reverted" — the factory may be out of funds, or the market address is invalid
- No market sentiment bar loads — DreamDEX GraphQL is unreachable
- Timer shows 0:00 — the current interval has expired; wait for the next one

---

## 4. Arena

### Step 1: Navigate to Arena

1. Click **"Arena"** in the top navigation
2. **Expected:** You see two sections:

**System-Generated "Suggested" Challenges (top):**
- Cards with a **dashed teal border**
- Badge says **"Next Window"** (teal) or **"Closing Soon"** (yellow)
- Shows the asset (BTC/ETH), strike price, suggested stake
- Text says "Pick a side when you accept"
- A countdown timer showing time until expiry
- These never show a pre-selected side — you pick when you accept

**Real Duels (below):**
- Cards with solid borders
- Show the creator's address, stake amount, and status
- Status badges: "Open" (teal), "Locked" (yellow), "Settled" (green)

### Step 2: Verify Arena is Never Empty

1. Refresh the page
2. There should always be at least one system-generated challenge visible
3. **If the Arena looks completely empty:** The `autoPopulate` module isn't fetching DreamDEX markets. Check the browser console for GraphQL errors.

### How to tell system challenges apart from real ones:
- **System challenges:** Dashed border, "Pick a side when you accept" text, no player address shown, teal "Next Window" or yellow "Closing Soon" badge
- **Real duels:** Solid border, player address shown, specific status badge

---

## 5. Share + Accept (Needs Two Wallets)

### Step 1: Get the Shareable Link

1. After creating a duel (from Step 3), you should be on the success screen
2. Click **"Copy Link"** or **"Share Duel"**
3. The link format is: `http://localhost:3000/duel/{clone_address}`
4. Copy this link

### Step 2: Open in Second Wallet

1. Open a **new browser window** (or use a different browser/profile)
2. Import Wallet B (`0x5E2D...9cE6`) into MetaMask
3. Make sure you're on Somnia Testnet
4. Paste the duel link into the address bar
5. **Expected:** You see the duel page with:
   - Player A's address shown
   - Stake amount displayed
   - Status: "Open"
   - A countdown timer showing time remaining to join
   - A **"Join Duel"** button

### Step 3: Accept the Challenge

1. Click **"Join Duel"**
2. **Expected:**
   - Your wallet pops up with a transaction prompt
   - This is a `join` call on the Wager contract
   - You need to confirm the transaction
3. **After confirmation:**
   - The status changes from "Open" to "Locked"
   - The page may refresh or update automatically
   - Both players are now committed

### What indicates a problem:
- "Join Duel" button is grayed out — the join deadline has passed
- Transaction fails — you may not have enough STT for the stake + gas
- Page shows "Duel not found" — the clone address in the URL is wrong

---

## 6. Live Duel Screen

### Step 1: View the Live Duel

1. After both players have joined, navigate to the duel page (or refresh it)
2. **Expected to see:**
   - **Live Price:** The current BTC/ETH price, updating in real time
   - **Strike Price:** The price at which the market resolves
   - **Countdown:** Time remaining until market expiry (the resolve countdown)
   - **"Who's winning" indicator:** Shows "▲ UP is winning" or "▼ DOWN is winning" based on whether the current price is above or below the strike
   - **DreamDEX Market Sentiment bar:** The live order book depth (same as on the create page)
   - **Settlement Latency:** After settlement, shows "Auto-settled in Xs" (see Step 7)

### Step 2: Verify Live Data

1. Watch the price for 30 seconds
2. **How to confirm it's real:** The price should change slightly every few seconds. If it's static, the live price feed is broken.
3. **Cross-check:** Open DreamDEX's own UI in another tab and compare the price. They should be very close (within a few dollars for BTC).

### What indicates a problem:
- Price shows as 0 or NaN — the live price hook is failing
- Sentiment bar doesn't load — DreamDEX GraphQL is unreachable
- Countdown is stuck at 0:00 — the market has already expired

---

## 7. Resolution + Auto-Settlement

### Step 1: Wait for Market Expiry

1. Keep the duel page open
2. Wait for the countdown to reach 0:00
3. **Expected:** Nothing happens immediately — the market needs to resolve first (usually within 1-2 minutes after expiry)

### Step 2: Watch for Auto-Settlement

1. After the DreamDEX market resolves, the reactivity precompile triggers automatically
2. **Expected (NO manual action):**
   - The page status changes from "Locked" to "Settled"
   - A green "Duel Settled" banner appears
   - The settlement latency counter shows: **"Auto-settled in Xs (market → settlement)"**
   - The counter is color-coded:
     - **Green (≤5s):** Fast, normal
     - **Yellow (6-10s):** Medium, still good
     - **Gray (>10s):** Slow, unusual
3. **What a normal latency looks like:** 2-5 seconds is typical. Our tests showed 2 seconds consistently.

### Step 3: Verify the Oracle Link

1. On the settled duel page, look for **"Resolution verified by DreamDEX Oracle"**
2. You should see:
   - A teal badge with "Resolution verified by DreamDEX Oracle"
   - An **"Verify Resolution"** button/link
   - The Oracle ID displayed below
3. Click **"Verify Resolution"**
4. **Expected:** A new tab opens to `https://prd.oracle.somnia.host/questions/{oracleQuestionId}?view=graph`
5. **What it shows:**
   - The oracle question details
   - The resolution source (price data used)
   - A graph showing how the outcome was determined
   - Individual receipts from the oracle providers

### What indicates a problem:
- Status stays "Locked" after 5+ minutes — the market may not have resolved yet, or the reactivity subscription failed
- No "Verify Resolution" link — the `oracleQuestionId` wasn't fetched from DreamDEX
- Oracle explorer shows "Question not found" — the oracleQuestionId is invalid

---

## 8. Payout + Fees

### Step 1: Check the Winner's Wallet

1. After settlement, switch to the **winner's wallet** (whichever side won)
2. **Expected:** The wallet balance has increased
3. The winner receives: `(stake × 2) - (stake × 2 × 0.025)` = stake × 1.95
   - Example: If stake was 1 STT, winner gets 1.95 STT
   - The 0.05 STT (2.5% fee) goes to the fee recipient

### Step 2: Verify on Block Explorer

1. Open [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network)
2. Search for the **winner's wallet address**
3. Look at the recent transactions
4. **Expected:** You see an incoming transfer matching the payout amount

### Step 3: Verify Fee Arrived at Fee Recipient

1. On the block explorer, search for the fee recipient address:
   ```
   0x25265b9dBEb6c653b0CA281110Bb0697a9685107
   ```
2. **Expected:** You see an incoming transfer of 2.5% of the total pot
   - Example: If pot was 2 STT, fee recipient got 0.05 STT

### What indicates a problem:
- Winner's balance didn't change — settlement may have failed silently
- Fee recipient has no new transactions — the `settle()` function may not have called `payOut()` correctly
- Wrong amounts — the fee calculation may be off (should be exactly 2.5%)

---

## 9. Profile Update

### Step 1: Check Winner's Profile

1. Navigate to the winner's profile: `http://localhost:3000/u/{winner_address}`
2. **Expected:**
   - **Wins:** 1
   - **Losses:** 0
   - **Win Rate:** 100%
   - **Biggest Win:** The stake amount (e.g., 1 STT)
   - **Total Duels:** 1
   - **Current Streak:** 1W

### Step 2: Check Loser's Profile

1. Navigate to the loser's profile: `http://localhost:3000/u/{loser_address}`
2. **Expected:**
   - **Wins:** 0
   - **Losses:** 1
   - **Win Rate:** 0%
   - **Biggest Win:** 0 STT
   - **Total Duels:** 1
   - **Current Streak:** 1L

### What indicates a problem:
- Wins/Losses still show 0 — the on-chain event parsing hasn't picked up the settlement yet
- Win Rate shows NaN — no completed duels exist yet

---

## 10. Portfolio

### Before Creating a Duel

1. Navigate to **"Portfolio"** in the top navigation
2. **Expected:** Three tabs: Active, Pending, Past
3. All tabs should show count "0" and empty state messages:
   - Active: "No active duels. Join one from the Arena."
   - Pending: "No pending duels. Create one to get started."
   - Past: "No past duels yet."

### After Creating a Duel (Before Someone Joins)

1. Go to Portfolio
2. **Pending tab** should show count "1"
3. Click **"Pending"** — you should see your created duel with:
   - Status: "Open"
   - A countdown timer showing join deadline
   - "You created" label

### After Someone Joins (During Live Duel)

1. Go to Portfolio
2. **Active tab** should show count "1"
3. Click **"Active"** — you should see the duel with:
   - Status: "Locked"
   - A countdown timer showing resolve time
   - Teal highlight border

### After Settlement

1. Go to Portfolio
2. **Past tab** should show count "1"
3. Click **"Past"** — you should see the settled duel with:
   - Status: "Settled"
   - A "Settled" badge
   - The stake amount displayed
   - Clicking it navigates to the duel detail page

### What indicates a problem:
- Duel doesn't appear in the correct tab — the state filtering logic is wrong
- Count doesn't update after creating/joining — the event listener isn't catching new events

---

## Quick Checklist

Use this to verify the full flow works:

- [ ] Wallet A connects successfully
- [ ] Wallet A sees profile with 0 wins / 0 losses
- [ ] Wallet A creates a duel (transaction succeeds)
- [ ] Duel appears in Arena with "Open" status
- [ ] Duel appears in Wallet A's Portfolio under "Pending"
- [ ] Wallet B opens the duel link and sees the challenge
- [ ] Wallet B joins the duel (transaction succeeds)
- [ ] Duel moves to "Active" in both portfolios
- [ ] Live duel shows real-time price, strike, countdown, sentiment
- [ ] Market resolves and auto-settlement triggers (2-5s latency)
- [ ] "Verify Resolution" link opens DreamDEX oracle explorer
- [ ] Winner's wallet balance increases
- [ ] Fee recipient receives 2.5% fee
- [ ] Winner's profile shows 1 win, 100% win rate
- [ ] Loser's profile shows 1 loss, 0% win rate
- [ ] Duel moves to "Past" in both portfolios

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|--------------|-----|
| "Connect Wallet" button doesn't work | Wallet extension not installed | Install MetaMask or another EVM wallet |
| Transaction fails with "insufficient funds" | Not enough STT | Get STT from [faucet.somnia.network](https://faucet.somnia.network) |
| No system challenges in Arena | DreamDEX GraphQL unreachable | Check browser console for network errors |
| Live price shows 0 | Price feed not connected | Check `useLivePrices` hook in browser console |
| Auto-settlement doesn't trigger | Subscription failed or market didn't resolve | Check `settlementTriggeredAt` on the contract via block explorer |
| Profile shows wrong stats | Event parsing issue | Check `useDuelCreatedEvents` hook in browser console |
| "Verify Resolution" link missing | `oracleQuestionId` not fetched | Check DreamDEX GraphQL response in browser console |
