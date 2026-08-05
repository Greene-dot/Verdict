import React, { useState, useEffect } from "react";
import {
  Sparkles, Search, Wallet, ShieldCheck, ArrowRight, Flame,
  Users, Coins, Mail, CheckCircle2, Radio, Link2
} from "lucide-react";

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

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

/* ---------------------------------------------------------
   A light CSS only pulse ring for the hero preview card. No
   three.js here, this is a hero visual, not core functionality,
   so it stays cheap to render on a mid range phone.
--------------------------------------------------------- */
function ScanRing() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
      <span
        className="absolute inset-0 rounded-full animate-ping"
        style={{ background: COLOR.mint, opacity: 0.35 }}
      />
      <span
        className="absolute inset-1 rounded-full border-2"
        style={{ borderColor: COLOR.mint, animation: "spin 6s linear infinite" }}
      />
      <span
        className="absolute inset-3 rounded-full border-2 border-dashed"
        style={{ borderColor: COLOR.violet, animation: "spin 9s linear infinite reverse" }}
      />
      <Radio size={18} style={{ color: COLOR.navy }} />
    </div>
  );
}

function StepCard({ icon: Icon, step, title, body }) {
  return (
    <div
      className="rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1"
      style={{ background: COLOR.card, border: `2.5px solid ${COLOR.border}` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: COLOR.mint, border: `2px solid ${COLOR.border}` }}
        >
          <Icon size={16} style={{ color: COLOR.navy }} />
        </div>
        <span className="text-[11px] font-mono font-semibold" style={{ color: COLOR.muted }}>
          Step {step}
        </span>
      </div>
      <h3 className="font-semibold mb-1.5" style={{ color: COLOR.navy }}>{title}</h3>
      <p className="text-[13px] leading-relaxed" style={{ color: COLOR.muted }}>{body}</p>
    </div>
  );
}

