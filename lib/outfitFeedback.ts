export interface OutfitFeedback {
  selectedIds: string[];
  itemNames: string[]; // human-readable names for the Claude prompt
  occasion: string;
  vibe: string;
  feedback: "love" | "dismiss";
  timestamp: number;
}

const FEEDBACK_KEY = "seam_outfit_feedback";
const MAX_ENTRIES = 40;

export function loadFeedback(): OutfitFeedback[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    return raw ? (JSON.parse(raw) as OutfitFeedback[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: OutfitFeedback[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries));
  } catch {
    // quota exceeded — silently ignore
  }
}

// Returns an outfit's deduplication key
function outfitKey(selectedIds: string[], occasion: string, vibe: string): string {
  return [...selectedIds].sort().join("|") + "|" + occasion + "|" + vibe;
}

export function addFeedback(
  selectedIds: string[],
  itemNames: string[],
  occasion: string,
  vibe: string,
  feedback: "love" | "dismiss"
): OutfitFeedback[] {
  const existing = loadFeedback();
  const key = outfitKey(selectedIds, occasion, vibe);
  // Remove any prior feedback for this exact outfit+context before adding the new one
  const filtered = existing.filter(
    (e) => outfitKey(e.selectedIds, e.occasion, e.vibe) !== key
  );
  const entry: OutfitFeedback = {
    selectedIds,
    itemNames,
    occasion,
    vibe,
    feedback,
    timestamp: Date.now(),
  };
  const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
  persist(next);
  return next;
}

// Builds a concise feedback context string to inject into the Claude prompt
export function getFeedbackContext(history: OutfitFeedback[]): string {
  if (history.length === 0) return "";

  const loved = history.filter((e) => e.feedback === "love").slice(0, 12);
  const dismissed = history.filter((e) => e.feedback === "dismiss").slice(0, 12);

  const lines: string[] = [];

  if (loved.length > 0) {
    const list = loved
      .map((e) => `${e.itemNames.join(" + ")} (${e.occasion}, ${e.vibe})`)
      .join("; ");
    lines.push(`Loved: ${list}`);
  }

  if (dismissed.length > 0) {
    const list = dismissed
      .map((e) => `${e.itemNames.join(" + ")} (${e.occasion}, ${e.vibe})`)
      .join("; ");
    lines.push(`Dismissed: ${list}`);
  }

  return (
    `This user has rated previous outfit suggestions:\n${lines.join("\n")}\n` +
    `Use this to inform your suggestion — lean toward combinations similar to loved outfits and avoid repeating dismissed ones for the same occasion and vibe.`
  );
}
