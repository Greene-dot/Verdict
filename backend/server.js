/**
 * Verdict backend, now backed by Supabase Postgres instead of a
 * local file. This is the actual fix for markets disappearing,
 * data written here survives redeploys and spin downs, since it
 * lives in a real database, not the container's disk.
 *
 * Requires two environment variables set on Render:
 *   SUPABASE_URL       your project URL
 *   SUPABASE_ANON_KEY   your project's anon public key
 *
 * The API shape returned to the frontend is unchanged from the
 * old file backed version, camelCase fields like yesPool and
 * creatorAddress, so nothing in App.jsx needs to change.
 */

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// The markets, bets, and disputes tables all have a foreign key
// pointing at users(address). Nothing else in this app creates a
// user row on its own, so every insert that references a wallet
// address needs to make sure that address exists first.
async function ensureUser(address) {
  if (!address) return;
  await supabase.from("users").upsert({ address }, { onConflict: "address", ignoreDuplicates: true });
}

/* ---------------------------------------------------------
   Mapping helpers. The database uses snake_case columns,
   the API keeps the camelCase shape the frontend already
   expects, so nothing downstream has to change.
--------------------------------------------------------- */
function toMarketJson(row) {
  return {
    id: row.id,
    title: row.title,
    rule: row.rule,
    category: row.category,
    closes: row.closes,
    creatorAddress: row.creator_address,
    status: row.status,
    outcome: row.outcome,
    yesPool: row.yes_pool,
    noPool: row.no_pool,
    participants: row.participants,
    onChainTxId: row.on_chain_tx_id,
    resolvedBy: row.resolved_by,
    evidenceUrl: row.evidence_url,
    resolvedAt: row.resolved_at,
    disputeWindowCloses: row.dispute_window_closes,
    createdAt: row.created_at,
  };
}

function toBetJson(row) {
  return {
    id: row.id,
    marketId: row.market_id,
    side: row.side,
    amount: row.amount,
    bettorAddress: row.bettor_address,
    txId: row.tx_id,
    createdAt: row.created_at,
  };
}

/* ---------------------------------------------------------
   Markets
--------------------------------------------------------- */

app.get("/api/markets", async (req, res) => {
  const { category } = req.query;
  let query = supabase.from("markets").select("*").order("created_at", { ascending: false });
  if (category && category !== "All") query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toMarketJson));
});

app.post("/api/markets", async (req, res) => {
  const { title, rule, category, closes, creatorAddress } = req.body;
  if (!title || !closes || !creatorAddress) {
    return res.status(400).json({ error: "title, closes, and creatorAddress are required" });
  }

  await ensureUser(creatorAddress);

  const market = {
    id: `m_${Date.now()}`,
    title,
    rule: rule || "",
    category: category || "Friends",
    closes,
    creator_address: creatorAddress,
    status: "open",
    yes_pool: 0,
    no_pool: 0,
    participants: 0,
  };

  const { data, error } = await supabase.from("markets").insert(market).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(toMarketJson(data));
});

app.get("/api/markets/:id", async (req, res) => {
  const { data: market, error } = await supabase.from("markets").select("*").eq("id", req.params.id).single();
  if (error || !market) return res.status(404).json({ error: "market not found" });

  const { data: bets } = await supabase.from("bets").select("*").eq("market_id", market.id);
  res.json({ ...toMarketJson(market), bets: (bets || []).map(toBetJson) });
});

