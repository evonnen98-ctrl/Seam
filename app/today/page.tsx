"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchItems, type WardrobeItem } from "@/lib/wardrobe";
import { getBackgroundByTime } from "@/lib/timeTheme";
import { AppNav } from "@/components/AppNav";

const OCCASIONS = ["Work", "Casual", "Date Night", "Weekend", "Gym"] as const;
const VIBES = ["Minimal", "Polished", "Relaxed", "Bold"] as const;

type Occasion = typeof OCCASIONS[number];
type Vibe = typeof VIBES[number];

interface OutfitResult {
  selectedIds: string[];
  note: string;
}

export default function TodayPage() {
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OutfitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultItems, setResultItems] = useState<WardrobeItem[]>([]);

  async function getDressed() {
    if (!occasion || !vibe) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const wardrobeItems = await fetchItems();

    try {
      const res = await fetch("/api/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, vibe, wardrobeItems }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      const itemMap = new Map(wardrobeItems.map((i) => [i.id, i]));
      const selected = (data.selectedIds as string[])
        .map((id) => itemMap.get(id))
        .filter((i): i is WardrobeItem => !!i);

      setResult(data);
      setResultItems(selected);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setResultItems([]);
    setError(null);
  }

  return (
    <main className="min-h-screen flex flex-col pb-16" style={{ background: getBackgroundByTime() }}>
      <AppNav activePage="home" />

      {/* Content */}
      <div className="px-8 pt-10 max-w-2xl">

        {/* Header */}
        <h1
          className="text-[#1E1E1E] leading-none mb-2"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            fontWeight: 400,
            letterSpacing: "-0.01em",
          }}
        >
          What are you dressing for?
        </h1>
        <p
          className="text-[#8A847C] mb-8"
          style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", fontWeight: 300 }}
        >
          Pick an occasion and a vibe — My Drobe will pull an outfit from your wardrobe.
        </p>

        {!result && !loading && (
          <>
            {/* Occasion */}
            <div className="mb-6">
              <p
                className="text-xs text-[#8A847C] uppercase tracking-widest mb-3"
                style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.15em" }}
              >
                Occasion
              </p>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((o) => (
                  <button
                    key={o}
                    onClick={() => setOccasion(occasion === o ? null : o)}
                    className={`px-4 py-2 rounded-full text-sm transition-all ${
                      occasion === o
                        ? "bg-[#1E1E1E] text-[#FAF8F4]"
                        : "border border-[#E2DDD6] text-[#8A847C] hover:text-[#1E1E1E] hover:border-[#1E1E1E]"
                    }`}
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {/* Vibe */}
            <div className="mb-10">
              <p
                className="text-xs text-[#8A847C] uppercase tracking-widest mb-3"
                style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.15em" }}
              >
                Vibe
              </p>
              <div className="flex flex-wrap gap-2">
                {VIBES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVibe(vibe === v ? null : v)}
                    className={`px-4 py-2 rounded-full text-sm transition-all ${
                      vibe === v
                        ? "bg-[#1E1E1E] text-[#FAF8F4]"
                        : "border border-[#E2DDD6] text-[#8A847C] hover:text-[#1E1E1E] hover:border-[#1E1E1E]"
                    }`}
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={getDressed}
              disabled={!occasion || !vibe}
              className={`px-6 py-3 rounded-full text-sm transition-all ${
                occasion && vibe
                  ? "bg-[#1E1E1E] text-[#FAF8F4] hover:bg-[#3A3530]"
                  : "bg-[#E2DDD6] text-[#B8B3AC] cursor-not-allowed"
              }`}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Get dressed →
            </button>

            {error && (
              <p
                className="mt-4 text-sm text-[#C0392B]"
                style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
              >
                {error}
              </p>
            )}
          </>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-start gap-3 pt-4">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#1E1E1E] opacity-40 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p
              className="text-sm text-[#8A847C]"
              style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontStyle: "italic" }}
            >
              Pulling your outfit together…
            </p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div>
            {/* Context reminder */}
            <div className="flex items-center gap-2 mb-6">
              <span
                className="px-3 py-1 rounded-full text-xs bg-[#F0EBE3] text-[#8A847C]"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {occasion}
              </span>
              <span
                className="px-3 py-1 rounded-full text-xs bg-[#F0EBE3] text-[#8A847C]"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {vibe}
              </span>
            </div>

            {/* Item cards */}
            <div className="flex flex-wrap gap-3 mb-6">
              {resultItems.map((item) => (
                <div key={item.id} className="flex flex-col w-32">
                  <div className="relative w-32 aspect-[3/4] rounded-xl overflow-hidden bg-[#F0EBE3] mb-2">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-[#E2DDD6] opacity-70" />
                      </div>
                    )}
                  </div>
                  {item.category && (
                    <p
                      className="text-[10px] text-[#B8B3AC] uppercase tracking-wider mb-0.5"
                      style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.1em" }}
                    >
                      {item.category}
                    </p>
                  )}
                  <p
                    className="text-[#1E1E1E] leading-tight"
                    style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.8rem" }}
                  >
                    {item.name}
                  </p>
                  {item.brand && (
                    <p
                      className="text-[#B8B3AC]"
                      style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.7rem" }}
                    >
                      {item.brand}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Stylist note */}
            {result.note && (
              <p
                className="text-[#1E1E1E] mb-8 max-w-md"
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "1.15rem",
                  fontWeight: 400,
                  fontStyle: "italic",
                  lineHeight: 1.55,
                }}
              >
                {result.note}
              </p>
            )}

            {/* Try again */}
            <button
              onClick={reset}
              className="flex items-center gap-2 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
