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
    <main className="min-h-screen flex flex-col pb-20" style={{ background: "#FAF8F4" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-10 px-8 py-5 flex items-center justify-between border-b border-[#E2DDD6]" style={{ background: "#FAF8F4" }}>
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
        {[
          { label: "Home", href: "/home" },
          { label: "Wardrobe", href: "/wardrobe" },
          { label: "Wishlist", href: "/wardrobe" },
          { label: "Build", href: "/outfits" },
        ].map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            className="pb-3 pt-4 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            {label}
          </Link>
        ))}
        <span
          className="pb-3 pt-4 text-sm text-[#1E1E1E] relative"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Saved Outfits
          <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#1E1E1E]" />
        </span>
      </div>

      {/* Page header */}
      <div className="px-8 pt-10 pb-6 flex items-end justify-between gap-4 border-b border-[#E2DDD6]">
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

        {/* Tag filter pills */}
        <div className="flex items-center gap-1.5 pb-0.5 flex-wrap justify-end">
          <button
            onClick={() => setActiveTag("all")}
            className="px-3.5 py-1.5 rounded-full text-[11px] border transition-all"
            style={{
              fontFamily: "var(--font-dm-sans)",
              borderColor: activeTag === "all" ? "#1E1E1E" : "#D8D3CC",
              color: activeTag === "all" ? "#1E1E1E" : "#8A847C",
            }}
          >
            All
          </button>
          {OUTFIT_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? "all" : tag)}
              className="px-3.5 py-1.5 rounded-full text-[11px] border transition-all"
              style={{
                fontFamily: "var(--font-dm-sans)",
                borderColor: activeTag === tag ? "#1E1E1E" : "#D8D3CC",
                color: activeTag === tag ? "#1E1E1E" : "#8A847C",
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state — no outfits at all */}
      {outfits.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center py-24">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-[#C8C3BC]" />
          <p
            className="text-[#1E1E1E]"
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "1.6rem",
              fontWeight: 400,
              fontStyle: "italic",
            }}
          >
            No outfits saved yet.
          </p>
          <p
            className="text-[#8A847C] text-[13px] max-w-xs"
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
          >
            Build your first outfit and save it here.
          </p>
          <Link
            href="/outfits"
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 text-[13px] transition-all hover:opacity-80"
            style={{
              fontFamily: "var(--font-dm-sans)",
              background: "#1E1E1E",
              color: "#FAF8F4",
              borderRadius: "2px",
            }}
          >
            Start building
          </Link>
          <div className="w-px h-8 bg-gradient-to-b from-[#C8C3BC] to-transparent" />
        </div>
      )}

      {/* Filtered empty state */}
      {outfits.length > 0 && filtered.length === 0 && (
        <div className="px-8 pt-8">
          <p
            className="text-[13px] text-[#B8B3AC]"
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
          >
            No {activeTag} outfits saved.
          </p>
        </div>
      )}

      {/* Outfit list */}
      {filtered.length > 0 && (
        <div className="divide-y divide-[#EAE6E0]">
          {filtered.map((outfit) => {
            const images = outfit.items.map((oi) => itemMap.get(oi.wardrobeItemId)?.image ?? null);
            const isConfirming = confirmDeleteId === outfit.id;

            return (
              <div
                key={outfit.id}
                onClick={() => router.push(`/outfits?edit=${outfit.id}`)}
                className="px-8 py-6 cursor-pointer transition-colors"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F7F4F0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Image strip */}
                <div className="flex gap-2.5 mb-4">
                  {(images.length > 0 ? images : [null]).map((img, i) => (
                    <div
                      key={i}
                      className="relative shrink-0 overflow-hidden"
                      style={{
                        width: "90px",
                        height: "120px",
                        background: "#EDE9E3",
                        borderRadius: "3px",
                      }}
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full bg-[#D8D3CC]" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Name + tag */}
                <div className="flex items-center gap-3 mb-3 min-w-0">
                  <p
                    className="text-[#1E1E1E] truncate"
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      fontSize: "1.2rem",
                      fontWeight: 400,
                    }}
                  >
                    {outfit.name}
                  </p>
                  {outfit.tag && (
                    <span
                      className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] text-[#8A847C]"
                      style={{ fontFamily: "var(--font-dm-sans)", background: "#F0EBE3", letterSpacing: "0.03em" }}
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
                        className="text-[11px] text-[#8A847C] mr-1"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        Remove permanently?
                      </span>
                      <button
                        onClick={() => deleteOutfit(outfit.id)}
                        className="px-3 py-1 rounded-full text-[11px] border transition-all hover:bg-[#C0392B] hover:text-white"
                        style={{
                          fontFamily: "var(--font-dm-sans)",
                          borderColor: "#C0392B",
                          color: "#C0392B",
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1 rounded-full text-[11px] border border-[#D8D3CC] text-[#8A847C] hover:border-[#B8B3AC] hover:text-[#1E1E1E] transition-all"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => router.push(`/outfits?edit=${outfit.id}`)}
                        className="px-3 py-1 rounded-full text-[11px] border border-[#D8D3CC] text-[#8A847C] hover:border-[#B8B3AC] hover:text-[#1E1E1E] transition-all"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(outfit.id)}
                        className="px-3 py-1 rounded-full text-[11px] border border-[#D8D3CC] text-[#8A847C] hover:border-[#B8B3AC] hover:text-[#1E1E1E] transition-all"
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
