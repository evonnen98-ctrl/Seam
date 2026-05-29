"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type WardrobeItem, fetchItems, fetchWishlist } from "@/lib/wardrobe";
import { loadOutfits, saveOutfits, OUTFIT_TAGS, type Outfit, type OutfitTag } from "@/lib/outfits";

export default function SavedOutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [itemMap, setItemMap] = useState<Map<string, WardrobeItem>>(new Map());
  const [activeTag, setActiveTag] = useState<OutfitTag | "all">("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setOutfits(loadOutfits());
    async function loadItems() {
      const [wardrobe, wishlist] = await Promise.all([fetchItems(), fetchWishlist()]);
      setItemMap(new Map([...wardrobe, ...wishlist].map((i) => [i.id, i])));
    }
    loadItems();
  }, []);

  function deleteOutfit(id: string) {
    const next = outfits.filter((o) => o.id !== id);
    setOutfits(next);
    saveOutfits(next);
    setConfirmDeleteId(null);
  }

  const filtered =
    activeTag === "all" ? outfits : outfits.filter((o) => o.tag === activeTag);

  return (
    <main className="min-h-screen bg-[#FAF8F4] flex flex-col pb-16">

      {/* Nav */}
      <nav className="sticky top-0 z-10 px-8 py-5 flex items-center justify-between bg-[#FAF8F4] border-b border-[#E2DDD6]">
        <Link
          href="/"
          className="text-[#1E1E1E] tracking-widest text-sm uppercase"
          style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.2em" }}
        >
          Seam
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
        <Link
          href="/wardrobe"
          className="pb-3 pt-4 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Wardrobe
        </Link>
        <Link
          href="/wardrobe"
          className="pb-3 pt-4 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Wishlist
        </Link>
        <span
          className="pb-3 pt-4 text-sm text-[#1E1E1E] relative"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Saved Outfits
          <span className="absolute bottom-0 left-0 right-0 h-px bg-[#1E1E1E]" />
        </span>
        <Link
          href="/outfits"
          className="pb-3 pt-4 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Build
        </Link>
      </div>

      {/* Header + filter */}
      <div className="px-8 pt-10 pb-6 flex items-end justify-between gap-4">
        <h1
          className="text-[#1E1E1E] leading-none"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            fontWeight: 400,
            letterSpacing: "-0.01em",
          }}
        >
          Saved Outfits
        </h1>
        <div className="flex items-center gap-1 pb-1">
          <button
            onClick={() => setActiveTag("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all border ${
              activeTag === "all"
                ? "border-[#3A3530] text-[#1E1E1E]"
                : "border-transparent text-[#8A847C] hover:text-[#1E1E1E] hover:bg-[#F0EBE3]"
            }`}
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            All
          </button>
          {OUTFIT_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? "all" : tag)}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all border ${
                activeTag === tag
                  ? "border-[#3A3530] text-[#1E1E1E]"
                  : "border-transparent text-[#8A847C] hover:text-[#1E1E1E] hover:bg-[#F0EBE3]"
              }`}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {outfits.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center pb-16">
          <p
            className="text-[#1E1E1E]"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.5rem", fontWeight: 400, fontStyle: "italic" }}
          >
            No saved outfits yet.
          </p>
          <p className="text-[#8A847C] text-sm" style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}>
            Build and save an outfit from the Create page.
          </p>
          <Link
            href="/outfits"
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E1E1E] text-[#FAF8F4] rounded-full text-sm hover:bg-[#3A3530] transition-colors"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Go to Create
          </Link>
        </div>
      )}

      {/* Filtered empty state */}
      {outfits.length > 0 && filtered.length === 0 && (
        <div className="px-8 pt-4">
          <p className="text-sm text-[#B8B3AC]" style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}>
            No {activeTag} outfits saved.
          </p>
        </div>
      )}

      {/* Outfit list */}
      {filtered.length > 0 && (
        <div className="divide-y divide-[#E2DDD6]">
          {filtered.map((outfit) => {
            const images = outfit.items.map((oi) => itemMap.get(oi.wardrobeItemId)?.image ?? null);
            const isConfirming = confirmDeleteId === outfit.id;
            return (
              <div key={outfit.id} onClick={() => router.push(`/outfits?edit=${outfit.id}`)} className="px-8 py-5 hover:bg-[#F7F4F0] transition-colors cursor-pointer">
                {/* Image strip — fixed-width cards, no trailing space */}
                <div className="flex gap-2 mb-4 w-fit">
                  {(images.length > 0 ? images : [null]).map((img, i) => (
                    <div
                      key={i}
                      className="relative w-[7.5rem] h-40 shrink-0 rounded-xl overflow-hidden bg-[#F0EBE3]"
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#E2DDD6] opacity-70" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Name + tag — same line, name truncates if long */}
                <div className="flex items-center gap-2.5 mb-3 min-w-0">
                  <p
                    className="text-[#1E1E1E] truncate"
                    style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem", fontWeight: 400 }}
                  >
                    {outfit.name}
                  </p>
                  {outfit.tag && (
                    <span
                      className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] text-[#8A847C] bg-[#F0EBE3]"
                      style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.03em" }}
                    >
                      {outfit.tag}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {isConfirming ? (
                    <>
                      <span
                        className="text-xs text-[#8A847C] mr-1"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        Remove permanently?
                      </span>
                      <button
                        onClick={() => deleteOutfit(outfit.id)}
                        className="px-3 py-1 rounded-full text-xs border border-[#C0392B] text-[#C0392B] hover:bg-[#C0392B] hover:text-white transition-all"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1 rounded-full text-xs border border-[#E2DDD6] text-[#8A847C] hover:border-[#B8B3AC] hover:text-[#1E1E1E] transition-all"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => router.push(`/outfits?edit=${outfit.id}`)}
                        className="px-3 py-1 rounded-full text-xs border border-[#E2DDD6] text-[#8A847C] hover:border-[#B8B3AC] hover:text-[#1E1E1E] transition-all"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(outfit.id)}
                        className="px-3 py-1 rounded-full text-xs border border-[#E2DDD6] text-[#8A847C] hover:border-[#B8B3AC] hover:text-[#1E1E1E] transition-all"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
