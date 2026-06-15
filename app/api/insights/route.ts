import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { type WardrobeItem } from "@/lib/wardrobe";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  console.log("[insights] ANTHROPIC_API_KEY present:", !!process.env.ANTHROPIC_API_KEY);

  let body: { item: WardrobeItem; wardrobeItems: WardrobeItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { item, wardrobeItems } = body;

  const wardrobeList =
    wardrobeItems.length === 0
      ? "Their wardrobe is currently empty."
      : wardrobeItems
          .map((w) => {
            const parts = [`name:"${w.name}"`];
            if (w.brand) parts.push(`brand:"${w.brand}"`);
            if (w.category) parts.push(`category:"${w.category}"`);
            return `• ${parts.join(" ")}`;
          })
          .join("\n");

  const itemDesc = [
    `Name: ${item.name}`,
    item.brand    ? `Brand: ${item.brand}`       : null,
    item.price    ? `Price: ${item.price}`       : null,
    item.category ? `Category: ${item.category}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are advising someone who is considering buying this wishlist item:
${itemDesc}

Their current wardrobe:
${wardrobeList}

Respond with ONLY valid JSON in this exact format — no preamble, no explanation:
{"insights":["• Sentence one.","• Sentence two.","• Sentence three."],"outfitCombinations":[["Item Name A","Item Name B","Item Name C"],["Item Name D","Item Name E"]],"verdict":"Worth it","verdictReason":"One sentence explaining the verdict."}

Rules:
- "insights": exactly 2–3 bullet strings, each starting with "•". One sentence each, addressed to the person using "you". Cover: (1) whether they already own something similar, (2) whether this fills a real gap, (3) one styling or practical observation. Warm, honest, thoughtful-friend tone.
- "outfitCombinations": 2–3 mini outfits this wishlist item could be part of. Each outfit is an array of 2–3 item names from the wardrobe list that work together as a complete look WITH this wishlist item. For each item name, return ONLY the exact value of the name field (text inside quotes after name:) — do NOT include brand or category. If the wardrobe is empty or too sparse, return an empty array.
- "verdict": exactly one of these three strings — "Worth it", "Consider it", or "Think twice". Choose based on: "Worth it" if the piece pairs with many items and fills a genuine gap; "Think twice" if it only goes with 1–2 items or clearly duplicates something they already have; "Consider it" otherwise.
- "verdictReason": one concise sentence addressed to the person using "you" that explains the verdict — specific and honest, not generic.`;

  let result: {
    insights: string[];
    outfitCombinations: string[][];
    verdict: "Worth it" | "Consider it" | "Think twice";
    verdictReason: string;
  };

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system:
        "You are a warm, thoughtful best friend who knows fashion well. You're honest but never harsh or judgmental. You speak directly to the person using 'you'. You respond only with valid JSON, nothing else.",
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    const text = block.type === "text" ? block.text.trim() : "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("[insights] No JSON found in response:", text);
      return NextResponse.json({ error: "Could not parse insights" }, { status: 500 });
    }

    result = JSON.parse(match[0]);
    console.log("[insights] Success");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status  = (err as { status?: number }).status ?? 500;
    console.error("[insights] Anthropic error:", status, message);
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(result);
}
