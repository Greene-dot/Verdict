-- Verdict Supabase schema
-- Off chain mirror of on chain market state, plus the social layer.

create table users (
  address text primary key,
  bns_name text,
  trust_score integer default 50,
  created_at timestamptz default now()
);

create table markets (
  id text primary key,
  title text not null,
  rule text,
  category text not null default 'Friends',
  closes timestamptz not null,
  creator_address text references users(address),
  status text not null default 'open', -- open, resolved, disputed, cancelled
  outcome text, -- yes, no, null until resolved
  yes_pool bigint not null default 0,
  no_pool bigint not null default 0,
  participants integer not null default 0,
  on_chain_tx_id text,
  resolved_by text references users(address),
  evidence_url text,
  resolved_at timestamptz,
  dispute_window_closes timestamptz,
  created_at timestamptz default now()
);

create table bets (
  id text primary key,
  market_id text references markets(id) not null,
  bettor_address text references users(address) not null,
  side text not null check (side in ('yes', 'no')),
  amount bigint not null,
  tx_id text not null,
  created_at timestamptz default now()
);

create table disputes (
  id text primary key,
  market_id text references markets(id) not null,
  disputer_address text references users(address) not null,
  reason text,
  created_at timestamptz default now()
);

create table comments (
  id text primary key,
  market_id text references markets(id) not null,
  author_address text references users(address) not null,
  body text not null,
  created_at timestamptz default now()
);

create index idx_bets_market on bets(market_id);
create index idx_markets_status on markets(status);
create index idx_markets_category on markets(category);
