"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import Link from "next/link";
import { Send, Sparkles, Plus, X, Upload, ExternalLink, ChevronDown, Shirt, Bookmark } from "lucide-react";
import { type WardrobeItem, fetchItems, fetchWishlist, upsertItem, deleteItemById, moveItemToList, logWear } from "@/lib/wardrobe";
import { inferCategory } from "@/lib/categorize";
import { AddItemModal } from "@/components/AddItemModal";
import { CURRENCIES, type CurrencyCode, loadCurrencyPreference, saveCurrencyPreference, displayPrice, itemPriceUSD, fromUSD, getSymbol, detectPriceCurrency, parsePriceAmount, toUSD } from "@/lib/currency";

type SortKey = "newest" | "oldest" | "price-high" | "price-low" | "az";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest",     label: "Newest first" },
  { value: "oldest",     label: "Oldest first" },
  { value: "price-high", label: "Price high to low" },
  { value: "price-low",  label: "Price low to high" },
  { value: "az",         label: "A–Z" },
];

// Parse a price string to a USD-normalised number for comparison.
// Uses currency detection so "A$140" and "$100" compare correctly.
function parsePriceUSD(price?: string): number {
  if (!price) return -1;
  const amount = parsePriceAmount(price);
  if (amount == null || isNaN(amount)) return -1;
  const currency = detectPriceCurrency(price) ?? "USD";
  const usd = toUSD(amount, currency);
  return isNaN(usd) ? -1 : usd;
}

function sortItems(items: WardrobeItem[], key: SortKey): WardrobeItem[] {
  const arr = [...items];
  switch (key) {
    case "newest":
      // DB already returns newest-first; sort by createdAt desc as a safety net
      return arr.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    case "oldest":
      return arr.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    case "price-high":
      return arr.sort((a, b) => {
        const pa = parsePriceUSD(a.price), pb = parsePriceUSD(b.price);
        if (pa === -1 && pb === -1) return 0;
        if (pa === -1) return 1;   // no price → end
        if (pb === -1) return -1;
        return pb - pa;
      });
    case "price-low":
      return arr.sort((a, b) => {
        const pa = parsePriceUSD(a.price), pb = parsePriceUSD(b.price);
        if (pa === -1 && pb === -1) return 0;
        if (pa === -1) return 1;   // no price → end
        if (pb === -1) return -1;
        return pa - pb;
      });
    case "az":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
  }
}

// ── Stat helpers ─────────────────────────────────────────────────────────────

