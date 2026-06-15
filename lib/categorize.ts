// Ordered by specificity — first match wins.
const CATEGORY_RULES: Array<{ category: string; pattern: RegExp }> = [
  {
    category: "Outerwear",
    pattern: /\b(coat|jacket|blazer|vest|gilet|parka|trench|puffer|anorak)\b/i,
  },
  {
    category: "Dresses",
    pattern: /\b(dress|gown|midi|maxi|jumpsuit|playsuit|romper)\b/i,
  },
  {
    category: "Bottoms",
    pattern: /\b(bottom|pants|trousers|jeans|skirt|shorts|short|leggings|tights|culottes|chinos|mini)\b/i,
  },
  {
    category: "Tops",
    pattern: /\b(top|shirt|blouse|tee|tank|cami|corset|bustier|crop|cardigan|jumper|sweater|hoodie|sweatshirt|polo|knit|knitwear|turtleneck|pullover|wool)\b/i,
  },
  {
    category: "Shoes",
    pattern: /\b(shoe|shoes|boot|boots|sneaker|sneakers|heel|heels|loafer|loafers|sandal|sandals|mule|mules|flat|flats|pump|pumps|slingback|wedge)\b/i,
  },
  {
    category: "Accessories",
    pattern: /\b(belt|scarf|hat|cap|sunglasses|glasses|jewellery|jewelry|necklace|ring|earring|bracelet|watch|bag|bags|tote|clutch|crossbody|handbag|purse|backpack|pouch)\b/i,
  },
];

export function inferCategory(name: string, brand?: string, url?: string): string {
  const corpus = [name, brand ?? "", url ?? ""].join(" ");
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(corpus)) return rule.category;
  }
  return "Other";
}
