import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { type WardrobeItem } from "@/lib/wardrobe";

export interface BuyAnalysis {
  verdict: "Worth it" | "Think twice" | "You've got this covered";
  reasons: string[];
  pairsWithIds: string[];
}

export async function POST(request: NextRequest) {
  let body: { item: Partial<WardrobeItem> & { name: string }; wardrobe: WardrobeItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { item, wardrobe } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server misconfiguration: API key not found." }, { status: 500 });
  }

  // Only wardrobe items (things they already own) are passed here — wishlist items are excluded
  const ownedList =
    wardrobe.length === 0
      ? "They don't own anything yet."
      : wardrobe
          .map(
            (w) =>
              `• id:"${w.id}" name:"${w.name}"${w.brand ? ` brand:"${w.brand}"` : ""}${w.category ? ` [${w.category}]` : ""}`
          )
          .join("\n");

  const prompt = `You are My Drobe — a trusted personal stylist who knows your client's wardrobe intimately. Your client is thinking about buying this item:

Name: ${item.name}
Brand: ${item.brand || "Unknown"}
Price: ${item.price || "Unknown"}
Category: ${item.category || "Unknown"}

Items they already own (wardrobe only — wishlist items are NOT included):
${ownedList}

Give your honest, warm take — like a best friend who happens to know fashion really well. Be specific: reference their actual owned pieces by name, not generically.

Respond ONLY with valid JSON in exactly this shape:
{
  "verdict": "Worth it" | "Think twice" | "You've got this covered",
  "reasons": ["one sentence", "one sentence", "one sentence"],
  "pairsWithIds": ["id1", "id2"]
}

Rules:
- "You've got this covered" → they already OWN something very similar (it must be in the list above); name it.
- "Worth it" → fills a real gap in what they own, or adds genuine versatility; explain why.
- "Think twice" → doesn't work well with what they own, or is redundant with something they already have; be honest.
- reasons: exactly 2–3 sentences. Each one specific, referencing their actual owned items by name where relevant.
- pairsWithIds: 2–4 item IDs from the owned list that would pair well with this new item. Empty array if they own nothing.
- Never use filler phrases. Never be generic. Never reference wishlist items as if they are owned.`;

  // Create client fresh each request — avoids module-load timing issues with env vars
  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse the analysis. Please try again." }, { status: 500 });
    }

    let analysis: BuyAnalysis;
    try {
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "Received malformed analysis. Please try again." }, { status: 500 });
    }

    return NextResponse.json(analysis);

  } catch (err) {
    const error = err as Error & { status?: number; error?: { type: string; message: string } };
    console.error("[should-i-buy] Claude API error:", {
      type: error?.constructor?.name,
      message: error?.message,
      status: error?.status,
      body: error?.error,
    });

    let userMessage = "Analysis failed. Please try again.";
    if (error?.status === 401) userMessage = "API key invalid — check server configuration.";
    else if (error?.status === 429) userMessage = "Rate limited — please wait a moment and try again.";
    else if (error?.status === 529 || error?.status === 503) userMessage = "Claude is overloaded right now — please try again shortly.";
    else if (error?.message?.includes("timed out") || error?.message?.includes("timeout")) userMessage = "Request timed out — please try again.";
    else if (error?.message?.includes("fetch") || error?.message?.includes("ECONNREFUSED")) userMessage = "Could not reach Claude — check your connection.";
    else if (error?.message) userMessage = `Analysis failed: ${error.message}`;

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
