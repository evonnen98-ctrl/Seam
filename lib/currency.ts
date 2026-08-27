export const CURRENCIES = [
  { code: "AUD", symbol: "A$",  label: "Australian Dollar" },
  { code: "USD", symbol: "$",   label: "US Dollar" },
  { code: "GBP", symbol: "£",   label: "British Pound" },
  { code: "EUR", symbol: "€",   label: "Euro" },
  { code: "NZD", symbol: "NZ$", label: "New Zealand Dollar" },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]["code"];

// Full symbol map including currencies encountered during scraping
export const CURRENCY_SYMBOL: Record<string, string> = {
  AUD: "A$", USD: "$", GBP: "£", EUR: "€", NZD: "NZ$",
  CAD: "CA$", CHF: "CHF", JPY: "¥", SEK: "kr", DKK: "kr", NOK: "kr",
};

// Safety-net rates used until the first live fetch resolves, and whenever the
// live fetch fails. 1 USD = X [currency].
const FALLBACK_RATES_FROM_USD: Record<string, number> = {
  USD: 1.00,
  AUD: 1.55,
  GBP: 0.79,
  EUR: 0.92,
  NZD: 1.68,
  CAD: 1.36,
  CHF: 0.89,
  JPY: 149.0,
  SEK: 10.3,
  DKK: 6.9,
  NOK: 10.5,
};

const RATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FRANKFURTER_SYMBOLS = Object.keys(FALLBACK_RATES_FROM_USD)
  .filter((code) => code !== "USD")
  .join(",");
const FRANKFURTER_URL = `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${FRANKFURTER_SYMBOLS}`;

let ratesCache: Record<string, number> = { ...FALLBACK_RATES_FROM_USD };
let lastFetchAttemptAt = 0;
let pendingFetch: Promise<void> | null = null;

// Kicks off a background refresh when the cache is stale. Never awaited by
// callers — toUSD/fromUSD stay synchronous and just read whatever is cached.
function refreshRatesIfStale(): void {
  if (Date.now() - lastFetchAttemptAt < RATE_CACHE_TTL_MS || pendingFetch) return;

  pendingFetch = fetch(FRANKFURTER_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Frankfurter API responded ${res.status}`);
      return res.json() as Promise<{ rates: Record<string, number> }>;
    })
    .then(({ rates }) => {
      ratesCache = { USD: 1.00, ...rates };
    })
    .catch((err) => {
      console.error("Failed to fetch live exchange rates, using fallback rates:", err);
    })
    .finally(() => {
      lastFetchAttemptAt = Date.now();
      pendingFetch = null;
    });
}

// Convert an amount from a given currency to USD
export function toUSD(amount: number, fromCurrency: string): number {
  refreshRatesIfStale();
  const rate = ratesCache[fromCurrency] ?? 1;
  return amount / rate;
}

// Convert a USD amount to a target currency
export function fromUSD(usdAmount: number, toCurrency: string): number {
  refreshRatesIfStale();
  const rate = ratesCache[toCurrency] ?? 1;
  return usdAmount * rate;
}

// Format a USD value into the target currency display string
export function displayPrice(priceUSD: number, toCurrency: string): string {
  const converted = fromUSD(priceUSD, toCurrency);
  return formatPriceAmount(converted, toCurrency);
}

// Derive a USD amount from a WardrobeItem's price fields (handles legacy items without priceUSD)
export function itemPriceUSD(
  price?: string,
  priceCurrency?: string,
  priceUSD?: number
): number | null {
  if (priceUSD != null) return priceUSD;
  const amount = parsePriceAmount(price);
  if (amount === null) return null;
  const currency = priceCurrency ?? detectPriceCurrency(price) ?? "USD";
  return toUSD(amount, currency);
}

const PREF_KEY = "seam_currency";

export function detectDefaultCurrency(): CurrencyCode {
  return "AUD";
}

export function loadCurrencyPreference(): CurrencyCode {
  if (typeof window === "undefined") return "AUD";
  const saved = localStorage.getItem(PREF_KEY);
  if (saved === "GBP") {
    localStorage.setItem(PREF_KEY, "AUD");
    return "AUD";
  }
  if (saved && CURRENCIES.some((c) => c.code === saved)) return saved as CurrencyCode;
  localStorage.setItem(PREF_KEY, "AUD");
  return "AUD";
}

export function saveCurrencyPreference(code: CurrencyCode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREF_KEY, code);
}

export function getSymbol(code: string): string {
  return CURRENCY_SYMBOL[code] ?? code + " ";
}

// Format a numeric amount with a currency symbol
export function formatPriceAmount(amount: number, currencyCode: string): string {
  const sym = getSymbol(currencyCode);
  return `${sym}${Math.round(amount).toLocaleString("en-AU")}`;
}

// Parse the numeric value from a formatted price string like "A$120", "£95.50"
export function parsePriceAmount(price?: string): number | null {
  if (!price) return null;
  const n = parseFloat(price.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

// Try to detect the currency code from a price string's leading symbol
export function detectPriceCurrency(price?: string): string | null {
  if (!price) return null;
  const sym = price.trim().match(/^([^\d\s]+)/)?.[1];
  if (!sym) return null;
  // Match longest symbol first (e.g. "NZ$" before "$")
  const sorted = Object.entries(CURRENCY_SYMBOL).sort(([, a], [, b]) => b.length - a.length);
  for (const [code, s] of sorted) {
    if (sym === s) return code;
  }
  return null;
}
