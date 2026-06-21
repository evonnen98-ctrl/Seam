"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronDown, Check, Heart, X, Link2, Loader2, ExternalLink,
  Shirt, Tag, ArrowLeft,
  Briefcase, Coffee, Moon, Sun, Zap, Star,
  Cloud, CloudRain, CloudSnow, Wind,
} from "lucide-react";
import { fetchItems, fetchWishlist, upsertItem, type WardrobeItem } from "@/lib/wardrobe";
import { loadFeedback, addFeedback, getFeedbackContext, type OutfitFeedback } from "@/lib/outfitFeedback";
import type { BuyAnalysis } from "@/app/api/should-i-buy/route";
import { getBackgroundByTime, getAccentColor } from "@/lib/timeTheme";
import { AppNav } from "@/components/AppNav";

// ── Types ─────────────────────────────────────────────────────────────────────

const OCCASIONS = ["Work", "Casual", "Going Out", "Weekend", "Workout", "Formal"] as const;
const VIBES     = ["Minimal", "Polished", "Relaxed", "Bold"] as const;
const PIN_CATEGORIES = ["Outerwear", "Tops", "Bottoms", "Accessories", "Shoes", "Other"] as const;

type Occasion   = typeof OCCASIONS[number];
type Vibe       = typeof VIBES[number];
type PinCategory = typeof PIN_CATEGORIES[number] | "all";
type TaggedItem = WardrobeItem & { source: "wardrobe" | "wishlist" };
type View       = "home" | "outfit" | "buy";

interface WeatherData { city: string; temp: number; condition: string; conditionCode: number }
interface OutfitResult { selectedIds: string[]; note: string }
interface ScrapedProduct { name: string; brand?: string; price?: string; image?: string; category?: string; url: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3)  return code === 1 ? "Mostly clear" : code === 2 ? "Partly cloudy" : "Overcast";
  if (code <= 48) return "Foggy";
  if (code <= 55) return "Drizzle";
  if (code <= 65) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Stormy";
}