function sumPrices(items: WardrobeItem[], displayCurrency: string): string {
  const usdValues = items
    .map((i) => itemPriceUSD(i.price, i.priceCurrency, i.priceUSD))
    .filter((v): v is number => v !== null);
  if (usdValues.length === 0) return "—";
  const totalUSD = usdValues.reduce((a, b) => a + b, 0);
  const converted = fromUSD(totalUSD, displayCurrency);
  const sym = getSymbol(displayCurrency);
  return `${sym}${Math.round(converted).toLocaleString("en-AU")}`;
}

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = ["Outerwear", "Tops", "Dresses", "Bottoms", "Accessories", "Shoes", "Other"] as const;

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export default function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [wishlist, setWishlist] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"wardrobe" | "wishlist">("wardrobe");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [chatOpen, setChatOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function backfill(
      loaded: WardrobeItem[],
      list: "wardrobe" | "wishlist"
    ): Promise<WardrobeItem[]> {
      const dirty: WardrobeItem[] = [];
      const result = loaded.map((item) => {
        if (item.category) return item;
        const filled = { ...item, category: inferCategory(item.name, item.brand, item.url) };
        dirty.push(filled);
        return filled;
      });
      // Persist any items that were missing a category
      await Promise.all(dirty.map((item) => upsertItem(item, list)));
      return result;
    }
    async function load() {
      const [wardrobe, wishlist] = await Promise.all([fetchItems(), fetchWishlist()]);
      setItems(await backfill(wardrobe, "wardrobe"));
      setWishlist(await backfill(wishlist, "wishlist"));
      setLoading(false);
    }
    load();
    setCurrency(loadCurrencyPreference());
  }, []);

  const activeItems = tab === "wardrobe" ? items : wishlist;

  const categorySet = new Set(activeItems.map((i) => i.category).filter(Boolean));
  const visibleCategories = CATEGORIES.filter((c) => categorySet.has(c));

  const filtered = sortItems(
    activeCategory ? activeItems.filter((i) => i.category === activeCategory) : activeItems,
    sortKey
  );

  function saveEdit(updated: WardrobeItem) {
    if (items.some((i) => i.id === updated.id)) {
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      upsertItem(updated, "wardrobe");
    } else {
      setWishlist((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      upsertItem(updated, "wishlist");
    }
    setEditingItem(null);
  }

  function deleteItem(id: string) {
    if (items.some((i) => i.id === id)) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setWishlist((prev) => prev.filter((i) => i.id !== id));
    }
    deleteItemById(id);
    setEditingItem(null);
  }

  function moveToWardrobe(id: string) {
    const item = wishlist.find((i) => i.id === id);
    if (!item) return;
    setWishlist((prev) => prev.filter((i) => i.id !== id));
    setItems((prev) => [item, ...prev]);
    moveItemToList(id, "wardrobe");
    setEditingItem(null);
  }

  function moveToWishlist(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setWishlist((prev) => [item, ...prev]);
    moveItemToList(id, "wishlist");
    setEditingItem(null);
  }

  // Scroll chat panel to bottom whenever messages update
  useLayoutEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!chatInput.trim() || isStreaming) return;

    const userText = chatInput.trim();
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: userText };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", text: "" };

    // Snapshot history before adding new messages (excludes current exchange)
    const history = messages.map(({ role, text }) => ({ role, text }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setChatInput("");
    setChatOpen(true);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, history, wardrobe: [...items, ...wishlist] }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: m.text + chunk } : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: "Something went wrong. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF8F4] flex flex-col pb-32">
      {/* Nav */}
      <nav className="sticky top-0 z-10 px-8 py-5 flex items-center bg-[#FAF8F4] border-b border-[#E2DDD6]">
        <Link
          href="/"
          className="text-[#1E1E1E] text-sm uppercase"
          style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.2em" }}
        >
          My Drobe
        </Link>
      </nav>

      {/* Tabs */}
      <div className="px-8 flex items-center gap-6 border-b border-[#E2DDD6]">
        <Link
          href="/home"
          className="pb-3 pt-4 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Home
        </Link>
        {(["wardrobe", "wishlist"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setActiveCategory(null); }}
            className={`pb-3 pt-4 text-sm transition-colors relative ${
              tab === t ? "text-[#1E1E1E]" : "text-[#8A847C] hover:text-[#1E1E1E]"
            }`}
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            {t === "wardrobe" ? "Wardrobe" : "Wishlist"}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#1E1E1E]" />
            )}
          </button>
        ))}
        <Link
          href="/outfits/saved"
          className="pb-3 pt-4 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Saved Outfits
        </Link>
        <Link
          href="/outfits"
          className="pb-3 pt-4 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Build
        </Link>
      </div>

      {/* Header */}
      <div className="px-8 pt-10 pb-4 flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-[#1E1E1E] leading-none mb-1"
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "clamp(2rem, 4vw, 2.75rem)",
              fontWeight: 400,
              letterSpacing: "-0.01em",
            }}
          >
            {tab === "wardrobe" ? "Wardrobe" : "Wishlist"}
          </h1>
        </div>
        <div className="flex items-center gap-4 pt-1">
          <SortDropdown value={sortKey} onChange={setSortKey} />
          <button
            onPointerDown={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-sm px-4 py-2.5 bg-[#1E1E1E] text-[#FAF8F4] rounded-full hover:bg-[#3A3530] transition-colors"
            style={{ fontFamily: "var(--font-dm-sans)", touchAction: "manipulation" }}
          >
            Add item
          </button>
        </div>
      </div>

      {/* Filters + stats row */}
      {!loading && activeItems.length > 0 && (
        <div className="px-4 sm:px-8 pb-4 flex items-center justify-between gap-4">
          {/* Category pills — left, horizontally scrollable on mobile */}
          <div className="flex items-center gap-1 overflow-x-auto flex-nowrap pb-0.5 -mb-0.5">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs transition-all border ${
                activeCategory === null
                  ? "border-[#3A3530] text-[#1E1E1E]"
                  : "border-transparent text-[#8A847C] hover:text-[#1E1E1E] hover:bg-[#F0EBE3]"
              }`}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              All
            </button>
            {visibleCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs transition-all border ${
                  activeCategory === cat
                    ? "border-[#3A3530] text-[#1E1E1E]"
                    : "border-transparent text-[#8A847C] hover:text-[#1E1E1E] hover:bg-[#F0EBE3]"
                }`}
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Stats — right */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-5 shrink-0">
              <StatCard label="Total value" value={sumPrices(filtered, currency)} />
              <StatCard label="Pieces" value={String(filtered.length)} />
            </div>
          )}
        </div>
      )}

      {/* Skeleton loading grid */}
      {loading && (
        <div className="px-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] rounded-xl bg-[#EDE8E1] mb-3" />
              <div className="h-3 bg-[#EDE8E1] rounded-full mb-1.5 w-3/4" />
              <div className="h-2.5 bg-[#EDE8E1] rounded-full w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state — only shown once loading is done */}
      {!loading && activeItems.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center pb-32">
          <div className="w-16 h-16 rounded-full bg-[#F0EBE3] flex items-center justify-center">
            <Sparkles size={20} className="text-[#8A847C]" />
          </div>
          <div>
            <p className="text-[#1E1E1E] mb-2" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.5rem", fontWeight: 400, fontStyle: "italic" }}>
              {tab === "wardrobe" ? "Your wardrobe is empty." : "Your wishlist is empty."}
            </p>
            <p className="text-[#8A847C] text-sm mb-6" style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}>
              Add a few pieces to get started.
            </p>
            <button
              onPointerDown={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E1E1E] text-[#FAF8F4] rounded-full text-sm hover:bg-[#3A3530] transition-colors"
              style={{ fontFamily: "var(--font-dm-sans)", touchAction: "manipulation" }}
            >
              <Plus size={14} />
              Add pieces
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length > 0 && (
        <div className="px-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} list={tab} onClick={() => setEditingItem(item)} currency={currency} />
          ))}
        </div>
      )}

      {/* Add item modal */}
      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onItemAdded={(item, list) => {
            if (list === "wardrobe") setItems((prev) => [item, ...prev]);
            else setWishlist((prev) => [item, ...prev]);
          }}
          defaultDest={tab}
        />
      )}

      {/* Edit modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          list={tab}
          onSave={saveEdit}
          onDelete={deleteItem}
          onMoveToWardrobe={moveToWardrobe}
          onMoveToWishlist={moveToWishlist}
          onClose={() => setEditingItem(null)}
          currencyPref={currency}
        />
      )}

      {/* Chat panel */}
      {chatOpen && messages.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-20">
          <div className="bg-white border border-[#E2DDD6] rounded-2xl shadow-sm p-4 max-h-72 overflow-y-auto space-y-3">
            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const isStreaming_ = isLast && msg.role === "assistant" && isStreaming;
              return (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-[#F0EBE3] flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles size={10} className="text-[#8A847C]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#1E1E1E] text-[#FAF8F4] rounded-br-sm"
                        : "bg-[#F0EBE3] text-[#1E1E1E] rounded-bl-sm"
                    }`}
                    style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                  >
                    {msg.text === "" && isStreaming_ ? (
                      /* Typing indicator — three pulsing dots */
                      <span className="flex items-center gap-1 py-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-[#8A847C] inline-block animate-pulse"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </span>
                    ) : (
                      <>
                        {msg.text}
                        {/* Blinking cursor while streaming */}
                        {isStreaming_ && (
                          <span className="inline-block w-px h-3.5 bg-[#8A847C] ml-0.5 align-middle animate-pulse" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
        </div>
      )}

      {/* Currency footer */}
      <div className="px-8 pt-6 pb-2 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-[#C8C3BC]" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Prices in
        </span>
        {CURRENCIES.map((c, i) => (
          <span key={c.code} className="flex items-center gap-2">
            {i > 0 && <span className="text-[#E2DDD6] text-[11px]" aria-hidden>·</span>}
            <button
              onClick={() => { setCurrency(c.code); saveCurrencyPreference(c.code); }}
              className={`text-[11px] transition-colors ${
                c.code === currency ? "text-[#5A5550]" : "text-[#C8C3BC] hover:text-[#8A847C]"
              }`}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {c.symbol} {c.code}
            </button>
          </span>
        ))}
      </div>

      {/* Chat input */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#FAF8F4] border-t border-[#E2DDD6] px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-2">
          <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-white border border-[#E2DDD6] rounded-full">
            <Sparkles size={13} className="text-[#8A847C] shrink-0" />
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isStreaming && sendMessage()}
              placeholder={isStreaming ? "My Drobe is thinking…" : "Ask anything about your wardrobe…"}
              disabled={isStreaming}
              className="flex-1 bg-transparent text-sm text-[#1E1E1E] placeholder-[#B8B3AC] outline-none disabled:opacity-60"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!chatInput.trim() || isStreaming}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-[#1E1E1E] text-[#FAF8F4] transition-all hover:bg-[#3A3530] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  item,
  list,
  onSave,
  onDelete,
  onMoveToWardrobe,
  onMoveToWishlist,
  onClose,
  currencyPref = "USD",
}: {
  item: WardrobeItem;
  list: "wardrobe" | "wishlist";
  onSave: (item: WardrobeItem) => void;
  onDelete: (id: string) => void;
  onMoveToWardrobe: (id: string) => void;
  onMoveToWishlist: (id: string) => void;
  onClose: () => void;
  currencyPref?: CurrencyCode;
}) {
  const [draft, setDraft] = useState<WardrobeItem>(item);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [wearLogging, setWearLogging] = useState(false);

  // Price field shows the price in the user's preferred currency; on save converts back to USD
  const [priceInput, setPriceInput] = useState(() => {
    if (item.priceUSD != null) return displayPrice(item.priceUSD, currencyPref);
    return item.price ?? "";
  });

  async function handleLogWear() {
    if (wearLogging) return;
    setWearLogging(true);
    const now = new Date().toISOString();
    const newCount = (draft.wornCount ?? 0) + 1;
    setDraft(d => ({ ...d, wornCount: newCount, lastWorn: now }));
    await logWear(item.id);
    setWearLogging(false);
  }
  const imageInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Close on backdrop click
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setDraft((d) => ({ ...d, image: e.target?.result as string }));
    reader.readAsDataURL(file);
  }

  const field = "w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#E2DDD6] rounded-xl text-sm text-[#1E1E1E] placeholder-[#C8B89A] outline-none focus:border-[#B8B3AC] transition-colors";
  const label = "block text-[10px] uppercase tracking-widest text-[#8A847C] mb-1.5";

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-30 bg-[#1E1E1E]/40 flex items-center justify-center p-4"
    >
      <div className="bg-[#FAF8F4] rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2DDD6]">
          <div className="flex items-baseline gap-3">
            <h2
              className="text-[#1E1E1E]"
              style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.35rem", fontWeight: 400, fontStyle: "italic" }}
            >
              Edit piece
            </h2>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
                style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.7rem" }}
              >
                {new URL(item.url).hostname.replace("www.", "")}
                <ExternalLink size={10} />
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#8A847C] hover:text-[#1E1E1E] hover:bg-[#F0EBE3] transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Image */}
          <div>
            <p className={label} style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>Photo</p>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#F0EBE3] border border-dashed border-[#E2DDD6] hover:border-[#B8B3AC] transition-colors group"
            >
              {draft.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.image} alt={draft.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-[#1E1E1E]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Upload size={16} className="text-white" />
                    <span className="text-white text-xs" style={{ fontFamily: "var(--font-dm-sans)" }}>Replace photo</span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#B8B3AC]">
                  <Upload size={18} />
                  <span className="text-xs" style={{ fontFamily: "var(--font-dm-sans)" }}>Upload photo</span>
                </div>
              )}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])}
            />
          </div>

          {/* Name */}
          <div>
            <label className={label} style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>
              Name <span className="text-[#C8B89A]">*</span>
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className={field}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            />
          </div>

          {/* Brand + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>Brand</label>
              <input
                type="text"
                value={draft.brand ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                placeholder="e.g. Arket"
                className={field}
                style={{ fontFamily: "var(--font-dm-sans)" }}
              />
            </div>
            <div>
              <label className={label} style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>Price</label>
              <input
                type="text"
                value={priceInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setPriceInput(val);
                  const detected = detectPriceCurrency(val);
                  const newCurrency = detected ?? currencyPref;
                  const amount = parsePriceAmount(val);
                  const newPriceUSD = amount != null ? toUSD(amount, newCurrency) : undefined;
                  setDraft((d) => ({ ...d, price: val, priceCurrency: newCurrency, priceUSD: newPriceUSD }));
                }}
                placeholder={`e.g. ${getSymbol(currencyPref)}120`}
                className={field}
                style={{ fontFamily: "var(--font-dm-sans)" }}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className={label} style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, category: cat }))}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    draft.category === cat
                      ? "bg-[#1E1E1E] text-[#FAF8F4]"
                      : "bg-white border border-[#E2DDD6] text-[#8A847C] hover:border-[#B8B3AC] hover:text-[#3A3530]"
                  }`}
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Cost per wear — wardrobe items only */}
          {list === "wardrobe" && (
            <div className="rounded-xl border border-[#E2DDD6] bg-white px-4 py-3.5">
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.62rem", letterSpacing: "0.12em", color: "#B8B3AC", textTransform: "uppercase" }}>
                  Cost per wear
                </p>
                <button
                  onClick={handleLogWear}
                  disabled={wearLogging}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#1E1E1E] text-[#FAF8F4] rounded-full hover:bg-[#3A3530] transition-colors disabled:opacity-50"
                  style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.72rem" }}
                >
                  <Sparkles size={10} strokeWidth={1.5} />
                  Log a wear
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Worn",
                    value: String(draft.wornCount ?? 0),
                  },
                  {
                    label: "Cost / wear",
                    value: (() => {
                      const count = draft.wornCount ?? 0;
                      const usd = itemPriceUSD(draft.price, draft.priceCurrency, draft.priceUSD);
                      if (count === 0 || usd == null) return "—";
                      return displayPrice(usd / count, currencyPref);
                    })(),
                  },
                  {
                    label: "Last worn",
                    value: draft.lastWorn
                      ? new Date(draft.lastWorn).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "Never",
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.6rem", letterSpacing: "0.1em", color: "#B8B3AC", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                      {label}
                    </p>
                    <p style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.15rem", fontWeight: 400, color: "#1E1E1E", lineHeight: 1.2 }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#E2DDD6]">
          {/* Delete / confirm */}
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#8A847C]" style={{ fontFamily: "var(--font-dm-sans)" }}>
                Remove permanently?
              </span>
              <button
                onClick={() => onDelete(item.id)}
                className="px-3.5 py-1.5 bg-[#C0392B] text-white rounded-full text-xs hover:bg-[#A93226] transition-colors"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-[#8A847C] hover:text-[#C0392B] transition-colors"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Delete
            </button>
          )}

          {/* Move to wardrobe */}
          {list === "wishlist" && !confirmDelete && (
            <button
              onClick={() => onMoveToWardrobe(item.id)}
              className="text-xs text-[#8A847C] hover:text-[#1E1E1E] transition-colors underline underline-offset-2"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Move to Wardrobe
            </button>
          )}

          {/* Move to wishlist */}
          {list === "wardrobe" && !confirmDelete && (
            <button
              onClick={() => onMoveToWishlist(item.id)}
              className="text-xs text-[#8A847C] hover:text-[#1E1E1E] transition-colors underline underline-offset-2"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Move to Wishlist
            </button>
          )}

          {/* Save */}
          <button
            onClick={() => onSave(draft)}
            disabled={!draft.name.trim()}
            className="px-5 py-2 bg-[#1E1E1E] text-[#FAF8F4] rounded-full text-sm hover:bg-[#3A3530] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({ item, list, onClick, currency = "USD" }: { item: WardrobeItem; list: "wardrobe" | "wishlist"; onClick: () => void; currency?: string }) {
  const usdAmount = itemPriceUSD(item.price, item.priceCurrency, item.priceUSD);
  const priceDisplay = usdAmount != null ? displayPrice(usdAmount, currency) : item.price;

  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className="relative aspect-[3/4] rounded-xl mb-3 overflow-hidden bg-[#F0EBE3] transition-all group-hover:shadow-md">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                (e.target as HTMLImageElement).remove();
                parent.classList.add("flex", "items-center", "justify-center");
                parent.innerHTML = `<div style="width:2.5rem;height:2.5rem;border-radius:9999px;background:#E2DDD6;opacity:0.7"></div>`;
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-[#E2DDD6] opacity-70" />
          </div>
        )}
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/75 flex items-center justify-center">
          {list === "wardrobe"
            ? <Shirt size={10} className="text-[#8A847C]" />
            : <Bookmark size={10} className="text-[#8A847C]" />}
        </div>
      </div>

      <div className="px-0.5">
        <p className="text-[#1E1E1E] text-xs font-medium truncate mb-0.5" style={{ fontFamily: "var(--font-dm-sans)" }}>
          {item.name}
        </p>
        <div className="flex items-center justify-between gap-1">
          {item.brand && (
            <span className="text-[#8A847C] text-xs truncate" style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}>
              {item.brand}
            </span>
          )}
          {priceDisplay && (
            <span className="text-[#3A3530] text-xs shrink-0" style={{ fontFamily: "var(--font-dm-sans)" }}>
              {priceDisplay}
            </span>
          )}
        </div>
        {item.url && (
          <div className="mt-1.5">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 text-[#B8B3AC] hover:text-[#8A847C] transition-colors opacity-0 group-hover:opacity-100"
              title="View original"
            >
              <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3.5 py-2 bg-white border border-[#E2DDD6] rounded-lg">
      <p
        className="text-[9px] uppercase text-[#B8B3AC]"
        style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.08em" }}
      >
        {label}
      </p>
      <p
        className="text-[#3A3530] leading-none"
        style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.05rem", fontWeight: 400 }}
      >
        {value}
      </p>
    </div>
  );
}

// ── Sort dropdown ─────────────────────────────────────────────────────────────

function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("touchstart", handleOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.value === value)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
        style={{ fontFamily: "var(--font-dm-sans)" }}
      >
        {current.label}
        <ChevronDown
          size={13}
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-[#E2DDD6] rounded-xl shadow-sm overflow-hidden z-30">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${
                opt.value === value
                  ? "text-[#1E1E1E] bg-[#F0EBE3]"
                  : "text-[#8A847C] hover:text-[#1E1E1E] hover:bg-[#FAF8F4]"
              }`}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
