export interface OutfitItem {
  instanceId: string;
  wardrobeItemId: string;
  category: string;
  x: number;
  y: number;
}

export const OUTFIT_TAGS = ["Casual", "Formal", "Going Out", "Weekend", "Work", "Workout"] as const;
export type OutfitTag = typeof OUTFIT_TAGS[number];

export interface Outfit {
  id: string;
  name: string;
  tag?: OutfitTag;
  items: OutfitItem[];
  createdAt: number;
}

const OUTFITS_KEY = "seam_outfits";

function load(): Outfit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OUTFITS_KEY);
    return raw ? (JSON.parse(raw) as Outfit[]) : [];
  } catch {
    return [];
  }
}

function save(outfits: Outfit[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OUTFITS_KEY, JSON.stringify(outfits));
  } catch {
    // quota exceeded — silently ignore
  }
}

export const loadOutfits = () => load();
export const saveOutfits = (outfits: Outfit[]) => save(outfits);
