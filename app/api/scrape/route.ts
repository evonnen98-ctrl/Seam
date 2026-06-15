import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { inferCategory } from "@/lib/categorize";
import { toUSD } from "@/lib/currency";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Single-brand retailers: the brand IS the store
const SINGLE_BRAND_RETAILERS: Record<string, string> = {
  "zara.com": "Zara",
  "stories.com": "& Other Stories",
  "arket.com": "Arket",
  "cosstores.com": "COS",
  "cos.com": "COS",
  "hm.com": "H&M",
  "weekday.com": "Weekday",
  "monki.com": "Monki",
  "uniqlo.com": "Uniqlo",
  "mango.com": "Mango",
  "massimodutti.com": "Massimo Dutti",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  SEK: "kr",
  DKK: "kr",
  NOK: "kr",
  CHF: "CHF",
  JPY: "¥",
};

// Site-specific CSS selectors as last-resort fallback
const SITE_SELECTORS: Record<
  string,
  { name?: string; price?: string; image?: string }
> = {
  "net-a-porter.com": {
    name: 'h1[data-test="product-name"], h1[class*="product-name"]',
    price: '[data-test="full-price"], [class*="Price__value"]',
    image: 'img[class*="product-image__image"]',
  },
  "ssense.com": {
    name: 'h1[class*="ProductName"], h1.product-name',
    price: '[class*="ProductPrice"], [class*="product-price"]',
    image: 'img[class*="product-image"], .product-images img',
  },
  "zara.com": {
    name: "h1.product-detail-info__header-name",
    price:
      'span[class*="money-amount__main"], [class*="price-current__amount"]',
    image: 'img[class*="media-image__image"]',
  },
  "stories.com": {
    name: 'h1[class*="product-name"], .product-detail__name',
    price: '[class*="product-price"], [class*="price-value"]',
    image: '.product-detail__image img, .pdp-image img',
  },
  "arket.com": {
    name: 'h1[class*="product-name"], h1[class*="ProductName"]',
    price: '[class*="product-price"], [class*="Price"]',
    image: '.product-detail img, .pdp img',
  },
  "cosstores.com": {
    name: 'h1[class*="product-name"]',
    price: '[class*="product-price"]',
    image: ".product-detail__image img",
  },
  "matchesfashion.com": {
    name: 'h1[class*="product__title"], .product-title h1',
    price: '[class*="product__price"]',
    image: '.product__images img[class*="product__image"]',
  },
  "farfetch.com": {
    name: 'h1[class*="ProductName"], [data-testid="product-short-description"]',
    price: '[class*="PriceAmount"], [data-testid*="price"]',
    image: 'img[class*="ProductImage"]',
  },
  "mytheresa.com": {
    name: 'h1.product--title, [class*="product-title"]',
    price: '[class*="product--price"], [class*="price--current"]',
    image: '.product--images img',
  },
};

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function resolveUrl(src: string, baseUrl: string): string {
  if (!src) return "";
  if (src.startsWith("http")) return src;
  if (src.startsWith("//")) return "https:" + src;
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return src;
  }
}

function formatPrice(amount: string | number, currency = "AUD"): string {
  const num = parseFloat(String(amount));
  if (isNaN(num)) return String(amount);
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  return `${sym}${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)}`;
}

function extractJsonLd(
  $: cheerio.CheerioAPI
): Record<string, unknown> | null {
  let product: Record<string, unknown> | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (product) return;
    try {
      const raw = $(el).html() ?? "";
      const data = JSON.parse(raw);
      const candidates = Array.isArray(data) ? data : [data];

      for (const item of candidates) {
        if (item?.["@type"] === "Product") {
          product = item;
          return;
        }
        // Check @graph array
        if (Array.isArray(item?.["@graph"])) {
          const found = item["@graph"].find(
            (g: Record<string, unknown>) => g["@type"] === "Product"
          );
          if (found) {
            product = found;
            return;
          }
        }
      }
    } catch {
      // malformed JSON-LD — skip
    }
  });

  return product;
}

// Some Next.js-based retailers (Zara, etc.) embed all product data in __NEXT_DATA__
function extractNextData(
  $: cheerio.CheerioAPI
): Record<string, unknown> | null {
  const raw = $("script#__NEXT_DATA__").html();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Zara-specific: dig into __NEXT_DATA__ for product info
function parseZaraNextData(
  data: Record<string, unknown>
): Partial<ProductResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageProps = (data as any)?.props?.pageProps;
    const product = pageProps?.product ?? pageProps?.initialData?.product;
    if (!product) return {};

    const name: string = product.name ?? "";
    const rawCurrency: string = product.price?.currency ?? "USD";
    const rawAmount: number | null = product.price?.value != null ? product.price.value / 100 : null;
    const price = rawAmount != null ? formatPrice(rawAmount, rawCurrency) : "";
    const priceUSD = rawAmount != null ? toUSD(rawAmount, rawCurrency) : undefined;
    const image: string =
      product.detail?.colors?.[0]?.images?.[0]?.url ??
      product.images?.[0]?.url ??
      "";

    return { name, price, priceCurrency: rawCurrency, priceUSD, image, brand: "Zara" };
  } catch {
    return {};
  }
}

interface ProductResult {
  name: string;
  brand: string;
  price: string;
  priceCurrency: string;
  priceUSD: number;
  image: string;
  category: string;
  url: string;
}


