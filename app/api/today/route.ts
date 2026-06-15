import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { type WardrobeItem } from "@/lib/wardrobe";

const client = new Anthropic({ apiKey: process.env.SEAM_ANTHROPIC_API_KEY });

interface WeatherData {
  city: string;
  temp: number;
  condition: string;
  conditionCode: number;
}

export async function POST(request: NextRequest) {
  let body: {
    occasion: string;
    vibe: string;
    wardrobeItems: WardrobeItem[];
    weather?: WeatherData;
    pinnedIds?: string[];
    feedbackContext?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { occasion, vibe, wardrobeItems, weather, pinnedIds, feedbackContext } = body;

  if (wardrobeItems.length === 0) {
    return NextResponse.json({ error: "No wardrobe items available" }, { status: 400 });
  }

  const wardrobeList = wardrobeItems
    .map((w) => {
      const parts = [`ID:${w.id}`, w.name];
      if (w.brand) parts.push(`by ${w.brand}`);
      if (w.category) parts.push(`[${w.category}]`);
      return `• ${parts.join(" ")}`;
    })
    .join("\n");

  const weatherContext = weather
    ? `Current weather: ${weather.temp}°C, ${weather.condition} in ${weather.city}. Factor this into the outfit — suggest layers if cold (under 12°C), avoid suede or delicate fabrics if rainy, keep it light if warm (over 22°C).`
    : "";

  const pinnedItems = pinnedIds && pinnedIds.length > 0
    ? wardrobeItems.filter((w) => pinnedIds.includes(w.id))
    : [];

  const pinnedContext = pinnedItems.length > 0
    ? `The person specifically wants to wear: ${pinnedItems.map((w) => w.name).join(", ")}. Build the outfit around these pieces — they must be included in selectedIds.`
    : "";

  const prompt = `The person is dressing for: ${occasion}
Desired vibe: ${vibe}
${weatherContext ? `\n${weatherContext}` : ""}${pinnedContext ? `\n${pinnedContext}` : ""}${feedbackContext ? `\n\n${feedbackContext}` : ""}

Their wardrobe:
${wardrobeList}

Select 3–5 items that work together as a complete outfit for this occasion, vibe${weather ? ", and the weather" : ""}. Prioritise variety across categories (top + bottom + shoes + optional outerwear or accessory).${pinnedItems.length > 0 ? " The pinned items listed above must be included." : ""} Only use IDs that appear exactly in the wardrobe list above.

Respond with ONLY valid JSON in this exact format — no preamble, no explanation:
{"selectedIds":["id1","id2","id3"],"note":"• First bullet.\\n• Second bullet.\\n• Third bullet."}

The note field must contain exactly 2–3 bullet points using the • character, each on its own line separated by \\n. Each bullet is one short, direct sentence. Cover: (1) why this outfit works for the occasion and vibe, (2) how it accounts for the weather${weather ? "" : " if relevant"}, (3) one specific styling tip — e.g. how to wear it, what to tuck, layer, or swap. Tone: warm and honest, like a thoughtful friend. No preamble, no sign-off, no fashion-magazine language.`;


  let result: { selectedIds: string[]; note: string };
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system:
        "You are a thoughtful personal stylist who knows the person's wardrobe intimately. You suggest complete, wearable outfits — never just individual pieces. You consider practicality (weather, occasion) as much as aesthetics (vibe, style). When a person pins specific items, you build the outfit around those pieces first, then complement them. You speak warmly and specifically, never generically. You respond only with valid JSON, nothing else.",
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    const text = block.type === "text" ? block.text.trim() : "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("[today] No JSON found in response:", text);
      return NextResponse.json({ error: "Could not parse outfit suggestion" }, { status: 500 });
    }

    result = JSON.parse(match[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number }).status ?? 500;
    console.error("[today] Error:", status, message);
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(result);
}
