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
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// File backed store. This survives normal restarts of a long running
// process, but Render's free tier wipes the disk on redeploys and on
// the periodic spin down that happens after inactivity. Treat this as
// a bridge, not a real answer, swap it for Supabase calls (see
// schema.sql) once you want data that survives a redeploy for sure.
const DB_FILE = path.join(__dirname, "db.json");

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  }
  // Seed data so the feed isn't empty on a fresh deploy.
  return {
    markets: [
      {
        id: "m_seed_1",
        title: "Will I eat this night",
        rule: "Resolves YES if the creator posts proof of a meal before midnight in their timezone.",
        category: "Friends",
        closes: "2026-08-07T23:59:00",
        creatorAddress: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQ9H6DPR",
        status: "open",
        yesPool: 10,
        noPool: 35,
        participants: 2,
        createdAt: new Date().toISOString(),
        onChainTxId: null,
      },
      {
        id: "m_seed_2",
        title: "Do Tolu and Kemzy make it past their anniversary post?",
        rule: "Resolves YES if both accounts remain mutually following and no breakup statement is posted by either party before the close date.",
        category: "Influencers",
        closes: "2026-08-14T00:00:00",
        creatorAddress: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQ9H6DPR",
        status: "open",
        yesPool: 4820,
        noPool: 3110,
        participants: 214,
        createdAt: new Date().toISOString(),
        onChainTxId: null,
      },
    ],
    bets: [],
    disputes: [],
    subscribers: [],
  };
}

const db = loadDb();
db.subscribers = db.subscribers || [];

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

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
  saveDb();
  res.status(201).json(market);
});

// Fetch one market with its bet history.
app.get("/api/markets/:id", (req, res) => {
  const market = db.markets.find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: "market not found" });
  const marketBets = db.bets.filter((b) => b.marketId === market.id);
  res.json({ ...market, bets: marketBets });
});

// Edit a market. Only the original creator can edit, and only
// while the market is still open, editing a market that already
// has bets against it would be unfair to whoever already staked.
app.patch("/api/markets/:id", (req, res) => {
  const market = db.markets.find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: "market not found" });

  const { editorAddress, title, rule, category, closes } = req.body;
  if (!editorAddress) return res.status(400).json({ error: "editorAddress is required" });
  if (editorAddress !== market.creatorAddress) {
    return res.status(403).json({ error: "only the creator can edit this market" });
  }
  if (market.status !== "open") {
    return res.status(400).json({ error: "only an open market can be edited" });
  }
  const hasBets = db.bets.some((b) => b.marketId === market.id);
  if (hasBets) {
    return res.status(400).json({ error: "this market already has bets against it and can no longer be edited" });
  }

  if (title) market.title = title;
  if (rule !== undefined) market.rule = rule;
  if (category) market.category = category;
  if (closes) market.closes = closes;

  saveDb();
  res.json(market);
});

// Delete a market. Same guard rails as editing: creator only,
// and only before anyone has staked on it. Once bets exist the
// market should be cancelled through resolution instead, so
// stakers get their funds back rather than the market vanishing.
app.delete("/api/markets/:id", (req, res) => {
  const market = db.markets.find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: "market not found" });

  const { editorAddress } = req.body;
  if (!editorAddress) return res.status(400).json({ error: "editorAddress is required" });
  if (editorAddress !== market.creatorAddress) {
    return res.status(403).json({ error: "only the creator can delete this market" });
  }
  const hasBets = db.bets.some((b) => b.marketId === market.id);
  if (hasBets) {
    return res.status(400).json({ error: "this market already has bets against it, cancel it instead of deleting" });
  }

  db.markets = db.markets.filter((m) => m.id !== market.id);
  saveDb();
  res.status(204).send();
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

  saveDb();
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

  saveDb();
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

  saveDb();
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

/* ---------------------------------------------------------
   Email signup
--------------------------------------------------------- */

app.post("/api/subscribe", (req, res) => {
  const { email } = req.body;
  const valid = typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) return res.status(400).json({ error: "a valid email is required" });

  const already = db.subscribers.some((s) => s.email.toLowerCase() === email.toLowerCase());
  if (!already) {
    db.subscribers.push({ email, subscribedAt: new Date().toISOString() });
    saveDb();
  }
  res.status(201).json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Verdict API listening on port ${PORT}`));
