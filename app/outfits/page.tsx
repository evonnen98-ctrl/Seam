"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X, Plus, Check, Shirt, Bookmark, ChevronDown } from "lucide-react";
import { type WardrobeItem, fetchItems, fetchWishlist } from "@/lib/wardrobe";
import { loadOutfits, saveOutfits, OUTFIT_TAGS, type OutfitTag } from "@/lib/outfits";

type TaggedItem = WardrobeItem & { source: "wardrobe" | "wishlist" };

interface ZoneItem {
  instanceId: string;
  item: WardrobeItem;
}

const ZONES = [
  { id: "top",         header: "Top",         subLabel: "Outerwear · Tops · Knitwear · Dresses" },
  { id: "bottom",      header: "Bottom",      subLabel: "Pants · Skirts · Shorts · Denim · Jeans" },
  { id: "accessories", header: "Accessories", subLabel: "Shoes · Bags · Belts · Jewellery" },
] as const;

type ZoneId = typeof ZONES[number]["id"];

const EMPTY_ZONES: Record<ZoneId, ZoneItem[]> = { top: [], bottom: [], accessories: [] };

export default function OutfitsPage() {
  const PICKER_CATEGORIES = ["Outerwear", "Tops", "Bottoms", "Accessories", "Shoes", "Other"] as const;
  type PickerCategory = typeof PICKER_CATEGORIES[number];

  const [allItems, setAllItems] = useState<TaggedItem[]>([]);
  const [pickerFilter, setPickerFilter] = useState<"all" | "wardrobe" | "wishlist">("all");
  const [pickerCategory, setPickerCategory] = useState<PickerCategory | "all">("all");
  const [zones, setZones] = useState<Record<ZoneId, ZoneItem[]>>(EMPTY_ZONES);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [outfitName, setOutfitName] = useState("");
  const [outfitTag, setOutfitTag] = useState<OutfitTag | "">("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const [wardrobe, wishlist] = await Promise.all([fetchItems(), fetchWishlist()]);
      const wardrobeItems = [
        ...wardrobe.map((i) => ({ ...i, source: "wardrobe" as const })),
        ...wishlist.map((i) => ({ ...i, source: "wishlist" as const })),
      ];
      setAllItems(wardrobeItems);

      const editId = new URLSearchParams(window.location.search).get("edit");
      if (editId) {
        const outfit = loadOutfits().find((o) => o.id === editId);
        if (outfit) {
          setEditingId(editId);
          setOutfitName(outfit.name);
          setOutfitTag(outfit.tag ?? "");
          setIsSaving(true);
          const lookup = new Map(wardrobeItems.map((i) => [i.id, i]));
          const newZones: Record<ZoneId, ZoneItem[]> = { top: [], bottom: [], accessories: [] };
          for (const oi of outfit.items) {
            const item = lookup.get(oi.wardrobeItemId);
            if (item && oi.category in newZones) {
              newZones[oi.category as ZoneId].push({ instanceId: oi.instanceId, item });
            }
          }
          setZones(newZones);
        }
      }
    }
    load();
  }, []);

  function onPickerDragStart(e: React.DragEvent, itemId: string) {
    e.dataTransfer.setData("type", "new");
    e.dataTransfer.setData("itemId", itemId);
    e.dataTransfer.effectAllowed = "copy";
  }

  function onZoneItemDragStart(e: React.DragEvent, fromZone: ZoneId, instanceId: string) {
    e.stopPropagation();
    e.dataTransfer.setData("type", "move");
    e.dataTransfer.setData("fromZone", fromZone);
    e.dataTransfer.setData("instanceId", instanceId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleZoneDrop(e: React.DragEvent, toZone: ZoneId) {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData("type");

    if (type === "new") {
      const itemId = e.dataTransfer.getData("itemId");
      const item = allItems.find((i) => i.id === itemId);
      if (!item) return;
      setZones((prev) => ({
        ...prev,
        [toZone]: [...prev[toZone], { instanceId: crypto.randomUUID(), item }],
      }));
    } else if (type === "move") {
      const fromZone = e.dataTransfer.getData("fromZone") as ZoneId;
      const instanceId = e.dataTransfer.getData("instanceId");
      setZones((prev) => {
        const movedItem = prev[fromZone].find((zi) => zi.instanceId === instanceId);
        if (!movedItem) return prev;
        return {
          ...prev,
          [fromZone]: prev[fromZone].filter((zi) => zi.instanceId !== instanceId),
          [toZone]: [...prev[toZone], movedItem],
        };
      });
    }
  }

  function removeFromZone(zoneId: ZoneId, instanceId: string) {
    setZones((prev) => ({
      ...prev,
      [zoneId]: prev[zoneId].filter((zi) => zi.instanceId !== instanceId),
    }));
  }

  const pickerItems = allItems
    .filter((i) => pickerFilter === "all" || i.source === pickerFilter)
    .filter((i) => pickerCategory === "all" || i.category === pickerCategory);
  const totalItems = Object.values(zones).reduce((n, arr) => n + arr.length, 0);

  function handleSave() {
    if (!outfitName.trim() || totalItems === 0) return;
    const items = (Object.entries(zones) as [ZoneId, ZoneItem[]][]).flatMap(([zoneId, zis]) =>
      zis.map((zi) => ({
        instanceId: zi.instanceId,
        wardrobeItemId: zi.item.id,
        category: zoneId,
        x: 0,
        y: 0,
      }))
    );
    const existing = loadOutfits();
    if (editingId) {
      saveOutfits(existing.map((o) =>
        o.id === editingId
          ? { ...o, name: outfitName.trim(), tag: outfitTag || undefined, items }
          : o
      ));
    } else {
      saveOutfits([
        { id: crypto.randomUUID(), name: outfitName.trim(), tag: outfitTag || undefined, items, createdAt: Date.now() },
        ...existing,
      ]);
    }
    setEditingId(null);
    setIsSaving(false);
    setOutfitName("");
    setOutfitTag("");
    setZones(EMPTY_ZONES);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <main className="h-screen flex flex-col bg-[#FAF8F4] overflow-hidden">

      {/* Nav */}
      <nav className="shrink-0 px-8 py-5 flex items-center justify-between border-b border-[#E2DDD6]">
        <Link
          href="/"
          className="text-[#1E1E1E] tracking-widest text-sm uppercase"
          style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.2em" }}
        >
          Seam
        </Link>
      </nav>

      {/* Tabs */}
      <div className="shrink-0 px-8 flex items-center gap-6 border-b border-[#E2DDD6]">
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
        <Link
          href="/outfits/saved"
          className="pb-3 pt-4 text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Saved Outfits
        </Link>
        <span
          className="pb-3 pt-4 text-sm text-[#1E1E1E] relative"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Build
          <span className="absolute bottom-0 left-0 right-0 h-px bg-[#1E1E1E]" />
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">

        {/* Left panel */}
        <div className="w-1/4 shrink-0 border-r border-[#D8D3CC] bg-[#F0EBE3] flex flex-col min-h-0">
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#E2DDD6]">
            <p
              className="text-[9px] uppercase text-[#B8B3AC] mb-2.5"
              style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.1em" }}
            >
              Pieces
            </p>
            <div className="flex items-center gap-2">
              <PickerDropdown
                label="List"
                value={pickerFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "wardrobe", label: "Wardrobe" },
                  { value: "wishlist", label: "Wishlist" },
                ]}
                onChange={(v) => setPickerFilter(v as typeof pickerFilter)}
              />
              <PickerDropdown
                label="Category"
                value={pickerCategory}
                options={[
                  { value: "all", label: "All" },
                  ...PICKER_CATEGORIES.map((c) => ({ value: c, label: c })),
                ]}
                onChange={(v) => setPickerCategory(v as typeof pickerCategory)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4">
            <div className="grid grid-cols-2 gap-1.5 pt-3">
              {pickerItems.map((item) => (
                <ItemPickerCard key={item.id} item={item} onDragStart={onPickerDragStart} />
              ))}
              {pickerItems.length === 0 && (
                <p
                  className="col-span-2 text-xs text-[#C8B89A] pt-1"
                  style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300 }}
                >
                  {allItems.length === 0 ? "Add items first." : "No items here."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right — zone builder */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Toolbar */}
          <div className="shrink-0 px-6 py-3 flex items-start justify-between gap-4 border-b border-[#E2DDD6]">
            <p
              className="text-xs text-[#C8B89A] mt-1.5"
              style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontStyle: "italic" }}
            >
              Drag pieces to build an outfit.
            </p>
            <div className="flex flex-col items-end gap-1.5">
              {saved && (
                <span className="flex items-center gap-1 text-xs text-[#8A847C]" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  <Check size={11} /> Saved
                </span>
              )}
              {isSaving ? (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={outfitName}
                      onChange={(e) => setOutfitName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setIsSaving(false); setOutfitTag(""); setEditingId(null); setZones(EMPTY_ZONES); } }}
                      placeholder="Name this outfit…"
                      className="px-3 py-1.5 bg-white border border-[#E2DDD6] text-xs text-[#1E1E1E] placeholder-[#C8B89A] outline-none focus:border-[#B8B3AC] transition-colors w-40"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    />
                    <button
                      onClick={handleSave}
                      disabled={!outfitName.trim()}
                      className="px-3.5 py-1.5 bg-[#1E1E1E] text-[#FAF8F4] text-xs hover:bg-[#3A3530] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setIsSaving(false); setOutfitTag(""); setEditingId(null); setZones(EMPTY_ZONES); }}
                      className="px-3.5 py-1.5 text-xs border border-[#E2DDD6] text-[#8A847C] hover:border-[#B8B3AC] hover:text-[#1E1E1E] transition-colors"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {OUTFIT_TAGS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setOutfitTag(outfitTag === t ? "" : t)}
                        className={`px-2.5 py-1 rounded-full text-[10px] transition-all border ${
                          outfitTag === t
                            ? "border-[#3A3530] text-[#1E1E1E]"
                            : "border-transparent text-[#8A847C] hover:border-[#C8C3BC] hover:text-[#1E1E1E]"
                        }`}
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setIsSaving(true)}
                  disabled={totalItems === 0}
                  className="px-4 py-1.5 bg-[#1E1E1E] text-[#FAF8F4] text-xs hover:bg-[#3A3530] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  Save outfit
                </button>
              )}
            </div>
          </div>

          {/* Three zones — fill remaining height, no scroll */}
          <div className="flex-1 min-h-0 flex flex-col gap-0.5 px-4 py-2">
            {ZONES.map((zone) => (
              <DropZone
                key={zone.id}
                zoneId={zone.id}
                header={zone.header}
                subLabel={zone.subLabel}
                items={zones[zone.id]}
                onDrop={(e) => handleZoneDrop(e, zone.id)}
                onItemDragStart={onZoneItemDragStart}
                onRemove={(instanceId) => removeFromZone(zone.id, instanceId)}
              />
            ))}
          </div>

        </div>
      </div>
    </main>
  );
}

