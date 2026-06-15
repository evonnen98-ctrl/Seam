"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, Link2, Loader2, Check, Pencil, Upload } from "lucide-react";
import { type WardrobeItem, upsertItem } from "@/lib/wardrobe";
import { loadCurrencyPreference, getSymbol, detectPriceCurrency, parsePriceAmount, toUSD, type CurrencyCode } from "@/lib/currency";

type SavedItem = WardrobeItem & { list: "wardrobe" | "wishlist" };

interface ManualEntry {
  url: string;
  name: string;
  brand: string;
  price: string;
  category: string;
  image: string;
}

const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Knitwear", "Outerwear", "Shoes", "Bags", "Accessories"];

export function AddItemModal({
  onClose,
  onItemAdded,
  defaultDest = "wardrobe",
}: {
  onClose: () => void;
  onItemAdded?: (item: WardrobeItem, list: "wardrobe" | "wishlist") => void;
  defaultDest?: "wardrobe" | "wishlist";
}) {
  const [urlInput, setUrlInput] = useState("");
  const [dest, setDest] = useState<"wardrobe" | "wishlist">(defaultDest);
  const [loading, setLoading] = useState(false);
  const [manualEntry, setManualEntry] = useState<ManualEntry | null>(null);
  const [addedItems, setAddedItems] = useState<SavedItem[]>([]);
  const [currencyPref, setCurrencyPref] = useState<CurrencyCode>("USD");

  useEffect(() => {
    setCurrencyPref(loadCurrencyPreference());
  }, []);

  // Escape to close + body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function persistItem(item: SavedItem) {
    // Notify parent immediately (optimistic) so item appears without waiting for DB
    onItemAdded?.(item, item.list);
    setAddedItems((prev) => [item, ...prev]);
    // Persist to Supabase in the background
    await upsertItem(item, item.list);
  }

  async function addUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setManualEntry(null);
    setLoading(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualEntry({ url: trimmed, name: "", brand: "", price: "", category: "", image: "" });
        return;
      }
      await persistItem({
        id: crypto.randomUUID(),
        type: "url",
        url: trimmed,
        name: data.name,
        brand: data.brand,
        price: data.price,
        priceCurrency: data.priceCurrency,
        priceUSD: data.priceUSD,
        image: data.image,
        category: data.category,
        createdAt: Date.now(),
        list: dest,
      });
      setUrlInput("");
    } catch {
      setManualEntry({ url: trimmed, name: "", brand: "", price: "", category: "", image: "" });
    } finally {
      setLoading(false);
    }
  }

  async function submitManual(entry: ManualEntry) {
    if (!entry.name.trim()) return;
    const priceStr = entry.price.trim() || undefined;
    const priceCurrency = priceStr ? (detectPriceCurrency(priceStr) ?? currencyPref) : undefined;
    const priceAmount = parsePriceAmount(priceStr);
    const priceUSD = priceAmount != null && priceCurrency ? toUSD(priceAmount, priceCurrency) : undefined;
    await persistItem({
      id: crypto.randomUUID(),
      type: "url",
      url: entry.url,
      name: entry.name.trim(),
      brand: entry.brand.trim() || undefined,
      price: priceStr,
      priceCurrency,
      priceUSD,
      category: entry.category || undefined,
      image: entry.image || undefined,
      createdAt: Date.now(),
      list: dest,
    });
    setManualEntry(null);
    setUrlInput("");
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-[#1E1E1E]/50"
        onPointerDown={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-[440px] bg-[#FAF8F4] rounded-2xl shadow-2xl pointer-events-auto overflow-y-auto max-h-[90vh]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F0EBE3] transition-colors text-[#8A847C] hover:text-[#1E1E1E] z-10"
          >
            <X size={14} />
          </button>

          <div className="px-6 pt-6 pb-6">

            {/* Destination toggle */}
            <div className="flex items-center p-1 bg-white border border-[#E2DDD6] rounded-full mb-5 w-fit">
              {(["wardrobe", "wishlist"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDest(d)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                    dest === d
                      ? "bg-[#1E1E1E] text-[#FAF8F4]"
                      : "text-[#8A847C] hover:text-[#1E1E1E]"
                  }`}
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  {d === "wardrobe" ? "Add to Wardrobe" : "Add to Wishlist"}
                </button>
              ))}
            </div>

            {/* URL input */}
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2.5 px-4 py-3 bg-white border border-[#E2DDD6] rounded-full focus-within:border-[#B8B3AC] transition-colors">
                <Link2 size={14} className="text-[#8A847C] shrink-0" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setManualEntry(null); }}
                  onKeyDown={(e) => e.key === "Enter" && !loading && addUrl()}
                  placeholder="net-a-porter.com, zara.com…"
                  className="flex-1 bg-transparent text-sm text-[#1E1E1E] placeholder-[#C8C3BC] outline-none"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                  disabled={loading}
                />
              </div>
              <button
                onClick={addUrl}
                disabled={!urlInput.trim() || loading}
                className="px-5 py-3 bg-[#1E1E1E] text-[#FAF8F4] rounded-full text-sm hover:bg-[#3A3530] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 min-w-[68px] justify-center transition-colors"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : "Add"}
              </button>
            </div>

            {/* Manual entry fallback (shown after failed scrape) */}
            {manualEntry && (
              <ManualEntryForm
                entry={manualEntry}
                onChange={setManualEntry}
                onSubmit={submitManual}
                onCancel={() => setManualEntry(null)}
                currencyPref={currencyPref}
              />
            )}

            {/* Add manually button */}
            {!manualEntry && (
              <button
                onClick={() => setManualEntry({ url: "", name: "", brand: "", price: "", category: "", image: "" })}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-[#E2DDD6] bg-white hover:border-[#B8B3AC] hover:bg-[#FAF8F4] transition-all text-sm text-[#8A847C] hover:text-[#3A3530]"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                <Pencil size={13} />
                Add manually
              </button>
            )}

            {/* Added confirmation */}
            {addedItems.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {addedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#F0EBE3]"
                  >
                    <Check size={11} className="text-[#3A3530] shrink-0" strokeWidth={2.5} />
                    <p
                      className="text-sm text-[#1E1E1E] truncate flex-1"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      {item.name}
                    </p>
                    <span
                      className="text-[10px] text-[#8A847C] shrink-0"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      {item.list === "wardrobe" ? "Wardrobe" : "Wishlist"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Manual entry form ─────────────────────────────────────────────────────────

function ManualEntryForm({
  entry,
  onChange,
  onSubmit,
  onCancel,
  currencyPref = "USD",
}: {
  entry: ManualEntry;
  onChange: (e: ManualEntry) => void;
  onSubmit: (e: ManualEntry) => void;
  onCancel: () => void;
  currencyPref?: CurrencyCode;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange({ ...entry, image: e.target?.result as string });
    reader.readAsDataURL(file);
  }

  const scrapeFailure = !!entry.url;

  const domain = (() => {
    if (!entry.url) return "";
    try { return new URL(entry.url).hostname.replace("www.", ""); }
    catch { return entry.url; }
  })();

  return (
    <div className="mt-3 bg-white border border-[#E2DDD6] rounded-2xl overflow-hidden">
      {scrapeFailure && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EBE3]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#C8B89A]" />
            <p className="text-xs text-[#8A847C]" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Couldn&apos;t read{" "}
              <span className="text-[#3A3530]">{domain}</span>
              {" "}— fill in the details manually.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-5 h-5 flex items-center justify-center rounded-full text-[#B8B3AC] hover:text-[#3A3530] hover:bg-[#F0EBE3] transition-all"
          >
            <X size={11} />
          </button>
        </div>
      )}

      <div className="px-4 pt-4 pb-3 space-y-3">
        {/* Name */}
        <div>
          <label className="block text-[10px] uppercase text-[#8A847C] mb-1.5" style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>
            Name <span className="text-[#C8B89A]">*</span>
          </label>
          <input
            ref={nameRef}
            type="text"
            value={entry.name}
            onChange={(e) => onChange({ ...entry, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && entry.name.trim() && onSubmit(entry)}
            placeholder="e.g. Wide-Leg Trousers"
            className="w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#E2DDD6] rounded-xl text-sm text-[#1E1E1E] placeholder-[#C8B89A] outline-none focus:border-[#B8B3AC] transition-colors"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[10px] uppercase text-[#8A847C] mb-1.5" style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>Brand</label>
            <input type="text" value={entry.brand} onChange={(e) => onChange({ ...entry, brand: e.target.value })}
              placeholder="e.g. Arket"
              className="w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#E2DDD6] rounded-xl text-sm text-[#1E1E1E] placeholder-[#C8B89A] outline-none focus:border-[#B8B3AC] transition-colors"
              style={{ fontFamily: "var(--font-dm-sans)" }} />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-[#8A847C] mb-1.5" style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>Price</label>
            <input type="text" value={entry.price} onChange={(e) => onChange({ ...entry, price: e.target.value })}
              placeholder={`e.g. ${getSymbol(currencyPref)}120`}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#E2DDD6] rounded-xl text-sm text-[#1E1E1E] placeholder-[#C8B89A] outline-none focus:border-[#B8B3AC] transition-colors"
              style={{ fontFamily: "var(--font-dm-sans)" }} />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase text-[#8A847C] mb-1.5" style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>Category</label>
          <select
            value={entry.category}
            onChange={(e) => onChange({ ...entry, category: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#E2DDD6] rounded-xl text-sm text-[#1E1E1E] outline-none focus:border-[#B8B3AC] transition-colors appearance-none cursor-pointer"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            <option value="">Select a category…</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase text-[#8A847C] mb-1.5" style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>
            Photo <span className="normal-case text-[#B8B3AC]">(optional)</span>
          </label>
          {entry.image && (
            <div className="relative w-14 h-14 rounded-xl overflow-hidden mb-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.image} alt="preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange({ ...entry, image: "" })}
                className="absolute inset-0 flex items-center justify-center bg-[#1E1E1E]/40 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[#E2DDD6] bg-[#FAF8F4] hover:border-[#B8B3AC] hover:bg-[#F0EBE3] transition-all text-xs text-[#8A847C] hover:text-[#3A3530] shrink-0"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              <Upload size={11} />
              Add a photo
            </button>
            <span className="text-xs text-[#B8B3AC]" style={{ fontFamily: "var(--font-dm-sans)" }}>or</span>
            <input
              type="url"
              value={entry.image.startsWith("data:") ? "" : entry.image}
              onChange={(e) => onChange({ ...entry, image: e.target.value })}
              placeholder="Paste image URL…"
              className="flex-1 min-w-0 px-3 py-2 bg-[#FAF8F4] border border-[#E2DDD6] rounded-xl text-xs text-[#1E1E1E] placeholder-[#C8B89A] outline-none focus:border-[#B8B3AC] transition-colors"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            />
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 pb-4">
        <button onClick={onCancel} className="px-4 py-2 text-xs text-[#8A847C] hover:text-[#1E1E1E] transition-colors" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Cancel
        </button>
        <button
          onClick={() => onSubmit(entry)}
          disabled={!entry.name.trim()}
          className="px-4 py-2 bg-[#1E1E1E] text-[#FAF8F4] rounded-full text-xs hover:bg-[#3A3530] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          <Plus size={11} />
          Add item
        </button>
      </div>
    </div>
  );
}
