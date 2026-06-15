import { supabase } from "./supabase";

export interface WardrobeItem {
  id: string;
  type: "url" | "photo";
  name: string;
  brand?: string;
  price?: string;
  priceCurrency?: string; // local-only: not stored in DB
  priceUSD?: number;      // local-only: not stored in DB
  image?: string;
  url?: string;
  fileName?: string;      // local-only: not stored in DB
  category?: string;
  createdAt?: number;     // local-only: not stored in DB
  wornCount?: number;
  lastWorn?: string;      // ISO date string
}

// Shape of a row in the `items` table
interface DbRow {
  id: string;
  name: string;
  brand: string | null;
  price: string | null;
  category: string | null;
  image: string | null;
  list: string;
  url: string | null;
  created_at?: string | null;
  worn_count?: number | null;
  last_worn?: string | null;
}

function rowToItem(row: DbRow): WardrobeItem {
  return {
    id: row.id,
    type: "url",
    name: row.name,
    brand: row.brand ?? undefined,
    price: row.price ?? undefined,
    category: row.category ?? undefined,
    image: row.image ?? undefined,
    url: row.url ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
    wornCount: row.worn_count ?? 0,
    lastWorn: row.last_worn ?? undefined,
  };
}

function itemToRow(item: WardrobeItem, list: "wardrobe" | "wishlist"): DbRow {
  // worn_count and last_worn are NOT included here — they are append-only,
  // managed exclusively by logWear() to prevent saves from overwriting wear history.
  return {
    id: item.id,
    name: item.name,
    brand: item.brand ?? null,
    price: item.price ?? null,
    category: item.category ?? null,
    image: item.image ?? null,
    list,
    url: item.url ?? null,
  };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function fetchItems(): Promise<WardrobeItem[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("list", "wardrobe")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[wardrobe] fetchItems:", error.message);
    return [];
  }
  return (data as DbRow[]).map(rowToItem);
}

export async function fetchWishlist(): Promise<WardrobeItem[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("list", "wishlist")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[wardrobe] fetchWishlist:", error.message);
    return [];
  }
  return (data as DbRow[]).map(rowToItem);
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Insert or update a single item. */
export async function upsertItem(
  item: WardrobeItem,
  list: "wardrobe" | "wishlist"
): Promise<void> {
  const { error } = await supabase
    .from("items")
    .upsert(itemToRow(item, list), { onConflict: "id" });
  if (error) console.error("[wardrobe] upsertItem:", error.message);
}

/** Bulk upsert — used by onboarding. */
export async function upsertItems(
  items: WardrobeItem[],
  list: "wardrobe" | "wishlist"
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase
    .from("items")
    .upsert(items.map((i) => itemToRow(i, list)), { onConflict: "id" });
  if (error) console.error("[wardrobe] upsertItems:", error.message);
}

/** Delete a single item by id. */
export async function deleteItemById(id: string): Promise<void> {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) console.error("[wardrobe] deleteItemById:", error.message);
}

/** Increment worn count and set last_worn to now. */
export async function logWear(id: string): Promise<void> {
  const { error } = await supabase.rpc("increment_worn_count", { item_id: id });
  if (error) {
    // Fallback: fetch current count and manually increment
    const { data } = await supabase.from("items").select("worn_count").eq("id", id).single();
    const newCount = ((data as { worn_count: number | null })?.worn_count ?? 0) + 1;
    const { error: e2 } = await supabase
      .from("items")
      .update({ worn_count: newCount, last_worn: new Date().toISOString() })
      .eq("id", id);
    if (e2) console.error("[wardrobe] logWear:", e2.message);
  }
}

/** Move an item to a different list (wardrobe ↔ wishlist). */
export async function moveItemToList(
  id: string,
  list: "wardrobe" | "wishlist"
): Promise<void> {
  const { error } = await supabase
    .from("items")
    .update({ list })
    .eq("id", id);
  if (error) console.error("[wardrobe] moveItemToList:", error.message);
}
