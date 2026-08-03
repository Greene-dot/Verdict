import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import {
  Wallet, Clock, Flame, Trophy, User, ChevronLeft,
  ShieldCheck, Search, Plus, AlertCircle, X, Radio,
  Trash2, Pencil, Loader2, CheckCircle2
} from "lucide-react";

/* ---------------------------------------------------------
   Fonts. Space Grotesk for display, JetBrains Mono for every
   number so odds still read like a ticker against the soft
   background.
--------------------------------------------------------- */
function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

/* ---------------------------------------------------------
   Palette tokens. Lilac wash base, mint for the primary
   action, peach for warmth, cyan for the opposing side,
   violet for labels, navy for every line of text.
--------------------------------------------------------- */
const COLOR = {
  bg: "#EFE9FB",
  card: "#FFFFFF",
  border: "#221B33",
  navy: "#221B33",
  muted: "#6B6480",
  mint: "#B6F35A",
  peach: "#F7C99C",
  cyan: "#7FE0D6",
  violet: "#6B46C1",
};

const CATEGORIES = ["All", "Friends", "Influencers", "Rapid"];
const STORAGE_KEY = "verdict:state";

/* ---------------------------------------------------------
   Local, timezone safe date helpers. Everything below reads
   and writes plain "YYYY-MM-DDTHH:MM[:SS]" strings in the
   viewer's own local time, so a close date typed in never
   drifts across a UTC round trip. That drift was the source
   of markets reading "closed" the moment they were created.
--------------------------------------------------------- */
function pad(n) {
  return String(n).padStart(2, "0");
}
function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function toLocalStamp(date) {
  return `${toLocalInputValue(date)}:${pad(date.getSeconds())}`;
}
function isClosed(closes) {
  const t = new Date(closes).getTime();
  return Number.isFinite(t) ? t <= Date.now() : false;
}
function isRapid(closes) {
  const diff = new Date(closes).getTime() - Date.now();
  return diff > 0 && diff < 1000 * 60 * 60 * 24;
}

/* Demo markets are seeded relative to whenever the app first
   loads, so they always start in the future instead of going
   stale the moment real time catches up to a hardcoded date. */
function seedMarkets() {
  const now = Date.now();
  const inHours = (h) => toLocalStamp(new Date(now + h * 3600000));
  const inDays = (d) => toLocalStamp(new Date(now + d * 86400000));
  return [
    {
      id: "m1",
      category: "Influencers",
      title: "Do Tolu and Kemzy make it past their anniversary post?",
      rule: "Resolves YES if both accounts remain mutually following and no breakup statement is posted by either party before the close date.",
      closes: inDays(11),
      rapid: false,
      yesPool: 4820,
      noPool: 3110,
      participants: 214,
    },
    {
      id: "m2",
      category: "Rapid",
      title: "Will Zandyor address the group chat leak live tonight?",
      rule: "Resolves YES if a public statement is made on stream within the window.",
      closes: inHours(6),
      rapid: true,
      yesPool: 1920,
      noPool: 2760,
      participants: 88,
    },
    {
      id: "m3",
      category: "Friends",
      title: "Are Dara and Bisi still roommates by move out season?",
      rule: "Resolves YES if both remain listed on the same lease as of the close date, confirmed by either party.",
      closes: inDays(29),
      rapid: false,
      yesPool: 990,
      noPool: 1410,
      participants: 63,
    },
    {
      id: "m4",
      category: "Influencers",
      title: "Does the podcast duo announce a solo split this quarter?",
      rule: "Resolves YES if either host confirms departure from the shared show before the close date.",
      closes: inDays(58),
      rapid: false,
      yesPool: 3040,
      noPool: 3980,
      participants: 176,
    },
  ];
}

const LEADERBOARD = [
  { rank: 1, name: "zandyor.btc", winRate: 78, volume: 12400 },
  { rank: 2, name: "mukhy.btc", winRate: 71, volume: 9800 },
  { rank: 3, name: "adaeze.btc", winRate: 69, volume: 8850 },
  { rank: 4, name: "bstacks.btc", winRate: 64, volume: 7200 },
];

const DEFAULT_WALLET = { connected: false, address: "", balance: 0, mode: "" };

const fmt = (n) => n.toLocaleString("en-US");

/* ---------------------------------------------------------
   Scroll reveal, unchanged in spirit, just a light touch.
--------------------------------------------------------- */
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