function WeatherIcon({ code }: { code: number }) {
  const props = { size: 26, strokeWidth: 1.25, color: "#8A847C" };
  if (code === 0 || code === 1) return <Sun {...props} />;
  if (code <= 3)  return <Cloud {...props} />;
  if (code <= 48) return <Wind {...props} />;
  if (code <= 82) return <CloudRain {...props} />;
  if (code <= 86) return <CloudSnow {...props} />;
  return <Zap {...props} />;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function formatWeatherLine(weather: WeatherData): string {
  return `${weather.temp}° · ${weather.city} · ${weather.condition}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

function fadeIn(v: boolean, delay: number): React.CSSProperties {
  return {
    opacity: v ? 1 : 0,
    transform: v ? "translateY(0)" : "translateY(8px)",
    transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
  };
}

const OCCASION_ICONS: Record<Occasion, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Work: Briefcase, Casual: Coffee, "Going Out": Moon, Weekend: Sun, Workout: Zap, Formal: Star,
};

const CHIP_BASE = "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all cursor-pointer border";
const CHIP_ON   = `${CHIP_BASE} border-[#3A3530] text-[#1E1E1E]`;
const CHIP_OFF  = `${CHIP_BASE} border-[#E2DDD6] text-[#8A847C] hover:text-[#1E1E1E] hover:border-[#C8C3BC]`;

const FILTER_BASE = "px-2.5 py-1 rounded-full transition-all cursor-pointer leading-none";
const FILTER_S: React.CSSProperties = { fontFamily: "var(--font-dm-sans)", fontSize: "0.7rem" };
const FILTER_ON  = `${FILTER_BASE} bg-[#1E1E1E] text-[#FAF8F4]`;
const FILTER_OFF = `${FILTER_BASE} border border-[#E2DDD6] text-[#8A847C] hover:text-[#1E1E1E] hover:border-[#C8C3BC]`;

const LABEL_S: React.CSSProperties = { fontFamily: "var(--font-dm-sans)", fontSize: "0.65rem", letterSpacing: "0.16em" };

const VERDICT_COLOR: Record<BuyAnalysis["verdict"], string> = {
  "Worth it": "#4A7C59",
  "Think twice": "#8A6A2E",
  "You've got this covered": "#6B6560",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  // Shared
  const [allItems,   setAllItems]   = useState<TaggedItem[]>([]);
  const [weather,    setWeather]    = useState<WeatherData | null>(null);
  const [visible,    setVisible]    = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<OutfitFeedback[]>([]);

  // Navigation
  const [view, setView] = useState<View>("home");

  // Outfit state
  const [occasion,       setOccasion]       = useState<Occasion | null>(null);
  const [vibe,           setVibe]           = useState<Vibe | null>(null);
  const [pinnedIds,      setPinnedIds]      = useState<Set<string>>(new Set());
  const [pinsExpanded,   setPinsExpanded]   = useState(false);
  const [pinCategory,    setPinCategory]    = useState<PinCategory>("all");
  const [outfitLoading,  setOutfitLoading]  = useState(false);
  const [result,         setResult]         = useState<OutfitResult | null>(null);
  const [resultItems,    setResultItems]    = useState<WardrobeItem[]>([]);
  const [outfitError,    setOutfitError]    = useState<string | null>(null);
  const [currentFeedback,setCurrentFeedback]= useState<"love"|"dismiss"|null>(null);

  useEffect(() => {
    async function load() {
      const [w, wl] = await Promise.all([fetchItems(), fetchWishlist()]);
      setAllItems([
        ...w.map((i) => ({ ...i, source: "wardrobe" as const })),
        ...wl.map((i) => ({ ...i, source: "wishlist" as const })),
      ]);
    }
    load();
    setFeedbackHistory(loadFeedback());
    const t = setTimeout(() => setVisible(true), 40);

    async function fetchWeather(lat: number, lon: number) {
      try {
        const [wRes, gRes] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`),
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: { "Accept-Language": "en" } }),
        ]);
        const wj = await wRes.json();
        const gj = await gRes.json();
        setWeather({
          temp: Math.round(wj.current.temperature_2m),
          conditionCode: wj.current.weathercode,
          condition: weatherLabel(wj.current.weathercode),
          city: gj.address?.city || gj.address?.town || gj.address?.village || gj.address?.county || "Melbourne",
        });
      } catch { /* skip */ }
    }

    if (!navigator.geolocation) {
      fetchWeather(-37.8136, 144.9631);
    } else {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => fetchWeather(coords.latitude, coords.longitude),
        ()           => fetchWeather(-37.8136, 144.9631),
      );
    }
    return () => clearTimeout(t);
  }, []);

  function togglePin(id: string) {
    setPinnedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function getDressed(fbOverride?: OutfitFeedback[]) {
    if (!occasion || !vibe) return;
    setOutfitLoading(true); setOutfitError(null); setResult(null); setResultItems([]); setCurrentFeedback(null);
    try {
      const res = await fetch("/api/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion, vibe, wardrobeItems: wardrobeOnly, weather,
          pinnedIds: [...pinnedIds],
          feedbackContext: getFeedbackContext(fbOverride ?? feedbackHistory),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setOutfitError(data.error ?? "Something went wrong."); return; }
      const itemMap = new Map(wardrobeOnly.map(i => [i.id, i]));
      setResult(data);
      setResultItems((data.selectedIds as string[]).map(id => itemMap.get(id)).filter((i): i is TaggedItem => !!i));
    } catch { setOutfitError("Could not reach the server."); }
    finally  { setOutfitLoading(false); }
  }

  function handleFeedback(type: "love" | "dismiss") {
    if (!result || !occasion || !vibe) return;
    const updated = addFeedback(result.selectedIds, resultItems.map(i => i.name), occasion, vibe, type);
    setFeedbackHistory(updated);
    setCurrentFeedback(type);
    if (type === "dismiss") getDressed(updated);
  }

  const wardrobeOnly    = allItems.filter(i => i.source === "wardrobe");
  const emptyWardrobe   = wardrobeOnly.length === 0;
  const canSubmit       = !!occasion && !!vibe;
  const filteredPinItems = wardrobeOnly
    .filter(i => pinCategory === "all" || i.category === pinCategory);

  const accent = getAccentColor();

  return (
    <main className="h-screen flex flex-col overflow-hidden" style={{ background: getBackgroundByTime() }}>

      <AppNav activePage="home" onHomeClick={() => setView("home")} />

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden" style={view === "home" ? { background: "url('/homepagephoto.jpg') center center / cover no-repeat" } : undefined}>

        {/* ── Home landing ── */}
        {view === "home" && (
          <div className="h-full overflow-y-auto flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-10 py-12">
              <div className="w-full max-w-lg flex flex-col items-center text-center">

                {/* Greeting */}
                <h1 style={{ opacity: visible ? 1 : 0, transition: "opacity 0.5s ease 0s", fontFamily: "var(--font-sora)", fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)", fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: "0.5rem", lineHeight: 1.15 }}>
                  {getGreeting()}
                </h1>

                {/* Date */}
                <p style={{ ...fadeIn(visible, 0.08), fontFamily: "var(--font-dm-sans)", fontSize: "12px", fontWeight: 400, color: "#8A847C", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                  {formatDate(new Date())}
                </p>

                {/* Weather — always in DOM so layout height never changes; fades in once loaded */}
                <p style={{ opacity: weather && visible ? 1 : 0, transition: "opacity 0.5s ease 0.12s", fontFamily: "var(--font-dm-sans)", fontSize: "12px", fontWeight: 400, color: "#8A847C", letterSpacing: "0.02em", marginBottom: "2.75rem" }}>
                  {weather ? formatWeatherLine(weather) : " "}
                </p>

                {/* Two action cards */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8" style={fadeIn(visible, 0.2)}>
                  <ActionCard
                    icon={<Shirt size={28} strokeWidth={1.25} />}
                    title="Plan today's outfit"
                    subtitle="Pick an occasion and My Drobe will dress you."
                    onClick={() => setView("outfit")}
                    accent={accent}
                  />
                  <ActionCard
                    icon={<Tag size={28} strokeWidth={1.25} />}
                    title="Should I buy this?"
                    subtitle="Paste a link. Get an honest answer."
                    onClick={() => setView("buy")}
                    accent={accent}
                  />
                </div>


              </div>
            </div>
          </div>
        )}

        {/* ── Outfit view ── */}
        {view === "outfit" && (
          <div className="h-full flex flex-col">

            {/* Back bar */}
            <div className="shrink-0 px-8 py-3 border-b border-black/[0.06] bg-white/50 backdrop-blur-sm flex items-center">
              <button
                onClick={() => setView("home")}
                className="flex items-center gap-1.5 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                <ArrowLeft size={13} strokeWidth={1.5} />
                Back
              </button>
            </div>

            {/* Two-column layout */}
            <div className="flex-1 flex flex-col sm:flex-row min-h-0">

              {/* Left panel */}
              <div className="w-full sm:w-[34%] shrink-0 border-b sm:border-b-0 sm:border-r border-[#E2DDD6] bg-[#F7F4F0] flex flex-col overflow-y-auto">
                <div className="px-8 pt-7 pb-4 flex flex-col gap-7 flex-1">

                  {/* Occasion */}
                  <div>
                    <p className="text-[#B8B3AC] uppercase mb-3" style={LABEL_S}>Occasion</p>
                    <div className="flex flex-wrap gap-2">
                      {OCCASIONS.map(o => {
                        const Icon = OCCASION_ICONS[o];
                        return (
                          <button key={o} onClick={() => setOccasion(occasion === o ? null : o)}
                            className={occasion === o ? CHIP_ON : CHIP_OFF}
                            style={{ fontFamily: "var(--font-dm-sans)" }}>
                            <Icon size={12} strokeWidth={1.75} />{o}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Vibe */}
                  <div>
                    <p className="text-[#B8B3AC] uppercase mb-3" style={LABEL_S}>Vibe</p>
                    <div className="flex flex-wrap gap-2">
                      {VIBES.map(v => (
                        <button key={v} onClick={() => setVibe(vibe === v ? null : v)}
                          className={vibe === v ? CHIP_ON : CHIP_OFF}
                          style={{ fontFamily: "var(--font-dm-sans)" }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pin a piece */}
                  {wardrobeOnly.length > 0 && (
                    <div>
                      <button
                        onClick={() => setPinsExpanded(v => !v)}
                        className="w-full flex items-center justify-between group -mx-3 px-3 py-2 rounded-lg hover:bg-[#EDE8E1] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-[#8A847C] uppercase group-hover:text-[#1E1E1E] transition-colors" style={LABEL_S}>
                            Start with a specific piece?
                          </p>
                          {pinnedIds.size > 0 && (
                            <span className="w-4 h-4 rounded-full bg-[#1E1E1E] text-[#FAF8F4] flex items-center justify-center" style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.55rem" }}>
                              {pinnedIds.size}
                            </span>
                          )}
                        </div>
                        <ChevronDown size={14} className={`text-[#8A847C] group-hover:text-[#1E1E1E] transition-all duration-200 ${pinsExpanded ? "rotate-180" : ""}`} />
                      </button>

                      {pinsExpanded && (
                        <div className="mt-4">
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {(["all", ...PIN_CATEGORIES] as PinCategory[]).map(c => (
                              <button key={c} onClick={() => setPinCategory(c)} className={pinCategory === c ? FILTER_ON : FILTER_OFF} style={FILTER_S}>
                                {c === "all" ? "All" : c}
                              </button>
                            ))}
                          </div>
                          {filteredPinItems.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {filteredPinItems.map(item => {
                                const pinned = pinnedIds.has(item.id);
                                return (
                                  <button key={item.id} onClick={() => togglePin(item.id)}
                                    className={`text-left rounded-xl transition-all ${pinned ? "ring-2 ring-[#1E1E1E] ring-offset-2" : "hover:ring-1 hover:ring-[#C8C3BC] hover:ring-offset-1"}`}>
                                    <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-[#F0EBE3]">
                                      {item.image
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center"><div className="w-6 h-6 rounded-full bg-[#E2DDD6] opacity-70" /></div>}
                                      {pinned && (
                                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#1E1E1E] flex items-center justify-center">
                                          <Check size={10} className="text-[#FAF8F4]" strokeWidth={2.5} />
                                        </div>
                                      )}
                                    </div>
                                    <p className="mt-1.5 truncate" style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.72rem", color: pinned ? "#1E1E1E" : "#8A847C", fontWeight: pinned ? 500 : 400 }}>
                                      {item.name}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.75rem", color: "#B8B3AC", fontWeight: 400 }}>No items match these filters.</p>
                          )}
                          {pinnedIds.size > 0 && (
                            <button onClick={() => setPinnedIds(new Set())} className="mt-3 transition-colors"
                              style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.65rem", letterSpacing: "0.04em", color: "#B8B3AC" }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#8A847C")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#B8B3AC")}>
                              Clear selection
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="mt-auto pb-2">
                    <button
                      onClick={() => getDressed()}
                      disabled={!canSubmit || outfitLoading}
                      className={`w-full py-3 rounded-full text-sm transition-all ${canSubmit && !outfitLoading ? "bg-[#A05215] text-white hover:bg-[#884510]" : "bg-[#E2DDD6] text-[#B8B3AC] cursor-not-allowed"}`}
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      Get dressed →
                    </button>
                  </div>
                </div>
              </div>

              {/* Right panel */}
              <div className="flex-1 overflow-y-auto">
                {emptyWardrobe && !outfitLoading && (
                  <div className="h-full flex flex-col items-center justify-center px-12 text-center gap-4">
                    <p style={{ fontFamily: "var(--font-sora)", fontSize: "0.95rem", fontWeight: 500, color: "#8A847C" }}>Your wardrobe is empty.</p>
                    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.85rem", color: "#B8B3AC", fontWeight: 400 }}>Add some pieces first and My Drobe will dress you.</p>
                    <Link href="/onboarding" className="mt-1 px-5 py-2.5 rounded-full text-sm bg-[#A05215] text-white hover:bg-[#884510] transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>
                      Add to wardrobe
                    </Link>
                  </div>
                )}
                {!emptyWardrobe && !outfitLoading && !result && !outfitError && (
                  <div className="h-full flex items-center justify-center px-16">
                    <p style={{ fontFamily: "var(--font-sora)", fontSize: "0.85rem", fontWeight: 400, color: "#C8C3BC", textAlign: "center", lineHeight: 1.6 }}>
                      Tell us what you&apos;re dressing for and we&apos;ll put something together.
                    </p>
                  </div>
                )}
                {!outfitLoading && outfitError && (
                  <div className="h-full flex flex-col items-center justify-center px-12 gap-3">
                    <p style={{ fontFamily: "var(--font-sora)", fontSize: "0.9rem", fontWeight: 500, color: "#8A847C" }}>Something went wrong.</p>
                    <p style={{ fontFamily: "var(--font-sora)", fontSize: "0.8rem", color: "#B8B3AC", fontWeight: 400 }}>{outfitError}</p>
                  </div>
                )}
                {outfitLoading && (
                  <div className="h-full flex flex-col items-center justify-center px-12 gap-5">
                    <div className="flex gap-1.5">
                      {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#1E1E1E] opacity-25 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                    </div>
                    <p style={{ fontFamily: "var(--font-sora)", fontSize: "0.85rem", fontWeight: 400, color: "#8A847C" }}>Putting your outfit together…</p>
                  </div>
                )}
                {result && !outfitLoading && (
                  <div className="px-10 pt-10 pb-12">
                    <div className="grid gap-5 mb-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))" }}>
                      {resultItems.map(item => (
                        <div key={item.id} className="flex flex-col">
                          <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-[#F0EBE3] mb-2.5">
                            {item.image
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 rounded-full bg-[#E2DDD6] opacity-70" /></div>}
                          </div>
                          <p className="leading-snug" style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", color: "#1E1E1E" }}>{item.name}</p>
                          {item.brand && <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.7rem", color: "#B8B3AC" }}>{item.brand}</p>}
                        </div>
                      ))}
                    </div>
                    {result.note && (
                      <ul className="mb-8 max-w-lg space-y-2">
                        {result.note.split("\n").map(l => l.replace(/^•\s*/,"").trim()).filter(Boolean).map((line, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span style={{ color: "#C8C3BC", lineHeight: "1.6", flexShrink: 0 }}>—</span>
                            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.85rem", color: "#3A3530", lineHeight: 1.6, fontWeight: 400 }}>{line}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button onClick={() => getDressed()} className="text-sm transition-colors"
                      style={{ fontFamily: "var(--font-dm-sans)", color: "#8A847C" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#1E1E1E")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#8A847C")}>
                      Try another →
                    </button>
                    <div className="mt-5">
                      {currentFeedback === "love"
                        ? <p className="text-xs text-[#B8B3AC]" style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}>Noted — we&apos;ll keep this in mind</p>
                        : currentFeedback === null
                          ? <div className="flex items-center gap-5">
                              <button onClick={() => handleFeedback("love")} className="flex items-center gap-1.5 text-xs text-[#C8C3BC] hover:text-[#8A847C] transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>
                                <Heart size={11} strokeWidth={1.5} />Love it
                              </button>
                              <button onClick={() => handleFeedback("dismiss")} className="flex items-center gap-1.5 text-xs text-[#C8C3BC] hover:text-[#8A847C] transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>
                                <X size={11} strokeWidth={1.5} />Not for me
                              </button>
                            </div>
                          : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Buy view ── */}
        {view === "buy" && (
          <div className="h-full flex flex-col">
            {/* Back bar */}
            <div className="shrink-0 px-8 py-3 border-b border-black/[0.06] bg-white/50 backdrop-blur-sm flex items-center">
              <button
                onClick={() => setView("home")}
                className="flex items-center gap-1.5 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                <ArrowLeft size={13} strokeWidth={1.5} />
                Back
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <BuyPanel wardrobe={wardrobeOnly} />
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

// ── Action card ───────────────────────────────────────────────────────────────

function ActionCard({ icon, title, subtitle, onClick, accent }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  accent: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px",
        padding: "24px",
        background: "white",
        borderRadius: "20px",
        border: "1px solid rgba(0,0,0,0.05)",
        boxShadow: hovered ? "0 6px 20px rgba(160, 82, 21, 0.10)" : "0 1px 8px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.2s ease",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: hovered ? `${accent}20` : "#f5f5f5",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.2s ease",
        color: hovered ? accent : "#9CA3AF",
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "18px", fontWeight: 500, color: "#1a1a1a", marginBottom: "6px", lineHeight: 1.2 }}>
          {title}
        </p>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "#6B7280", fontWeight: 400, lineHeight: 1.55 }}>
          {subtitle}
        </p>
      </div>
    </button>
  );
}

// ── Buy panel ─────────────────────────────────────────────────────────────────

function BuyPanel({ wardrobe }: { wardrobe: WardrobeItem[] }) {
  const [url,          setUrl]          = useState("");
  const [loading,      setLoading]      = useState(false);
  const [product,      setProduct]      = useState<ScrapedProduct | null>(null);
  const [result,       setResult]       = useState<BuyAnalysis | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [added,        setAdded]        = useState<"wardrobe" | "wishlist" | null>(null);
  const [manualMode,   setManualMode]   = useState(false);
  const [manualName,   setManualName]   = useState("");
  const [manualPrice,  setManualPrice]  = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Scrape + analyze in one go — no confirmation step
  async function check() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true); setError(null); setProduct(null); setResult(null); setAdded(null); setManualMode(false);
    try {
      // Step 1: scrape
      const scrapeRes = await fetch("/api/scrape", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) {
        setError("We couldn't read this link directly. Try pasting the product name and price instead.");
        return;
      }
      const scraped: ScrapedProduct = { ...scrapeData, url: trimmed };
      setProduct(scraped);

      // Step 2: analyze immediately
      const analyzeRes = await fetch("/api/should-i-buy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: scraped, wardrobe: wardrobe.map(({ image: _, ...rest }) => rest) }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) { setError(analyzeData.error ?? "Analysis failed."); return; }
      setResult(analyzeData);
    } catch { setError("Something went wrong — please try again."); }
    finally  { setLoading(false); }
  }

  async function checkManual() {
    if (!manualName.trim()) return;
    setLoading(true); setError(null); setResult(null); setAdded(null);
    const item = { name: manualName.trim(), price: manualPrice.trim() || undefined, url: "" };
    setProduct({ ...item, url: "" });
    try {
      const analyzeRes = await fetch("/api/should-i-buy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, wardrobe: wardrobe.map(({ image: _, ...rest }) => rest) }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) { setError(analyzeData.error ?? "Analysis failed."); return; }
      setResult(analyzeData);
    } catch { setError("Something went wrong — please try again."); }
    finally  { setLoading(false); }
  }

  async function addItem(list: "wardrobe" | "wishlist") {
    if (!product) return;
    await upsertItem({ id: crypto.randomUUID(), type: "url", name: product.name, brand: product.brand, price: product.price, image: product.image, category: product.category, url: product.url, createdAt: Date.now() }, list);
    setAdded(list);
  }

  function reset() {
    setUrl(""); setProduct(null); setResult(null); setError(null); setAdded(null);
    setManualMode(false); setManualName(""); setManualPrice("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const pairingItems = result
    ? result.pairsWithIds.map(id => wardrobe.find(w => w.id === id)).filter((w): w is WardrobeItem => !!w)
    : [];

  return (
    <div className="px-5 sm:px-10 pt-8 sm:pt-10 pb-16 max-w-3xl">

      {/* URL input (always visible) */}
      <div className="mb-8">
        {!result && !loading && (
          <>
            <p style={{ fontFamily: "var(--font-sora)", fontSize: "clamp(1.1rem, 2vw, 1.35rem)", fontWeight: 600, color: "#1E1E1E", letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
              Paste a link, get a verdict.
            </p>
            <p style={{ fontFamily: "var(--font-sora)", fontSize: "0.8rem", color: "#B8B3AC", fontWeight: 400, marginBottom: "1.5rem" }}>
              My Drobe will check it against your wardrobe and tell you if it&apos;s worth it.
            </p>
          </>
        )}

        {!result && (
          <div className="flex gap-2">
            <div className={`flex-1 flex items-center gap-2.5 px-4 py-3 bg-white border rounded-full transition-colors ${error ? "border-[#C8A882]" : "border-[#E2DDD6] focus-within:border-[#B8B3AC]"}`}>
              <Link2 size={13} className="text-[#8A847C] shrink-0" />
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(null); }}
                onKeyDown={e => e.key === "Enter" && !loading && check()}
                placeholder="net-a-porter.com, zara.com, ssense.com…"
                className="flex-1 bg-transparent text-sm text-[#1E1E1E] placeholder-[#C8C3BC] outline-none"
                style={{ fontFamily: "var(--font-dm-sans)" }}
                disabled={loading}
                autoFocus
              />
            </div>
            <button
              onClick={check}
              disabled={!url.trim() || loading}
              className="px-5 py-3 bg-[#A05215] text-white rounded-full text-sm transition-all hover:bg-[#884510] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {loading ? <><Loader2 size={13} className="animate-spin" />Checking…</> : "Check it →"}
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: "0.6rem" }}>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", color: "#A0742A", fontWeight: 400 }}>{error}</p>
            {!manualMode && (
              <button
                onClick={() => setManualMode(true)}
                style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", color: "#8A847C", fontWeight: 400, marginTop: "0.4rem", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0 }}
              >
                Enter details manually instead →
              </button>
            )}
          </div>
        )}

        {/* Manual fallback form */}
        {manualMode && !result && (
          <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem", color: "#3A3530", fontWeight: 400 }}>Enter the product details:</p>
            <input
              type="text"
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && checkManual()}
              placeholder="Product name e.g. Linen blazer"
              className="px-4 py-3 bg-white border border-[#E2DDD6] rounded-full text-sm text-[#1E1E1E] placeholder-[#C8C3BC] outline-none focus:border-[#B8B3AC]"
              style={{ fontFamily: "var(--font-dm-sans)" }}
              autoFocus
            />
            <input
              type="text"
              value={manualPrice}
              onChange={e => setManualPrice(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && checkManual()}
              placeholder="Price (optional) e.g. $180"
              className="px-4 py-3 bg-white border border-[#E2DDD6] rounded-full text-sm text-[#1E1E1E] placeholder-[#C8C3BC] outline-none focus:border-[#B8B3AC]"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            />
            <button
              onClick={checkManual}
              disabled={!manualName.trim() || loading}
              className="self-start px-5 py-3 bg-[#A05215] text-white rounded-full text-sm hover:bg-[#884510] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {loading ? <><Loader2 size={13} className="animate-spin" />Checking…</> : "Check it →"}
            </button>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-4 py-4">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#1E1E1E] opacity-25 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
          </div>
          <p style={{ fontFamily: "var(--font-sora)", fontSize: "0.85rem", fontWeight: 400, color: "#8A847C" }}>
            Checking your wardrobe…
          </p>
        </div>
      )}

      {/* Result */}
      {result && product && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid #EAE6E0", background: "#FDFCFA", boxShadow: "0 2px 20px rgba(30,20,10,0.06)" }}
        >
          <div className="flex flex-col sm:flex-row min-h-0">

            {/* Left: large product image */}
            <div className="shrink-0 w-full sm:w-52 relative" style={{ background: "#EDE9E2" }}>
              <div className="w-full sm:w-52 h-48 sm:h-full sm:min-h-[340px] relative">
                {product.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={product.image} alt={product.name} className="absolute inset-0 w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <div className="w-full h-full flex items-center justify-center"><div className="w-12 h-12 rounded-full bg-[#D8D3CC]" /></div>}
              </div>
              {/* Price badge */}
              {product.price && (
                <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full" style={{ background: "rgba(250,248,244,0.92)", backdropFilter: "blur(6px)" }}>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.75rem", fontWeight: 500, color: "#1E1E1E" }}>{product.price}</p>
                </div>
              )}
            </div>

            {/* Right: verdict content */}
            <div className="flex-1 min-w-0 flex flex-col p-7 gap-5">

              {/* Product name + brand + link */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p style={{ fontFamily: "var(--font-sora)", fontSize: "1rem", fontWeight: 600, color: "#1E1E1E", letterSpacing: "-0.02em", lineHeight: 1.3 }}>
                    {product.name}
                  </p>
                  {product.brand && (
                    <p style={{ fontFamily: "var(--font-sora)", fontSize: "0.72rem", color: "#8A847C", fontWeight: 400, marginTop: "0.2rem" }}>{product.brand}</p>
                  )}
                </div>
                <a href={product.url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 text-[#C8C3BC] hover:text-[#8A847C] transition-colors mt-1"
                  style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.68rem" }}>
                  <ExternalLink size={11} />
                </a>
              </div>

              {/* Verdict — prominent */}
              <div className="flex items-center gap-3">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: VERDICT_COLOR[result.verdict] }}
                />
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.8rem", fontWeight: 600, color: VERDICT_COLOR[result.verdict], letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {result.verdict}
                </p>
              </div>

              {/* Divider */}
              <div className="h-px bg-[#EAE6E0]" />

              {/* Reasons */}
              <ul className="space-y-2 flex-1">
                {result.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span style={{ color: "#C8C3BC", lineHeight: "1.65", flexShrink: 0, fontSize: "0.8rem" }}>—</span>
                    <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem", color: "#3A3530", lineHeight: 1.65, fontWeight: 400 }}>{reason}</span>
                  </li>
                ))}
              </ul>

              {/* Pairs with */}
              {pairingItems.length > 0 && (
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.6rem", letterSpacing: "0.14em", color: "#B8B3AC", textTransform: "uppercase", marginBottom: "0.6rem" }}>
                    Pairs with
                  </p>
                  <div className="flex gap-2.5">
                    {pairingItems.map(item => (
                      <div key={item.id} className="flex flex-col gap-1 w-16">
                        <div className="w-16 aspect-[3/4] rounded-lg overflow-hidden bg-[#EDE9E2]">
                          {item.image
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            : <div className="w-full h-full flex items-center justify-center"><div className="w-5 h-5 rounded-full bg-[#D8D3CC]" /></div>}
                        </div>
                        <p className="leading-tight line-clamp-2" style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.6rem", color: "#8A847C" }}>
                          {item.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="pt-1 border-t border-[#EAE6E0]">
                {!added ? (
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => addItem("wardrobe")}
                      className="px-4 py-2 rounded-full text-xs bg-[#A05215] text-white hover:bg-[#884510] transition-colors"
                      style={{ fontFamily: "var(--font-dm-sans)" }}>
                      Add to Wardrobe
                    </button>
                    <button onClick={() => addItem("wishlist")}
                      className="px-4 py-2 rounded-full text-xs border border-[#E2DDD6] text-[#3A3530] hover:border-[#B8B3AC] hover:bg-[#F0EBE3] transition-colors"
                      style={{ fontFamily: "var(--font-dm-sans)" }}>
                      Save to Wishlist
                    </button>
                    <button onClick={reset} className="ml-auto text-xs text-[#C8C3BC] hover:text-[#8A847C] transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>
                      Check another →
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.8rem", color: "#8A847C", fontWeight: 400 }}>
                      Added to {added === "wardrobe" ? "your wardrobe" : "your wishlist"}.
                    </p>
                    <button onClick={reset} className="text-xs text-[#C8C3BC] hover:text-[#8A847C] transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>
                      Check another →
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