app.patch("/api/markets/:id", async (req, res) => {
  const { data: market, error: fetchErr } = await supabase.from("markets").select("*").eq("id", req.params.id).single();
  if (fetchErr || !market) return res.status(404).json({ error: "market not found" });

  const { editorAddress, title, rule, category, closes } = req.body;
  if (!editorAddress) return res.status(400).json({ error: "editorAddress is required" });
  if (editorAddress !== market.creator_address) {
    return res.status(403).json({ error: "only the creator can edit this market" });
  }
  if (market.status !== "open") {
    return res.status(400).json({ error: "only an open market can be edited" });
  }

  const { count } = await supabase.from("bets").select("id", { count: "exact", head: true }).eq("market_id", market.id);
  if (count > 0) {
    return res.status(400).json({ error: "this market already has bets against it and can no longer be edited" });
  }

  const updates = {};
  if (title) updates.title = title;
  if (rule !== undefined) updates.rule = rule;
  if (category) updates.category = category;
  if (closes) updates.closes = closes;

  const { data, error } = await supabase.from("markets").update(updates).eq("id", market.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(toMarketJson(data));
});

app.delete("/api/markets/:id", async (req, res) => {
  const { data: market, error: fetchErr } = await supabase.from("markets").select("*").eq("id", req.params.id).single();
  if (fetchErr || !market) return res.status(404).json({ error: "market not found" });

  const { editorAddress } = req.body;
  if (!editorAddress) return res.status(400).json({ error: "editorAddress is required" });
  if (editorAddress !== market.creator_address) {
    return res.status(403).json({ error: "only the creator can delete this market" });
  }

  const { count } = await supabase.from("bets").select("id", { count: "exact", head: true }).eq("market_id", market.id);
  if (count > 0) {
    return res.status(400).json({ error: "this market already has bets against it, cancel it instead of deleting" });
  }

  const { error } = await supabase.from("markets").delete().eq("id", market.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

/* ---------------------------------------------------------
   Bets
--------------------------------------------------------- */

app.post("/api/markets/:id/bets", async (req, res) => {
  const { data: market, error: fetchErr } = await supabase.from("markets").select("*").eq("id", req.params.id).single();
  if (fetchErr || !market) return res.status(404).json({ error: "market not found" });
  if (market.status !== "open") return res.status(400).json({ error: "market is closed" });

  const { side, amount, bettorAddress, txId } = req.body;
  if (!["yes", "no"].includes(side) || !amount || !bettorAddress || !txId) {
    return res.status(400).json({ error: "side, amount, bettorAddress, and txId are required" });
  }

  await ensureUser(bettorAddress);

  const { data: bet, error: betErr } = await supabase
    .from("bets")
    .insert({ id: `b_${Date.now()}`, market_id: market.id, side, amount, bettor_address: bettorAddress, tx_id: txId })
    .select()
    .single();
  if (betErr) return res.status(500).json({ error: betErr.message });

  // Read-then-write pool update. Fine at this scale, worth
  // moving to a Postgres function with an atomic increment if
  // concurrent bets on the same market ever become common.
  const updates = {
    participants: market.participants + 1,
    ...(side === "yes" ? { yes_pool: market.yes_pool + amount } : { no_pool: market.no_pool + amount }),
  };
  await supabase.from("markets").update(updates).eq("id", market.id);

  res.status(201).json(toBetJson(bet));
});

/* ---------------------------------------------------------
   Resolution and disputes
--------------------------------------------------------- */

app.post("/api/markets/:id/resolve", async (req, res) => {
  const { data: market, error: fetchErr } = await supabase.from("markets").select("*").eq("id", req.params.id).single();
  if (fetchErr || !market) return res.status(404).json({ error: "market not found" });

  const { outcome, resolverAddress, evidenceUrl } = req.body;
  if (!["yes", "no"].includes(outcome) || !resolverAddress) {
    return res.status(400).json({ error: "outcome and resolverAddress are required" });
  }

  await ensureUser(resolverAddress);

  const updates = {
    status: "resolved",
    outcome,
    resolved_by: resolverAddress,
    evidence_url: evidenceUrl || null,
    resolved_at: new Date().toISOString(),
    dispute_window_closes: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  };

  const { data, error } = await supabase.from("markets").update(updates).eq("id", market.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(toMarketJson(data));
});

app.post("/api/markets/:id/dispute", async (req, res) => {
  const { data: market, error: fetchErr } = await supabase.from("markets").select("*").eq("id", req.params.id).single();
  if (fetchErr || !market) return res.status(404).json({ error: "market not found" });
  if (market.status !== "resolved") return res.status(400).json({ error: "market has no resolution to dispute" });
  if (new Date() > new Date(market.dispute_window_closes)) {
    return res.status(400).json({ error: "dispute window has closed" });
  }

  const { disputerAddress, reason } = req.body;
  await ensureUser(disputerAddress);

  const { data: dispute, error } = await supabase
    .from("disputes")
    .insert({ id: `d_${Date.now()}`, market_id: market.id, disputer_address: disputerAddress, reason })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from("markets").update({ status: "disputed" }).eq("id", market.id);
  res.status(201).json(dispute);
});

/* ---------------------------------------------------------
   Leaderboard
--------------------------------------------------------- */

app.get("/api/leaderboard", async (req, res) => {
  const { data: resolvedMarkets } = await supabase.from("markets").select("id, outcome").eq("status", "resolved");
  const { data: bets } = await supabase.from("bets").select("bettor_address, side, amount, market_id");

  const totals = {};
  for (const bet of bets || []) {
    totals[bet.bettor_address] = totals[bet.bettor_address] || { volume: 0, wins: 0, total: 0 };
    totals[bet.bettor_address].volume += bet.amount;
  }
  const outcomeByMarket = Object.fromEntries((resolvedMarkets || []).map((m) => [m.id, m.outcome]));
  for (const bet of bets || []) {
    const outcome = outcomeByMarket[bet.market_id];
    if (!outcome) continue;
    totals[bet.bettor_address].total += 1;
    if (bet.side === outcome) totals[bet.bettor_address].wins += 1;
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

app.post("/api/subscribe", async (req, res) => {
  const { email } = req.body;
  const valid = typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) return res.status(400).json({ error: "a valid email is required" });

  const { error } = await supabase.from("subscribers").upsert({ email }, { onConflict: "email" });
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Verdict API listening on port ${PORT}`));