/* ---------------------------------------------------------
   Verdict Orb, recolored for the light theme. Mint shell
   against a violet core, both read clearly on white.
--------------------------------------------------------- */
function VerdictOrb({ yesPercent }) {
  const mountRef = useRef(null);
  const meshRefs = useRef({});

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const outerGeo = new THREE.IcosahedronGeometry(1.35, 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x6b46c1,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    scene.add(outer);

    const innerGeo = new THREE.IcosahedronGeometry(0.92, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x2f9e8f,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    scene.add(inner);

    meshRefs.current = { outer, inner };

    let frameId;
    const animate = () => {
      outer.rotation.y += 0.0035;
      outer.rotation.x += 0.0012;
      inner.rotation.y -= 0.006;
      inner.rotation.x -= 0.002;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      outerGeo.dispose();
      innerGeo.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const { outer, inner } = meshRefs.current;
    if (!outer || !inner) return;
    outer.scale.setScalar(0.85 + (yesPercent / 100) * 0.5);
    inner.scale.setScalar(0.85 + ((100 - yesPercent) / 100) * 0.5);
  }, [yesPercent]);

  return <div ref={mountRef} className="w-full h-64" />;
}

function useCountdown(closes) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(closes).getTime() - Date.now();
      if (!Number.isFinite(diff) || diff <= 0) return setLabel("closed");
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) return setLabel(`${d}d ${h}h`);
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [closes]);
  return label;
}

/* ---------------------------------------------------------
   Wallet connection. Checks for a real injected Stacks
   provider first (Leather or Xverse). If one answers, the
   address returned is real. If none is reachable, which is
   what happens inside this preview sandbox, it falls back
   to a clearly labeled demo session so every screen still
   works end to end.
--------------------------------------------------------- */
function detectProvider() {
  if (typeof window === "undefined") return null;
  return (
    window.LeatherProvider ||
    window.StacksProvider ||
    window.XverseProviders?.StacksProvider ||
    null
  );
}

async function connectWallet() {
  const provider = detectProvider();
  if (provider) {
    try {
      const res = await provider.request("getAddresses");
      const stxAddress =
        res?.result?.addresses?.find((a) => a.symbol === "STX")?.address ||
        res?.addresses?.[0]?.address;
      if (stxAddress) {
        return { address: stxAddress, mode: "live" };
      }
    } catch (err) {
      // Extension present but the user declined or the call failed.
      // Fall through to demo mode below.
    }
  }
  await new Promise((r) => setTimeout(r, 900));
  return { address: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQ9H6DPR", mode: "demo" };
}

function WalletButton({ wallet, onConnect, onDisconnect }) {
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const pick = async () => {
    setConnecting(true);
    setOpen(false);
    const result = await connectWallet();
    onConnect(result);
    setConnecting(false);
  };

  if (wallet.connected) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end leading-none">
          <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: COLOR.navy }}>
            {wallet.mode === "live" ? (
              <>
                <Radio size={11} style={{ color: "#2F9E8F" }} /> live wallet
              </>
            ) : (
              "demo session"
            )}
          </span>
          <span className="text-[11px] font-mono" style={{ color: COLOR.muted }}>
            {fmt(wallet.balance)} sats
          </span>
        </div>
        <button
          onClick={onDisconnect}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-[12px] font-medium transition-colors"
          style={{ border: `2px solid ${COLOR.border}`, color: COLOR.navy, background: COLOR.card }}
        >
          <ShieldCheck size={14} style={{ color: "#2F9E8F" }} />
          {wallet.address.slice(0, 5)}...{wallet.address.slice(-4)}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={connecting}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-transform hover:scale-[1.03] disabled:opacity-60"
        style={{ background: COLOR.mint, color: COLOR.navy, border: `2px solid ${COLOR.border}` }}
      >
        <Wallet size={14} />
        {connecting ? "Connecting..." : "Connect wallet"}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-2xl p-1.5 shadow-lg z-20"
          style={{ background: COLOR.card, border: `2px solid ${COLOR.border}` }}
        >
          {["Leather", "Xverse"].map((p) => (
            <button
              key={p}
              onClick={pick}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-black/5"
              style={{ color: COLOR.navy }}
            >
              {p}
            </button>
          ))}
          <div className="px-3 pt-1.5 pb-1 text-[11px]" style={{ color: COLOR.muted }}>
            Detects a real wallet automatically. Falls back to a demo session if none is reachable.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Market card.