export async function POST(request: NextRequest) {
  let url: string;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const domain = parsedUrl.hostname.replace("www.", "");

  // Fetch the page
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Page returned ${res.status}` },
        { status: 502 }
      );
    }

    html = await res.text();
  } catch {
    return NextResponse.json(
      { error: "Could not reach that URL. Try another link." },
      { status: 502 }
    );
  }

  const $ = cheerio.load(html);
  const result: Partial<ProductResult> = { url };

  // ── 1. JSON-LD Product schema ─────────────────────────────────────────────
  const jsonLd = extractJsonLd($);
  if (jsonLd) {
    result.name = String(jsonLd.name ?? "").trim() || undefined;

    // Brand
    const b = jsonLd.brand as Record<string, unknown> | string | undefined;
    if (typeof b === "object" && b?.name) {
      result.brand = String(b.name).trim();
    } else if (typeof b === "string" && b) {
      result.brand = b.trim();
    }

    // Price from offers (handles single offer and AggregateOffer)
    const offers = jsonLd.offers as Record<string, unknown> | undefined;
    if (offers) {
      const amount = offers.price ?? offers.lowPrice;
      const currency = String(offers.priceCurrency ?? "USD");
      if (amount != null) {
        const num = parseFloat(String(amount));
        result.price = formatPrice(amount as string | number, currency);
        result.priceCurrency = currency;
        if (!isNaN(num)) result.priceUSD = toUSD(num, currency);
      }
    }

    // Image
    const img = jsonLd.image;
    if (typeof img === "string") {
      result.image = resolveUrl(img, url);
    } else if (Array.isArray(img) && img.length > 0) {
      result.image = resolveUrl(String(img[0]), url);
    } else if (img && typeof img === "object") {
      result.image = resolveUrl(
        String((img as Record<string, unknown>).url ?? ""),
        url
      );
    }
  }

  // ── 2. __NEXT_DATA__ (Zara + other Next.js storefronts) ──────────────────
  if (!result.name || !result.price) {
    const nextData = extractNextData($);
    if (nextData) {
      const parsed =
        domain === "zara.com"
          ? parseZaraNextData(nextData)
          : {};

      result.name = result.name || parsed.name;
      result.price = result.price || parsed.price;
      result.priceCurrency = result.priceCurrency || parsed.priceCurrency;
      result.priceUSD = result.priceUSD ?? parsed.priceUSD;
      result.image = result.image || parsed.image;
    }
  }

  // ── 3. OpenGraph / Twitter Card meta tags ────────────────────────────────
  if (!result.name) {
    let title =
      $('meta[property="og:title"]').attr("content") ??
      $('meta[name="twitter:title"]').attr("content") ??
      $("title").text() ??
      "";
    // Strip trailing "| Brand" or "- Site name" suffixes
    title = title.replace(/\s*[\|–—-]\s*[^|–—-]{1,40}$/, "").trim();
    if (title) result.name = title;
  }

  if (!result.image) {
    const ogImg =
      $('meta[property="og:image"]').attr("content") ??
      $('meta[name="twitter:image"]').attr("content") ??
      "";
    if (ogImg) result.image = resolveUrl(ogImg, url);
  }

  if (!result.price) {
    const amount =
      $('meta[property="product:price:amount"]').attr("content") ??
      $('meta[property="og:price:amount"]').attr("content") ??
      "";
    const currency =
      $('meta[property="product:price:currency"]').attr("content") ??
      $('meta[property="og:price:currency"]').attr("content") ??
      "USD";
    if (amount) {
      const num = parseFloat(amount);
      result.price = formatPrice(amount, currency);
      result.priceCurrency = currency;
      if (!isNaN(num)) result.priceUSD = toUSD(num, currency);
    }
  }

  // ── 4. Site-specific CSS selectors ───────────────────────────────────────
  const selectors = SITE_SELECTORS[domain] ?? {};

  if (!result.name && selectors.name) {
    result.name = $(selectors.name).first().text().trim() || undefined;
  }
  if (!result.price && selectors.price) {
    result.price = $(selectors.price).first().text().trim() || undefined;
  }
  if (!result.image && selectors.image) {
    const el = $(selectors.image).first();
    const src =
      el.attr("src") ??
      el.attr("data-src") ??
      el.attr("data-lazy-src") ??
      el.attr("data-original") ??
      "";
    if (src) result.image = resolveUrl(src, url);
  }

  // ── 5. Brand fallback ────────────────────────────────────────────────────
  if (!result.brand) {
    result.brand =
      SINGLE_BRAND_RETAILERS[domain] ??
      domain
        .split(".")[0]
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── 6. Clean up name ─────────────────────────────────────────────────────
  if (result.name) {
    // Remove leading brand prefix if it appears (e.g. "COS Linen Shirt" → "Linen Shirt")
    if (result.brand && result.name.toLowerCase().startsWith(result.brand.toLowerCase() + " ")) {
      result.name = result.name.slice(result.brand.length).trim();
    }
    // Title-case if all caps
    if (result.name === result.name.toUpperCase() && result.name.length > 3) {
      result.name = result.name
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  if (!result.name) {
    return NextResponse.json(
      { error: "Could not extract product details from this page." },
      { status: 422 }
    );
  }

  // ── 7. Category inference ─────────────────────────────────────────────────
  result.category = inferCategory(result.name, result.brand, url);

  return NextResponse.json(result as ProductResult);
}
