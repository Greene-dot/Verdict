# Verdict

A social prediction market for relationship and gossip calls, built on
the Stacks ecosystem.

## Structure

- `frontend/` — Vite and React app. Wallet connect and contract calls
  live in `frontend/src/lib/stacks.js`.
- `backend/server.js` — Express API mirroring on chain state, plus the
  social layer (comments, disputes, leaderboard).
- `backend/schema.sql` — Supabase schema matching the API's shape.
- `backend/contracts/market-pool.clar` — the Clarity contract holding
  stakes and paying out the winning side.
- `backend/clarinet/` — Clarinet project for testing the contract
  before any deploy.
- `render.yaml` — one click Render deploy config for the backend.

## Before this handles real funds

- Get the Clarinet tests passing and get a second set of eyes on
  `market-pool.clar`.
- Deploy the contract to testnet, then paste the resulting address
  into `CONTRACT_ADDRESS` in `frontend/src/lib/stacks.js`.
- Swap the in memory arrays in `server.js` for real Supabase calls.
- Write real terms of service and an age gate before real bets go live.
