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

// Approximate fixed rates: 1 USD = X [currency]
export const RATES_FROM_USD: Record<string, number> = {
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

// Convert an amount from a given currency to USD
export function toUSD(amount: number, fromCurrency: string): number {
  const rate = RATES_FROM_USD[fromCurrency] ?? 1;
  return amount / rate;
}

// Convert a USD amount to a target currency
export function fromUSD(usdAmount: number, toCurrency: string): number {
  const rate = RATES_FROM_USD[toCurrency] ?? 1;
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
  if (typeof navigator === "undefined") return "USD";
  const locale = navigator.language ?? "";
  const region = locale.split("-")[1]?.toUpperCase() ?? "";
  if (region === "AU") return "AUD";
  if (region === "NZ") return "NZD";
  if (region === "GB") return "GBP";
  const eurRegions = ["DE","FR","IT","ES","NL","BE","AT","PT","IE","FI","LU","GR","SK","SI","EE","LV","LT","CY","MT"];
  if (eurRegions.includes(region)) return "EUR";
  return "USD";
}

export function loadCurrencyPreference(): CurrencyCode {
  if (typeof window === "undefined") return "USD";
  const saved = localStorage.getItem(PREF_KEY);
  if (saved && CURRENCIES.some((c) => c.code === saved)) return saved as CurrencyCode;
  const detected = detectDefaultCurrency();
  localStorage.setItem(PREF_KEY, detected);
  return detected;
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