// ── Picker dropdown ───────────────────────────────────────────────────────────

function PickerDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value)!;
  const isFiltered = value !== "all";

  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={ref} className="relative flex-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-1 px-2 py-1 text-[10px] transition-colors border-b ${
          isFiltered
            ? "border-[#3A3530] text-[#1E1E1E]"
            : "border-[#D8D3CC] text-[#8A847C] hover:text-[#1E1E1E] hover:border-[#B8B3AC]"
        }`}
        style={{ fontFamily: "var(--font-dm-sans)" }}
      >
        <span className="truncate">{isFiltered ? current.label : label}</span>
        <ChevronDown size={9} className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white border border-[#E2DDD6] shadow-sm overflow-hidden z-30">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-2.5 py-1.5 text-[10px] transition-colors ${
                opt.value === value
                  ? "text-[#1E1E1E] bg-[#F0EBE3]"
                  : "text-[#8A847C] hover:text-[#1E1E1E] hover:bg-[#F7F4F0]"
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

// ── Item picker card ──────────────────────────────────────────────────────────

function ItemPickerCard({
  item,
  onDragStart,
}: {
  item: TaggedItem;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      className="cursor-grab active:cursor-grabbing select-none"
    >
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-[#F0EBE3] mb-0.5 hover:opacity-80 transition-opacity">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-[#E2DDD6] opacity-70" />
          </div>
        )}
        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-white/75 flex items-center justify-center">
          {item.source === "wardrobe"
            ? <Shirt size={7} className="text-[#8A847C]" />
            : <Bookmark size={7} className="text-[#8A847C]" />}
        </div>
      </div>
      <p className="text-[8px] text-[#8A847C] truncate leading-tight" style={{ fontFamily: "var(--font-dm-sans)" }}>
        {item.name}
      </p>
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({
  zoneId,
  header,
  subLabel,
  items,
  onDrop,
  onItemDragStart,
  onRemove,
}: {
  zoneId: ZoneId;
  header: string;
  subLabel: string;
  items: ZoneItem[];
  onDrop: (e: React.DragEvent) => void;
  onItemDragStart: (e: React.DragEvent, fromZone: ZoneId, instanceId: string) => void;
  onRemove: (instanceId: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ minHeight: 0 }}>
      {/* Drop area with header inside */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
        }}
        onDrop={(e) => { setIsDragOver(false); onDrop(e); }}
        className={`flex-1 min-h-0 rounded-lg border border-dashed transition-all duration-150 flex flex-col ${
          isDragOver ? "border-[#8A847C] bg-[#F0EBE3]" : "border-[#D8D3CC] hover:border-[#B8B3AC]"
        }`}
      >
        {/* Zone label */}
        <div className="shrink-0 flex items-baseline gap-2 px-3 pt-2 pb-1">
          <p className="text-xs text-[#1E1E1E]" style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}>
            {header}
          </p>
          <p className="text-[9px] text-[#B8B3AC]" style={{ fontFamily: "var(--font-dm-sans)" }}>
            {subLabel}
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex-1 min-h-0 flex items-center gap-2 px-3 pb-2 overflow-x-auto">
            {items.map((zi) => (
              <ZoneItemCard
                key={zi.instanceId}
                zi={zi}
                zoneId={zoneId}
                onDragStart={onItemDragStart}
                onRemove={() => onRemove(zi.instanceId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Zone item card ────────────────────────────────────────────────────────────

function ZoneItemCard({
  zi,
  zoneId,
  onDragStart,
  onRemove,
}: {
  zi: ZoneItem;
  zoneId: ZoneId;
  onDragStart: (e: React.DragEvent, fromZone: ZoneId, instanceId: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, zoneId, zi.instanceId)}
      className="relative shrink-0 h-full group cursor-grab active:cursor-grabbing select-none"
    >
      <div className="h-full aspect-[3/4] rounded-lg overflow-hidden bg-[#F0EBE3]">
        {zi.item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={zi.item.image}
            alt={zi.item.name}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-[#E2DDD6] opacity-70" />
          </div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute top-1.5 right-1.5 w-5 h-5 bg-[#1E1E1E]/60 text-[#FAF8F4] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#1E1E1E]"
      >
        <X size={9} />
      </button>
    </div>
  );
}
