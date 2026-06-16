"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { type WardrobeItem, fetchItems, fetchWishlist } from "@/lib/wardrobe";
import { loadOutfits, saveOutfits, OUTFIT_TAGS, type Outfit, type OutfitTag } from "@/lib/outfits";
import { getBackgroundByTime, getAccentColor } from "@/lib/timeTheme";
import { AppNav } from "@/components/AppNav";

export default function SavedOutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [itemMap, setItemMap] = useState<Map<string, WardrobeItem>>(new Map());
  const [activeTag, setActiveTag] = useState<OutfitTag | "all">("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const router = useRouter();
  const accent = getAccentColor();

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
    <main className="min-h-screen flex flex-col pb-20" style={{ background: getBackgroundByTime() }}>
      <AppNav activePage="saved" />

      {/* Header */}
      <div className="px-8 pt-6 pb-2 flex items-end justify-between gap-4 flex-wrap">
        <h1
          className="text-[#1a1a1a] leading-none"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            fontWeight: 400,
            letterSpacing: "-0.01em",
          }}
        >
          Saved Outfits
        </h1>

        {outfits.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end pb-0.5">
            <button
              onClick={() => setActiveTag("all")}
              className="px-3.5 py-1.5 rounded-full text-[11px] border transition-all"
              style={{
                fontFamily: "var(--font-dm-sans)",
                borderColor: activeTag === "all" ? "#1a1a1a" : "#D8D3CC",
                color: activeTag === "all" ? "#1a1a1a" : "#9CA3AF",
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
                  borderColor: activeTag === tag ? "#1a1a1a" : "#D8D3CC",
                  color: activeTag === tag ? "#1a1a1a" : "#9CA3AF",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state — no outfits at all */}
      {outfits.length === 0 && (
        <div className="px-8 pt-16 flex flex-col items-center text-center gap-3">
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "14px",
              fontWeight: 500,
              color: "#1a1a1a",
            }}
          >
            No saved outfits yet.
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              color: "#6B7280",
              fontWeight: 400,
            }}
          >
            Build your first outfit and save it here.
          </p>
          <a
            href="/outfits"
            className="mt-2 text-[13px]"
            style={{ fontFamily: "var(--font-dm-sans)", color: accent, fontWeight: 500 }}
          >
            Build your first outfit →
          </a>
        </div>
      )}

      {/* Filtered empty */}
      {outfits.length > 0 && filtered.length === 0 && (
        <div className="px-8 pt-8">
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              color: "#9CA3AF",
              fontWeight: 400,
            }}
          >
            No {activeTag} outfits saved.
          </p>
        </div>
      )}

      {/* Horizontal card list */}
      {filtered.length > 0 && (
        <div className="px-8 pt-2 pb-12 space-y-3">
          {filtered.map((outfit) => (
            <OutfitRow
              key={outfit.id}
              outfit={outfit}
              itemMap={itemMap}
              isConfirming={confirmDeleteId === outfit.id}
              onOpen={() => router.push(`/outfits?edit=${outfit.id}`)}
              onDeleteRequest={() => setConfirmDeleteId(outfit.id)}
              onDeleteConfirm={() => deleteOutfit(outfit.id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
              accent={accent}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function OutfitRow({
  outfit,
  itemMap,
  isConfirming,
  onOpen,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  accent,
}: {
  outfit: Outfit;
  itemMap: Map<string, WardrobeItem>;
  isConfirming: boolean;
  onOpen: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  accent: string;
}) {
  const [hovered, setHovered] = useState(false);

  const images = outfit.items.map((oi) => ({
    src: itemMap.get(oi.wardrobeItemId)?.image ?? null,
    name: itemMap.get(oi.wardrobeItemId)?.name ?? "",
  }));

  return (
    <div
      className="bg-white rounded-2xl p-4 cursor-pointer border border-black/[0.04] transition-all"
      style={{
        boxShadow: hovered
          ? "0 4px 24px rgba(0,0,0,0.09)"
          : "0 2px 12px rgba(0,0,0,0.05)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition: "box-shadow 0.15s ease, transform 0.15s ease",
      }}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Name + tag + delete — title row at top */}
      <div className="flex items-center gap-2 min-w-0 mb-1.5">
        <p
          className="truncate flex-1"
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "16px",
            fontWeight: 500,
            color: "#1a1a1a",
          }}
        >
          {outfit.name}
        </p>
        {outfit.tag && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] shrink-0"
            style={{
              fontFamily: "var(--font-dm-sans)",
              background: "#F5F0EB",
              color: "#8A847C",
            }}
          >
            {outfit.tag}
          </span>
        )}
        {/* Delete button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (isConfirming) onDeleteConfirm();
            else onDeleteRequest();
          }}
          className="w-7 h-7 flex items-center justify-center rounded-full transition-all shrink-0"
          style={{
            background: isConfirming ? "#ef4444" : "transparent",
            color: isConfirming ? "#fff" : "#C8C3BC",
          }}
          title={isConfirming ? "Confirm delete" : "Delete outfit"}
          onMouseEnter={(e) => {
            if (!isConfirming) {
              (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2";
              (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
            }
          }}
          onMouseLeave={(e) => {
            if (!isConfirming) {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "#C8C3BC";
            }
          }}
        >
          <Trash2 size={13} strokeWidth={1.75} />
        </button>
      </div>

      {/* Horizontal image strip */}
      <div
        className="flex gap-2 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {images.length === 0 ? (
          <div className="shrink-0 w-[100px] h-[126px] rounded-lg bg-[#F0EBE3] flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-[#E2DDD6]" />
          </div>
        ) : (
          images.map(({ src, name }, i) => (
            <div
              key={i}
              className="shrink-0 w-[100px] h-[126px] rounded-lg overflow-hidden bg-[#F0EBE3]"
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-[#E2DDD6]" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Confirm hint */}
      {isConfirming && (
        <p
          className="mt-1.5 text-[11px]"
          style={{ fontFamily: "var(--font-dm-sans)", color: "#ef4444" }}
        >
          Click delete again to confirm ·{" "}
          <button
            className="underline"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCancel();
            }}
          >
            Cancel
          </button>
        </p>
      )}
    </div>
  );
}
