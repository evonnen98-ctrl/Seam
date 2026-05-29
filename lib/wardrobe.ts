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
  };
}

function itemToRow(item: WardrobeItem, list: "wardrobe" | "wishlist"): DbRow {
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
    .eq("list", "wardrobe");
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
    .eq("list", "wishlist");
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