export default function Landing({ markets, wallet, onEnterApp, onConnectWallet }) {
  const [email, setEmail] = useState("");
  const [subState, setSubState] = useState("idle"); // idle, sending, done, error

  const totalPooled = markets.reduce((sum, m) => sum + (m.yesPool || 0) + (m.noPool || 0), 0);
  const totalPredictors = markets.reduce((sum, m) => sum + (m.participants || 0), 0);
  const featured = markets[0];
  const featuredTotal = featured ? (featured.yesPool + featured.noPool || 1) : 1;
  const featuredYesPct = featured ? Math.round((featured.yesPool / featuredTotal) * 100) : 50;

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setSubState("sending");
    try {
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setSubState("done");
    } catch {
      setSubState("error");
    }
  };

  return (
    <div style={{ background: COLOR.bg }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-6 pb-16">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold mb-5"
              style={{ background: COLOR.card, border: `2px solid ${COLOR.border}`, color: COLOR.navy }}
            >
              <Sparkles size={12} style={{ color: COLOR.violet }} /> Live on Stacks testnet
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold leading-[1.05] mb-5" style={{ color: COLOR.navy }}>
              Your friends have<br />receipts. Now you<br />can bet on them.
            </h1>
            <p className="text-[15px] leading-relaxed mb-7 max-w-md" style={{ color: COLOR.muted }}>
              Verdict turns relationship gossip and influencer drama into fast, on chain prediction
              markets. Pick a side, stake sats, and collect when the truth comes out.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={onEnterApp}
                className="flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold transition-transform hover:scale-[1.03]"
                style={{ background: COLOR.mint, color: COLOR.navy, border: `2px solid ${COLOR.border}` }}
              >
                Enter the feed <ArrowRight size={15} />
              </button>
              {!wallet.connected && (
                <button
                  onClick={onConnectWallet}
                  className="flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-medium"
                  style={{ border: `2px solid ${COLOR.border}`, color: COLOR.navy, background: COLOR.card }}
                >
                  <Wallet size={15} /> Connect wallet
                </button>
              )}
            </div>
          </div>

          {/* Live preview card, the hero visual */}
          <div
            className="rounded-3xl p-6"
            style={{ background: COLOR.card, border: `2.5px solid ${COLOR.border}` }}
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: COLOR.violet }}>
                Live market
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: COLOR.muted }}>
                <Flame size={12} style={{ color: "#B8860B" }} /> updating
              </span>
            </div>
            <div className="flex items-center gap-4 mb-5">
              <ScanRing />
              <div>
                <p className="font-semibold leading-snug" style={{ color: COLOR.navy }}>
                  {featured ? featured.title : "New markets open every day"}
                </p>
                <p className="text-[12px] mt-1" style={{ color: COLOR.muted }}>
                  {featured ? featured.category : "Friends · Influencers · Rapid calls"}
                </p>
              </div>
            </div>
            <div className="mb-2 h-2.5 w-full rounded-full overflow-hidden" style={{ background: "#E9E4F7" }}>
              <div
                className="h-full transition-all duration-700"
                style={{ width: `${featuredYesPct}%`, background: COLOR.mint }}
              />
            </div>
            <div className="flex items-center justify-between font-mono text-[12px] mb-5">
              <span style={{ color: "#2F9E8F" }}>YES {featuredYesPct}%</span>
              <span style={{ color: COLOR.violet }}>NO {100 - featuredYesPct}%</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4" style={{ borderTop: "2px solid #EFEAF9" }}>
              <div>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: COLOR.muted }}>Markets live</p>
                <p className="font-mono font-semibold" style={{ color: COLOR.navy }}>{markets.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: COLOR.muted }}>Sats pooled</p>
                <p className="font-mono font-semibold" style={{ color: COLOR.navy }}>{totalPooled.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <h2 className="text-2xl font-bold mb-2" style={{ color: COLOR.navy }}>How it actually works</h2>
        <p className="text-[14px] mb-8 max-w-lg" style={{ color: COLOR.muted }}>
          No paperwork, no house edge, just a question, a deadline, and a wallet.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <StepCard
            icon={Search}
            step="1"
            title="Pick a call"
            body="Browse markets on friend drama, influencer breakups, or fast moving live events with a closing date attached."
          />
          <StepCard
            icon={Coins}
            step="2"
            title="Stake sats"
            body="Connect a Stacks wallet and back the side you believe in. Odds move live as the pool fills up."
          />
          <StepCard
            icon={ShieldCheck}
            step="3"
            title="Get paid on resolution"
            body="Once the market closes, the outcome gets confirmed and the winning side splits the pool automatically."
          />
        </div>
      </section>

      {/* Trust strip */}
      <section className="max-w-5xl mx-auto px-5 py-10">
        <div
          className="rounded-3xl p-6 flex flex-wrap items-center gap-x-8 gap-y-4"
          style={{ background: COLOR.card, border: `2.5px solid ${COLOR.border}` }}
        >
          <div className="flex items-center gap-2">
            <Link2 size={16} style={{ color: COLOR.violet }} />
            <span className="text-[13px] font-medium" style={{ color: COLOR.navy }}>Built on Stacks, secured by Bitcoin</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: COLOR.violet }} />
            <span className="text-[13px] font-mono" style={{ color: COLOR.navy }}>{totalPredictors.toLocaleString()} predictors so far</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: COLOR.violet }} />
            <span className="text-[13px] font-medium" style={{ color: COLOR.navy }}>Every payout settles on chain</span>
          </div>
        </div>
      </section>

      {/* Email signup */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <div
          className="rounded-3xl p-7 sm:p-9"
          style={{ background: `linear-gradient(135deg, ${COLOR.peach}, ${COLOR.cyan})`, border: `2.5px solid ${COLOR.border}` }}
        >
          <div className="max-w-md">
            <h2 className="text-xl font-bold mb-2" style={{ color: COLOR.navy }}>Get notified when a new call drops</h2>
            <p className="text-[13px] mb-5" style={{ color: COLOR.navy, opacity: 0.75 }}>
              One email when something worth betting on shows up. No noise beyond that.
            </p>
            {subState === "done" ? (
              <div className="flex items-center gap-2 text-[14px] font-medium" style={{ color: COLOR.navy }}>
                <CheckCircle2 size={18} /> You're on the list.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 flex items-center gap-2 rounded-xl px-3.5 py-3" style={{ background: COLOR.card, border: `2px solid ${COLOR.border}` }}>
                  <Mail size={15} style={{ color: COLOR.muted }} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="w-full bg-transparent text-sm focus:outline-none"
                    style={{ color: COLOR.navy }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={subState === "sending"}
                  className="rounded-xl px-5 py-3 text-[14px] font-semibold whitespace-nowrap transition-transform hover:scale-[1.02] disabled:opacity-60"
                  style={{ background: COLOR.navy, color: COLOR.mint }}
                >
                  {subState === "sending" ? "Joining..." : "Notify me"}
                </button>
              </form>
            )}
            {subState === "error" && (
              <p className="text-[12px] mt-2" style={{ color: "#7A1F1F" }}>
                Couldn't save that, the backend might be waking up, try again in a moment.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="max-w-5xl mx-auto px-5 pb-16 text-center">
        <button
          onClick={onEnterApp}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold transition-transform hover:scale-[1.03]"
          style={{ background: COLOR.mint, color: COLOR.navy, border: `2px solid ${COLOR.border}` }}
        >
          See what's live right now <ArrowRight size={15} />
        </button>
      </section>
    </div>
  );
}
