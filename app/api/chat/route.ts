import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { type WardrobeItem } from "@/lib/wardrobe";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are My Drobe — a personal stylist with an intimate knowledge of your client's wardrobe. You give calm, considered, editorial advice: the kind you'd receive from a trusted stylist at a quiet, well-curated boutique. You speak with quiet authority. You are never generic, never effusive. You do not use filler phrases like "Great question!" or "Absolutely!". You do not list bullet points unless directly asked. You respond in 2–4 sentences.

When referencing the wardrobe, be specific — name the pieces. When you don't have enough to go on, ask one precise question rather than speculating broadly.`;

function formatWardrobe(items: WardrobeItem[]): string {
  if (items.length === 0) return "The wardrobe is currently empty.";
  return items
    .map((item) => {
      const parts: string[] = [item.name];
      if (item.brand) parts.push(`by ${item.brand}`);
      if (item.price) parts.push(`— ${item.price}`);
      if (item.category) parts.push(`[${item.category}]`);
      return `• ${parts.join(" ")}`;
    })
    .join("\n");
}

export async function POST(request: NextRequest) {
  console.log("[chat] ANTHROPIC_API_KEY present:", !!process.env.ANTHROPIC_API_KEY);
  let body: {
    message: string;
    history: { role: "user" | "assistant"; text: string }[];
    wardrobe: WardrobeItem[];
  };

  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const { message, history, wardrobe } = body;

  if (!message?.trim()) {
    return new Response("Message is required", { status: 400 });
  }

  const wardrobeSection = `The client's current wardrobe:\n${formatWardrobe(wardrobe)}`;

  const messages: Anthropic.MessageParam[] = [
    // Inject wardrobe context as the first user/assistant exchange so it's
    // always present but doesn't crowd the visible conversation history.
    {
      role: "user",
      content: wardrobeSection,
    },
    {
      role: "assistant",
      content:
        "Understood. I have a clear picture of the wardrobe. What would you like to explore?",
    },
    // Real conversation history
    ...history.map(({ role, text }) => ({
      role,
      content: text,
    })),
    // Current message
    { role: "user", content: message.trim() },
  ];

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
