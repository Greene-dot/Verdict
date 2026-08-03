/**
 * Verdict backend, minimal Express API.
 *
 * This handles everything that should not live on chain: market
 * metadata, feed ranking, comments, notifications, and the admin
 * resolution queue described in the MVP plan. Bet settlement itself
 * happens in the Clarity contracts; this server just mirrors chain
 * state for fast reads and holds the off chain social layer.
 *
 * Swap the in memory arrays for real Supabase calls once you wire
 * up a project. The route shapes below match the schema in
 * schema.sql, so the swap should be mechanical.
 */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// In memory store, replace with Supabase client calls.
const db = {
  markets: [],
  bets: [],
  disputes: [],
};

/* ---------------------------------------------------------
   Markets
--------------------------------------------------------- */

// List markets, optionally filtered by category.
app.get("/api/markets", (req, res) => {
  const { category } = req.query;
  const results = category && category !== "All"
    ? db.markets.filter((m) => m.category === category)
    : db.markets;
  res.json(results);
});

// Create a market. Real deployments should also call the
// market-factory contract here and store the returned tx id.
app.post("/api/markets", (req, res) => {
  const { title, rule, category, closes, creatorAddress } = req.body;
  if (!title || !closes || !creatorAddress) {
    return res.status(400).json({ error: "title, closes, and creatorAddress are required" });
  }
  const market = {
    id: `m_${Date.now()}`,
    title,
    rule: rule || "",
    category: category || "Friends",
    closes,
    creatorAddress,
    status: "open",
    yesPool: 0,
    noPool: 0,
    participants: 0,
    createdAt: new Date().toISOString(),
    onChainTxId: null, // fill in once the factory contract call confirms
  };
  db.markets.push(market);
  res.status(201).json(market);
});

// Fetch one market with its bet history.
app.get("/api/markets/:id", (req, res) => {
  const market = db.markets.find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: "market not found" });
  const marketBets = db.bets.filter((b) => b.marketId === market.id);
  res.json({ ...market, bets: marketBets });
});

/* ---------------------------------------------------------
   Bets
--------------------------------------------------------- */

// Record a bet after the on chain transaction confirms.
// The frontend should call the Clarity contract directly with
// Stacks.js, wait for confirmation, then hit this endpoint with
// the resulting txId so the feed and pools update.
app.post("/api/markets/:id/bets", (req, res) => {
  const market = db.markets.find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: "market not found" });
  if (market.status !== "open") return res.status(400).json({ error: "market is closed" });

  const { side, amount, bettorAddress, txId } = req.body;
  if (!["yes", "no"].includes(side) || !amount || !bettorAddress || !txId) {
    return res.status(400).json({ error: "side, amount, bettorAddress, and txId are required" });
  }

  const bet = {
    id: `b_${Date.now()}`,
    marketId: market.id,
    side,
    amount,
    bettorAddress,
    txId,
    createdAt: new Date().toISOString(),
  };
  db.bets.push(bet);

  if (side === "yes") market.yesPool += amount;
  else market.noPool += amount;
  market.participants += 1;

  res.status(201).json(bet);
});

/* ---------------------------------------------------------
   Resolution and disputes
--------------------------------------------------------- */

// Admin resolves a market. In production, gate this behind an
// auth check that confirms the caller is on the trusted resolver
// list, then submit the outcome to the resolution contract before
// writing it here.
app.post("/api/markets/:id/resolve", (req, res) => {
  const market = db.markets.find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: "market not found" });

  const { outcome, resolverAddress, evidenceUrl } = req.body;
  if (!["yes", "no"].includes(outcome) || !resolverAddress) {
    return res.status(400).json({ error: "outcome and resolverAddress are required" });
  }

  market.status = "resolved";
  market.outcome = outcome;
  market.resolvedBy = resolverAddress;
  market.evidenceUrl = evidenceUrl || null;
  market.resolvedAt = new Date().toISOString();
  market.disputeWindowCloses = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  res.json(market);
});

// A user disputes a resolution within the window.
app.post("/api/markets/:id/dispute", (req, res) => {
  const market = db.markets.find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: "market not found" });
  if (market.status !== "resolved") return res.status(400).json({ error: "market has no resolution to dispute" });
  if (new Date() > new Date(market.disputeWindowCloses)) {
    return res.status(400).json({ error: "dispute window has closed" });
  }

  const { disputerAddress, reason } = req.body;
  const dispute = {
    id: `d_${Date.now()}`,
    marketId: market.id,
    disputerAddress,
    reason,
    createdAt: new Date().toISOString(),
  };
  db.disputes.push(dispute);
  market.status = "disputed";

  res.status(201).json(dispute);
});

/* ---------------------------------------------------------
   Leaderboard
--------------------------------------------------------- */

app.get("/api/leaderboard", (req, res) => {
  const totals = {};
  for (const bet of db.bets) {
    totals[bet.bettorAddress] = totals[bet.bettorAddress] || { volume: 0, wins: 0, total: 0 };
    totals[bet.bettorAddress].volume += bet.amount;
  }
  for (const market of db.markets.filter((m) => m.status === "resolved")) {
    for (const bet of db.bets.filter((b) => b.marketId === market.id)) {
      totals[bet.bettorAddress].total += 1;
      if (bet.side === market.outcome) totals[bet.bettorAddress].wins += 1;
    }
  }
  const leaderboard = Object.entries(totals)
    .map(([address, stats]) => ({
      address,
      volume: stats.volume,
      winRate: stats.total ? Math.round((stats.wins / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate);

  res.json(leaderboard);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Verdict API listening on port ${PORT}`));