--------------------------------------------------------- */
function MarketCard({ market, onOpen, onDelete, onEditDate, index }) {
  const [ref, visible] = useReveal();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const total = market.yesPool + market.noPool;
  const yesPercent = Math.round((market.yesPool / total) * 100);
  const countdown = useCountdown(market.closes);
  const closed = countdown === "closed";

  return (
    <div
      ref={ref}
      onClick={() => onOpen(market)}
      style={{
        transitionDelay: `${Math.min(index * 60, 300)}ms`,
        background: COLOR.card,
        border: `2.5px solid ${COLOR.border}`,
      }}
      className={`group cursor-pointer rounded-2xl p-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-[4px_4px_0_#221B33] ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[11px] uppercase tracking-wider font-semibold"
          style={{ color: COLOR.violet }}
        >
          {market.category}
        </span>
        <div className="flex items-center gap-2">
          {closed ? (
            <span className="text-[11px] font-mono font-semibold" style={{ color: "#B0433F" }}>
              closed
            </span>
          ) : market.rapid ? (
            <span className="flex items-center gap-1 text-[11px] font-mono font-medium" style={{ color: "#B8860B" }}>
              <Flame size={12} /> {countdown}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: COLOR.muted }}>
              <Clock size={12} /> closes {market.closes.slice(0, 10)}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditDate(market);
            }}
            title="Edit close date"
            className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1"
            style={{ color: COLOR.muted }}
          >
            <Pencil size={13} />
          </button>
          {closed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirmingDelete) {
                  onDelete(market.id);
                } else {
                  setConfirmingDelete(true);
                  setTimeout(() => setConfirmingDelete(false), 2500);
                }
              }}
              title={confirmingDelete ? "Tap again to confirm" : "Delete closed market"}
              className="rounded-full p-1 transition-colors"
              style={{ color: confirmingDelete ? "#B0433F" : COLOR.muted }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <h3 className="text-[15px] leading-snug font-semibold mb-4" style={{ color: COLOR.navy }}>
        {market.title}
      </h3>

      <div className="mb-2 h-2.5 w-full rounded-full overflow-hidden" style={{ background: "#E9E4F7" }}>
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${yesPercent}%`, background: COLOR.mint }}
        />
      </div>
      <div className="flex items-center justify-between font-mono text-[12px]">
        <span style={{ color: "#2F9E8F" }}>YES {yesPercent}%</span>
        <span style={{ color: COLOR.violet }}>NO {100 - yesPercent}%</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px]" style={{ color: COLOR.muted }}>
        <span>{market.participants} predictors</span>
        <span>{fmt(total)} sBTC pooled</span>
      </div>
      {confirmingDelete && (
        <div className="mt-2 text-[11px] font-medium" style={{ color: "#B0433F" }}>
          Tap the trash icon again to delete this market for good.
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Market detail.
--------------------------------------------------------- */
function MarketDetail({ market, wallet, onBack, onBet }) {
  const [side, setSide] = useState("yes");
  const [amount, setAmount] = useState(25);
  const [placing, setPlacing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const total = market.yesPool + market.noPool;
  const yesPercent = Math.round((market.yesPool / total) * 100);
  const countdown = useCountdown(market.closes);
  const closed = countdown === "closed";

  const handlePlace = () => {
    if (!wallet.connected || closed) return;
    setPlacing(true);
    setTimeout(() => {
      setPlacing(false);
      setConfirmed(true);
      onBet(market.id, side, amount);
      setTimeout(() => setConfirmed(false), 2200);
    }, 1300);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm mb-6 transition-colors hover:opacity-70"
        style={{ color: COLOR.muted }}
      >
        <ChevronLeft size={16} /> Back to feed
      </button>

      <div
        className="rounded-3xl overflow-hidden"
        style={{ background: COLOR.card, border: `2.5px solid ${COLOR.border}` }}
      >
        <div style={{ background: "#F3F0FB" }}>
          <VerdictOrb yesPercent={yesPercent} />
        </div>

        <div className="p-6" style={{ borderTop: `2px solid #EFEAF9` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: COLOR.violet }}>
              {market.category}
            </span>
            {closed ? (
              <span className="text-[12px] font-mono font-semibold" style={{ color: "#B0433F" }}>
                closed
              </span>
            ) : market.rapid ? (
              <span className="flex items-center gap-1 text-[12px] font-mono font-medium" style={{ color: "#B8860B" }}>
                <Flame size={13} /> closes in {countdown}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[12px] font-mono" style={{ color: COLOR.muted }}>
                <Clock size={13} /> closes in {countdown}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold mb-3 leading-snug" style={{ color: COLOR.navy }}>
            {market.title}
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: COLOR.muted }}>
            {market.rule}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setSide("yes")}
              className="rounded-2xl p-4 text-left transition-all"
              style={{
                border: `2px solid ${side === "yes" ? "#2F9E8F" : "#E3DEF2"}`,
                background: side === "yes" ? "#E4F9F3" : "transparent",
              }}
            >
              <div className="font-mono text-2xl font-bold" style={{ color: "#2F9E8F" }}>
                {yesPercent}%
              </div>
              <div className="text-sm mt-1" style={{ color: COLOR.navy }}>Bet YES</div>
            </button>
            <button
              onClick={() => setSide("no")}
              className="rounded-2xl p-4 text-left transition-all"
              style={{
                border: `2px solid ${side === "no" ? COLOR.violet : "#E3DEF2"}`,
                background: side === "no" ? "#F0EAFB" : "transparent",
              }}
            >
              <div className="font-mono text-2xl font-bold" style={{ color: COLOR.violet }}>
                {100 - yesPercent}%
              </div>
              <div className="text-sm mt-1" style={{ color: COLOR.navy }}>Bet NO</div>
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2" style={{ color: COLOR.muted }}>
              <span>Stake</span>
              <span className="font-mono" style={{ color: COLOR.navy }}>{amount} sats</span>
            </div>
            <input
              type="range"
              min={5}
              max={500}
              step={5}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-[#2F9E8F]"
            />
          </div>

          {closed && (
            <div className="flex items-center gap-2 text-[13px] mb-4" style={{ color: "#B0433F" }}>
              <AlertCircle size={15} /> This market is closed. Edit its close date from the feed to reopen it.
            </div>
          )}
          {!closed && !wallet.connected && (
            <div className="flex items-center gap-2 text-[13px] mb-4" style={{ color: "#B8860B" }}>
              <AlertCircle size={15} /> Connect a wallet to place this bet.
            </div>
          )}

          <button
            onClick={handlePlace}
            disabled={!wallet.connected || placing || closed}
            className="w-full rounded-2xl py-3.5 font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: COLOR.mint, color: COLOR.navy, border: `2px solid ${COLOR.border}` }}
          >
            {placing ? "Confirming on chain..." : confirmed ? "Bet placed" : `Place ${side.toUpperCase()} bet`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Leaderboard() {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold mb-1" style={{ color: COLOR.navy }}>Top predictors</h2>
      <p className="text-sm mb-6" style={{ color: COLOR.muted }}>
        Ranked by win rate across resolved markets this season.
      </p>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: COLOR.card, border: `2.5px solid ${COLOR.border}` }}
      >
        {LEADERBOARD.map((p, i) => (
          <div
            key={p.rank}
            className="flex items-center gap-4 p-4"
            style={{ borderTop: i === 0 ? "none" : "1px solid #EFEAF9" }}
          >
            <span
              className="w-7 text-center font-mono text-sm font-semibold"
              style={{ color: p.rank === 1 ? "#B8860B" : COLOR.muted }}
            >
              {p.rank}
            </span>
            <div className="flex-1">
              <div className="text-[14px] font-medium" style={{ color: COLOR.navy }}>{p.name}</div>
              <div className="text-[11px] font-mono" style={{ color: COLOR.muted }}>
                {fmt(p.volume)} sats volume
              </div>
            </div>
            <div className="font-mono text-sm font-semibold" style={{ color: "#2F9E8F" }}>
              {p.winRate}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Profile({ wallet, bets, markets }) {
  if (!wallet.connected) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <User size={32} className="mx-auto mb-4" style={{ color: COLOR.muted }} />
        <p className="text-sm" style={{ color: COLOR.muted }}>
          Connect a wallet to see your active bets and track record.
        </p>
      </div>
    );
  }

  const myBets = Object.entries(bets)
    .map(([marketId, b]) => ({
      market: markets.find((m) => m.id === marketId),
      ...b,
    }))
    .filter((b) => b.market);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-14 h-14 rounded-full"
          style={{ background: `linear-gradient(135deg, ${COLOR.mint}, ${COLOR.cyan})`, border: `2px solid ${COLOR.border}` }}
        />
        <div>
          <div className="font-semibold" style={{ color: COLOR.navy }}>
            {wallet.mode === "live" ? "your wallet" : "you.btc (demo)"}
          </div>
          <div className="text-[12px] font-mono" style={{ color: COLOR.muted }}>
            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </div>
        </div>
        <span
          className="ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium"
          style={{ background: "#E4F9F3", color: "#2F9E8F" }}
        >
          <ShieldCheck size={12} /> Trust score 82
        </span>
      </div>

      <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: COLOR.muted }}>
        Active bets
      </h3>
      {myBets.length === 0 ? (
        <p className="text-sm mb-8" style={{ color: COLOR.muted }}>
          No bets placed yet. Head to the feed and back a call.
        </p>
      ) : (
        <div className="space-y-2 mb-8">
          {myBets.map(({ market, side, amount }) => (
            <div
              key={market.id}
              className="flex items-center justify-between rounded-xl p-4"
              style={{ background: COLOR.card, border: `2px solid ${COLOR.border}` }}
            >
              <span className="text-sm truncate pr-4" style={{ color: COLOR.navy }}>{market.title}</span>
              <span
                className="font-mono text-xs whitespace-nowrap font-medium"
                style={{ color: side === "yes" ? "#2F9E8F" : COLOR.violet }}
              >
                {side.toUpperCase()} · {amount} sats
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateMarketModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [rule, setRule] = useState("");
  const [closes, setCloses] = useState("");
  const [category, setCategory] = useState("Friends");
  const [error, setError] = useState("");

  const minValue = toLocalInputValue(new Date());

  const submit = () => {
    if (!title.trim()) return setError("Give the market a question first.");
    if (!closes) return setError("Pick when this market closes.");
    if (new Date(closes).getTime() <= Date.now()) {
      return setError("Closing time has to be in the future.");
    }
    setError("");
    onCreate({ title: title.trim(), rule: rule.trim(), closes, category });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-30">
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: COLOR.card, border: `2.5px solid ${COLOR.border}` }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold" style={{ color: COLOR.navy }}>New market</h3>
          <button onClick={onClose} style={{ color: COLOR.muted }}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[12px]" style={{ color: COLOR.muted }}>Question</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Will they still be together by..."
              className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ background: "#F6F3FC", border: "2px solid #E3DEF2", color: COLOR.navy }}
            />
          </div>
          <div>
            <label className="text-[12px]" style={{ color: COLOR.muted }}>Resolution rule</label>
            <textarea
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              rows={3}
              placeholder="Plain language rule for how this resolves"
              className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
              style={{ background: "#F6F3FC", border: "2px solid #E3DEF2", color: COLOR.navy }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px]" style={{ color: COLOR.muted }}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "#F6F3FC", border: "2px solid #E3DEF2", color: COLOR.navy }}
              >
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[12px]" style={{ color: COLOR.muted }}>Closes</label>
              <input
                type="datetime-local"
                value={closes}
                min={minValue}
                onChange={(e) => setCloses(e.target.value)}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "#F6F3FC", border: "2px solid #E3DEF2", color: COLOR.navy }}
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "#B0433F" }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
        <button
          onClick={submit}
          className="w-full mt-6 rounded-2xl py-3 font-semibold transition-transform hover:scale-[1.01]"
          style={{ background: COLOR.mint, color: COLOR.navy, border: `2px solid ${COLOR.border}` }}
        >
          Publish market
        </button>
      </div>
    </div>
  );
}

function EditCloseDateModal({ market, onClose, onSave }) {
  const [closes, setCloses] = useState(market.closes.slice(0, 16));
  const [error, setError] = useState("");
  const minValue = toLocalInputValue(new Date());

  const submit = () => {
    if (!closes) return setError("Pick a new close date.");
    if (new Date(closes).getTime() <= Date.now()) {
      return setError("New closing time has to be in the future.");
    }
    setError("");
    onSave(market.id, closes);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-30">
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: COLOR.card, border: `2.5px solid ${COLOR.border}` }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold" style={{ color: COLOR.navy }}>Edit close date</h3>
          <button onClick={onClose} style={{ color: COLOR.muted }}>
            <X size={18} />
          </button>
        </div>
        <p className="text-[13px] mb-4 leading-snug" style={{ color: COLOR.muted }}>
          {market.title}
        </p>
        <label className="text-[12px]" style={{ color: COLOR.muted }}>New close date and time</label>
        <input
          type="datetime-local"
          value={closes}
          min={minValue}
          onChange={(e) => setCloses(e.target.value)}
          className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
          style={{ background: "#F6F3FC", border: "2px solid #E3DEF2", color: COLOR.navy }}
        />
        {error && (
          <div className="flex items-center gap-2 mt-3 text-[12px]" style={{ color: "#B0433F" }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <button
          onClick={submit}
          className="w-full mt-6 rounded-2xl py-3 font-semibold transition-transform hover:scale-[1.01]"
          style={{ background: COLOR.mint, color: COLOR.navy, border: `2px solid ${COLOR.border}` }}
        >
          Save close date
        </button>
      </div>
    </div>
  );
}

function SaveIndicator({ status }) {
  if (status === "idle") return null;
  return (
    <div
      className="fixed bottom-20 md:bottom-6 right-5 flex items-center gap-2 rounded-full px-3 py-2 text-[12px] font-medium z-20 shadow-md"
      style={{ background: COLOR.card, border: `2px solid ${COLOR.border}`, color: COLOR.navy }}
    >
      {status === "saving" ? (
        <>
          <Loader2 size={13} className="animate-spin" /> Saving...
        </>
      ) : (
        <>
          <CheckCircle2 size={13} style={{ color: "#2F9E8F" }} /> Saved
        </>
      )}
    </div>
  );
}

export default function App() {
  useFonts();

  const [markets, setMarkets] = useState([]);
  const [view, setView] = useState("feed");
  const [activeMarketId, setActiveMarketId] = useState(null);
  const [category, setCategory] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [editingMarket, setEditingMarket] = useState(null);
  const [bets, setBets] = useState({});
  const [wallet, setWallet] = useState(DEFAULT_WALLET);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const saveTimer = useRef(null);

  /* Load persisted state once on mount. If nothing has been
     saved yet, seed with fresh demo markets and write that
     seed straight back to storage. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (!cancelled && res && res.value) {
          const parsed = JSON.parse(res.value);
          setMarkets(Array.isArray(parsed.markets) && parsed.markets.length ? parsed.markets : seedMarkets());
          setBets(parsed.bets && typeof parsed.bets === "object" ? parsed.bets : {});
          setWallet(parsed.wallet && parsed.wallet.connected ? parsed.wallet : DEFAULT_WALLET);
        } else if (!cancelled) {
          setMarkets(seedMarkets());
        }
      } catch (err) {
        if (!cancelled) setMarkets(seedMarkets());
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Persist on every meaningful change, once the initial load
     has completed so we never overwrite saved data with the
     empty default state during the first render. */
  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(
          STORAGE_KEY,
          JSON.stringify({ markets, bets, wallet }),
          false
        );
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch (err) {
        setSaveStatus("idle");
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, bets, wallet, loaded]);

  const handleConnect = ({ address, mode }) => {
    setWallet({ connected: true, address, balance: mode === "demo" ? 1240 : 0, mode });
  };
  const disconnect = () => setWallet(DEFAULT_WALLET);

  const placeBet = useCallback((marketId, side, amount) => {
    setMarkets((prev) =>
      prev.map((m) =>
        m.id === marketId
          ? {
              ...m,
              yesPool: side === "yes" ? m.yesPool + amount : m.yesPool,
              noPool: side === "no" ? m.noPool + amount : m.noPool,
              participants: m.participants + 1,
            }
          : m
      )
    );
    setBets((prev) => ({ ...prev, [marketId]: { side, amount } }));
    setWallet((w) => ({ ...w, balance: w.balance - amount }));
  }, []);

  const createMarket = useCallback(({ title, rule, closes, category }) => {
    const id = `m${Date.now()}`;
    setMarkets((prev) => [
      {
        id,
        category,
        title,
        rule: rule || "Resolution rule to be confirmed by the market creator.",
        closes,
        rapid: isRapid(closes),
        yesPool: 10,
        noPool: 10,
        participants: 1,
      },
      ...prev,
    ]);
  }, []);

  const deleteMarket = useCallback((marketId) => {
    setMarkets((prev) => prev.filter((m) => m.id !== marketId));
    setBets((prev) => {
      if (!prev[marketId]) return prev;
      const next = { ...prev };
      delete next[marketId];
      return next;
    });
    setActiveMarketId((id) => (id === marketId ? null : id));
  }, []);

  const editMarketClose = useCallback((marketId, newCloses) => {
    setMarkets((prev) =>
      prev.map((m) =>
        m.id === marketId
          ? { ...m, closes: newCloses, rapid: isRapid(newCloses) }
          : m
      )
    );
  }, []);

  const filtered = category === "All" ? markets : markets.filter((m) => m.category === category);
  const activeMarket = markets.find((m) => m.id === activeMarketId) || null;

  return (
    <div
      className="min-h-screen scroll-smooth"
      style={{ background: COLOR.bg, fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <header
        className="sticky top-0 z-10 backdrop-blur-md"
        style={{ background: "rgba(239,233,251,0.9)", borderBottom: `2px solid #DDD4F0` }}
      >
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full"
              style={{ background: `linear-gradient(135deg, ${COLOR.mint}, ${COLOR.cyan})`, border: `2px solid ${COLOR.border}` }}
            />
            <span className="font-semibold tracking-tight" style={{ color: COLOR.navy }}>Verdict</span>
          </div>
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {[
              { id: "feed", label: "Feed" },
              { id: "leaderboard", label: "Leaderboard" },
              { id: "profile", label: "Profile" },
            ].map((n) => (
              <button
                key={n.id}
                onClick={() => { setView(n.id); setActiveMarketId(null); }}
                className="px-3 py-1.5 rounded-full text-[13px] transition-colors"
                style={{
                  background: view === n.id ? "#E3DEF2" : "transparent",
                  color: view === n.id ? COLOR.navy : COLOR.muted,
                }}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {wallet.connected && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] transition-colors"
                style={{ border: `2px solid ${COLOR.border}`, color: COLOR.navy }}
              >
                <Plus size={14} /> New market
              </button>
            )}
            <WalletButton wallet={wallet} onConnect={handleConnect} onDisconnect={disconnect} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 pb-24">
        {view === "feed" && !activeMarket && (
          <>
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap font-medium transition-colors"
                  style={{
                    background: category === c ? COLOR.mint : "transparent",
                    border: category === c ? `2px solid ${COLOR.border}` : "2px solid #DDD4F0",
                    color: COLOR.navy,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            {!loaded ? (
              <div className="flex items-center gap-2 py-16 justify-center text-sm" style={{ color: COLOR.muted }}>
                <Loader2 size={16} className="animate-spin" /> Loading markets...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-sm" style={{ color: COLOR.muted }}>
                No markets in this category yet.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filtered.map((m, i) => (
                  <MarketCard
                    key={m.id}
                    market={m}
                    index={i}
                    onOpen={(mk) => setActiveMarketId(mk.id)}
                    onDelete={deleteMarket}
                    onEditDate={setEditingMarket}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeMarket && (
          <MarketDetail
            market={activeMarket}
            wallet={wallet}
            onBack={() => setActiveMarketId(null)}
            onBet={placeBet}
          />
        )}

        {view === "leaderboard" && !activeMarket && <Leaderboard />}
        {view === "profile" && !activeMarket && <Profile wallet={wallet} bets={bets} markets={markets} />}
      </main>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 backdrop-blur-md flex justify-around py-2.5 z-10"
        style={{ background: "rgba(239,233,251,0.95)", borderTop: `2px solid #DDD4F0` }}
      >
        {[
          { id: "feed", label: "Feed", icon: Search },
          { id: "leaderboard", label: "Ranks", icon: Trophy },
          { id: "profile", label: "You", icon: User },
        ].map((n) => (
          <button
            key={n.id}
            onClick={() => { setView(n.id); setActiveMarketId(null); }}
            className="flex flex-col items-center gap-0.5 text-[11px]"
            style={{ color: view === n.id ? "#2F9E8F" : COLOR.muted }}
          >
            <n.icon size={18} />
            {n.label}
          </button>
        ))}
      </nav>

      {showCreate && <CreateMarketModal onClose={() => setShowCreate(false)} onCreate={createMarket} />}
      {editingMarket && (
        <EditCloseDateModal
          market={editingMarket}
          onClose={() => setEditingMarket(null)}
          onSave={editMarketClose}
        />
      )}
      <SaveIndicator status={saveStatus} />
    </div>
  );
}
