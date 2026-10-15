/**
 * lib/events.ts — curated stock-content event calendar data (2026–2027).
 *
 * HONESTY RULES:
 * - Fixed civil/religious observances with known Gregorian dates: "verified".
 * - Dates computed by rule (e.g. US Thanksgiving = 4th Thursday of November,
 *   Easter via computus): "computed" (rule is deterministic and standard).
 * - Lunar / lunisolar observances where the exact local date varies
 *   (Eid, Diwali, Holi, Chinese New Year): "approximate" — user must confirm locally.
 * - Commercial demand is NEVER stated as fact; use "suggested" language.
 */

export type EventDateType = "verified" | "computed" | "approximate";

export interface StockEvent {
  id: string;
  name: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  dateType: EventDateType;
  dateNote?: string;
  region: string; // "Global" | "US" | "Bangladesh" | ...
  categories: string[];
  productionWindow: string; // e.g. "Upload 4–6 weeks before"
  contentSuggestions: string[];
  keywords: string[];
  commercialUses: string[];
  priority: "high" | "medium" | "low";
}

export const EVENT_CATEGORIES = [
  "Public holidays",
  "Seasonal",
  "Retail campaigns",
  "Food",
  "Environment",
  "Education",
  "Technology",
  "Business",
  "Culture",
] as const;

export const COUNTRIES = ["All", "Global", "United States", "Bangladesh", "United Kingdom", "India", "China"] as const;

// ---------- date math ----------
function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** nth weekday of month: weekday 0=Sun..6=Sat, n=1..5 (5 = last if n overflows) */
function nthWeekday(y: number, m: number, weekday: number, n: number): string {
  const first = new Date(y, m - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  let day = 1 + offset + (n - 1) * 7;
  const dim = new Date(y, m, 0).getDate();
  if (day > dim) day -= 7;
  return iso(y, m, day);
}

function lastWeekday(y: number, m: number, weekday: number): string {
  return nthWeekday(y, m, weekday, 5);
}

/** Easter Sunday (Western computus). */
function easterSunday(y: number): string {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, month, day);
}

function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

interface EventSeed {
  id: string;
  name: string;
  region: string;
  categories: string[];
  productionWindow: string;
  contentSuggestions: string[];
  keywords: string[];
  commercialUses: string[];
  priority: "high" | "medium" | "low";
  date: (y: number) => { date: string; type: EventDateType; note?: string };
}

const SEEDS: EventSeed[] = [
  {
    id: "new-year",
    name: "New Year's Day",
    region: "Global",
    categories: ["Public holidays", "Seasonal"],
    productionWindow: "Upload 6–8 weeks before (mid-Nov)",
    contentSuggestions: ["Fireworks over city skylines", "Champagne toast flat-lays", "New year resolution lifestyle scenes", "Calendar and goal-planning mockups"],
    keywords: ["new year", "fireworks", "celebration", "2027", "party", "countdown", "resolution", "festive"],
    commercialUses: ["Greeting cards", "Marketing campaigns", "Social media posts", "Website hero banners"],
    priority: "high",
    date: (y) => ({ date: iso(y, 1, 1), type: "verified" }),
  },
  {
    id: "valentines",
    name: "Valentine's Day",
    region: "Global",
    categories: ["Public holidays", "Retail campaigns", "Culture"],
    productionWindow: "Upload 5–7 weeks before (early Jan)",
    contentSuggestions: ["Romantic couple silhouettes", "Red roses and gift boxes", "Heart-shaped bokeh backgrounds", "Date-night restaurant scenes"],
    keywords: ["valentine", "love", "romance", "hearts", "roses", "couple", "gift", "red"],
    commercialUses: ["E-commerce promos", "Greeting cards", "Restaurant marketing", "Social campaigns"],
    priority: "high",
    date: (y) => ({ date: iso(y, 2, 14), type: "verified" }),
  },
  {
    id: "womens-day",
    name: "International Women's Day",
    region: "Global",
    categories: ["Culture", "Business"],
    productionWindow: "Upload 4–6 weeks before",
    contentSuggestions: ["Diverse professional women portraits", "Women in STEM workplaces", "Empowerment concept illustrations"],
    keywords: ["womens day", "empowerment", "diversity", "equality", "professional woman", "march 8"],
    commercialUses: ["Corporate campaigns", "Editorial", "NGO communications"],
    priority: "medium",
    date: (y) => ({ date: iso(y, 3, 8), type: "verified" }),
  },
  {
    id: "eid-fitr",
    name: "Eid al-Fitr",
    region: "Bangladesh",
    categories: ["Public holidays", "Culture"],
    productionWindow: "Upload 4–6 weeks before",
    contentSuggestions: ["Eid prayer gatherings", "Festive family meals", "Lantern and crescent decorations", "Traditional attire portraits"],
    keywords: ["eid", "eid mubarak", "ramadan", "muslim", "festival", "lantern", "prayer", "celebration"],
    commercialUses: ["Greeting cards", "Retail campaigns", "Editorial coverage"],
    priority: "high",
    date: (y) => ({
      date: y === 2026 ? "2026-03-20" : "2027-03-10",
      type: "approximate",
      note: "Lunar calendar — exact date depends on moon sighting. Confirm locally.",
    }),
  },
  {
    id: "pohela-boishakh",
    name: "Pohela Boishakh (Bengali New Year)",
    region: "Bangladesh",
    categories: ["Public holidays", "Culture"],
    productionWindow: "Upload 4–6 weeks before",
    contentSuggestions: ["Mangal Shobhajatra processions", "Traditional alpana art", "Panta-ilish festive food", "Red-white saree portraits"],
    keywords: ["pohela boishakh", "bengali new year", "bangladesh", "mangal shobhajatra", "alpana", "festival"],
    commercialUses: ["Editorial", "Cultural campaigns", "Tourism content"],
    priority: "medium",
    date: (y) => ({ date: iso(y, 4, 14), type: "verified" }),
  },
  {
    id: "earth-day",
    name: "Earth Day",
    region: "Global",
    categories: ["Environment"],
    productionWindow: "Upload 4–6 weeks before",
    contentSuggestions: ["Hands holding seedling", "Recycling and sustainability concepts", "Solar panels and wind turbines", "Forest conservation scenes"],
    keywords: ["earth day", "environment", "sustainability", "recycling", "green energy", "nature", "eco"],
    commercialUses: ["CSR campaigns", "Educational content", "NGO communications"],
    priority: "medium",
    date: (y) => ({ date: iso(y, 4, 22), type: "verified" }),
  },
  {
    id: "easter",
    name: "Easter Sunday",
    region: "Global",
    categories: ["Public holidays", "Culture", "Retail campaigns"],
    productionWindow: "Upload 5–7 weeks before",
    contentSuggestions: ["Decorated easter eggs", "Spring flower arrangements", "Family brunch tables", "Bunny and chick illustrations"],
    keywords: ["easter", "eggs", "spring", "bunny", "celebration", "flowers", "holiday"],
    commercialUses: ["Retail promos", "Greeting cards", "Food blogs"],
    priority: "medium",
    date: (y) => ({ date: easterSunday(y), type: "computed", note: "Western computus (Gregorian)." }),
  },
  {
    id: "eid-adha",
    name: "Eid al-Adha",
    region: "Bangladesh",
    categories: ["Public holidays", "Culture"],
    productionWindow: "Upload 4–6 weeks before",
    contentSuggestions: ["Festive prayer gatherings", "Traditional family feasts", "Decorative Islamic patterns"],
    keywords: ["eid al adha", "qurbani", "muslim festival", "prayer", "celebration"],
    commercialUses: ["Editorial", "Greeting content"],
    priority: "medium",
    date: (y) => ({
      date: y === 2026 ? "2026-05-27" : "2027-05-17",
      type: "approximate",
      note: "Lunar calendar — exact date depends on moon sighting. Confirm locally.",
    }),
  },
  {
    id: "independence-us",
    name: "US Independence Day",
    region: "United States",
    categories: ["Public holidays", "Culture"],
    productionWindow: "Upload 6–8 weeks before",
    contentSuggestions: ["Fireworks displays", "American flag concepts", "Summer BBQ gatherings", "Patriotic illustrations"],
    keywords: ["july 4th", "independence day", "fireworks", "usa", "flag", "patriotic", "summer"],
    commercialUses: ["Retail campaigns", "Editorial", "Social content"],
    priority: "high",
    date: (y) => ({ date: iso(y, 7, 4), type: "verified" }),
  },
  {
    id: "halloween",
    name: "Halloween",
    region: "Global",
    categories: ["Public holidays", "Retail campaigns", "Culture"],
    productionWindow: "Upload 6–8 weeks before (Sep)",
    contentSuggestions: ["Carved pumpkins", "Spooky haunted houses", "Costume party scenes", "Candy and treats flat-lays"],
    keywords: ["halloween", "pumpkin", "spooky", "costume", "october", "horror", "candy", "witch"],
    commercialUses: ["Retail promos", "Party invitations", "Social campaigns"],
    priority: "high",
    date: (y) => ({ date: iso(y, 10, 31), type: "verified" }),
  },
  {
    id: "diwali",
    name: "Diwali",
    region: "India",
    categories: ["Public holidays", "Culture"],
    productionWindow: "Upload 5–7 weeks before",
    contentSuggestions: ["Diya oil lamps", "Fireworks and rangoli", "Festive family celebrations", "Sweets and gift boxes"],
    keywords: ["diwali", "deepavali", "diya", "festival of lights", "india", "rangoli", "celebration"],
    commercialUses: ["Retail campaigns", "Greeting cards", "Editorial"],
    priority: "high",
    date: (y) => ({
      date: y === 2026 ? "2026-11-08" : "2027-10-29",
      type: "approximate",
      note: "Lunisolar calendar — confirm exact local date.",
    }),
  },
  {
    id: "thanksgiving-us",
    name: "US Thanksgiving",
    region: "United States",
    categories: ["Public holidays", "Food", "Retail campaigns"],
    productionWindow: "Upload 6–8 weeks before (Oct)",
    contentSuggestions: ["Roast turkey dinners", "Autumn harvest tables", "Family gathering scenes", "Gratitude concept illustrations"],
    keywords: ["thanksgiving", "turkey", "autumn", "harvest", "family dinner", "gratitude", "fall"],
    commercialUses: ["Food blogs", "Retail promos", "Greeting cards"],
    priority: "high",
    date: (y) => ({ date: nthWeekday(y, 11, 4, 4), type: "computed", note: "4th Thursday of November (US federal)." }),
  },
  {
    id: "black-friday",
    name: "Black Friday / Cyber Monday",
    region: "Global",
    categories: ["Retail campaigns", "Business"],
    productionWindow: "Upload 6–8 weeks before",
    contentSuggestions: ["Shopping sale concepts", "Discount tag illustrations", "E-commerce checkout scenes", "Crowded mall scenes"],
    keywords: ["black friday", "sale", "discount", "shopping", "cyber monday", "retail", "ecommerce"],
    commercialUses: ["Ad campaigns", "E-commerce banners", "Email marketing"],
    priority: "high",
    date: (y) => ({ date: addDays(nthWeekday(y, 11, 4, 4), 1), type: "computed", note: "Day after US Thanksgiving." }),
  },
  {
    id: "christmas",
    name: "Christmas Day",
    region: "Global",
    categories: ["Public holidays", "Retail campaigns", "Culture"],
    productionWindow: "Upload 8–10 weeks before (Oct)",
    contentSuggestions: ["Decorated christmas trees", "Gift boxes and wrapping", "Winter snow scenes", "Family celebration moments"],
    keywords: ["christmas", "xmas", "gifts", "tree", "winter", "santa", "holiday", "snow"],
    commercialUses: ["Retail campaigns", "Greeting cards", "Ad creatives"],
    priority: "high",
    date: (y) => ({ date: iso(y, 12, 25), type: "verified" }),
  },
  {
    id: "chinese-new-year",
    name: "Chinese New Year",
    region: "China",
    categories: ["Public holidays", "Culture"],
    productionWindow: "Upload 5–7 weeks before",
    contentSuggestions: ["Red lanterns", "Dragon dance", "Festive family reunions", "Zodiac animal illustrations"],
    keywords: ["chinese new year", "lunar new year", "lantern", "dragon", "red", "zodiac", "spring festival"],
    commercialUses: ["Retail campaigns", "Greeting content", "Editorial"],
    priority: "medium",
    date: (y) => ({
      date: y === 2026 ? "2026-02-17" : "2027-02-06",
      type: "approximate",
      note: "Lunisolar calendar — widely observed dates shown; confirm locally.",
    }),
  },
  {
    id: "back-to-school",
    name: "Back to School season",
    region: "Global",
    categories: ["Education", "Retail campaigns", "Seasonal"],
    productionWindow: "Upload 6–8 weeks before (Jun–Jul)",
    contentSuggestions: ["School supplies flat-lays", "Students with backpacks", "Classroom scenes", "Study and stationery mockups"],
    keywords: ["back to school", "education", "students", "classroom", "stationery", "learning", "kids"],
    commercialUses: ["Retail promos", "EdTech marketing", "Editorial"],
    priority: "medium",
    date: (y) => ({ date: iso(y, 8, 15), type: "approximate", note: "Seasonal window, not a single date — Aug/Sep start varies by country." }),
  },
  {
    id: "world-cup-2026",
    name: "FIFA World Cup 2026",
    region: "Global",
    categories: ["Culture", "Business"],
    productionWindow: "Upload 8–12 weeks before kickoff",
    contentSuggestions: ["Stadium atmospheres", "Soccer ball close-ups", "Fans celebrating", "Sports training concepts"],
    keywords: ["world cup", "soccer", "football", "stadium", "fans", "sport", "2026"],
    commercialUses: ["Editorial", "Sports marketing", "Social content"],
    priority: "high",
    date: (y) => (y === 2026
      ? { date: "2026-06-11", type: "verified" as EventDateType, note: "Opening match date (FIFA)." }
      : { date: "2027-06-01", type: "approximate" as EventDateType, note: "No tournament in 2027 — off-season sports content window." }),
  },
  {
    id: "summer-travel",
    name: "Summer travel season",
    region: "Global",
    categories: ["Seasonal", "Business"],
    productionWindow: "Upload 8–10 weeks before (Apr)",
    contentSuggestions: ["Beach and island scenes", "Traveler with luggage", "Landmark photography", "Road-trip lifestyle"],
    keywords: ["summer", "travel", "beach", "vacation", "tourism", "adventure", "holiday"],
    commercialUses: ["Travel marketing", "Airline campaigns", "Editorial"],
    priority: "high",
    date: (y) => ({ date: iso(y, 6, 1), type: "approximate", note: "Seasonal window (Northern Hemisphere)." }),
  },
  {
    id: "cybersecurity-month",
    name: "Cybersecurity Awareness Month",
    region: "Global",
    categories: ["Technology", "Business"],
    productionWindow: "Upload 4–6 weeks before",
    contentSuggestions: ["Padlock and shield concepts", "Hacker vs security illustrations", "Data protection dashboards", "Two-factor authentication mockups"],
    keywords: ["cybersecurity", "hacker", "data protection", "privacy", "lock", "network security", "technology"],
    commercialUses: ["B2B marketing", "SaaS content", "Editorial"],
    priority: "medium",
    date: (y) => ({ date: iso(y, 10, 1), type: "approximate", note: "Observed each October in many countries." }),
  },
  {
    id: "memorial-day",
    name: "US Memorial Day",
    region: "United States",
    categories: ["Public holidays"],
    productionWindow: "Upload 5–7 weeks before",
    contentSuggestions: ["American flags at memorials", "Summer kickoff BBQs", "Patriotic remembrance scenes"],
    keywords: ["memorial day", "usa", "flag", "remembrance", "may", "veterans"],
    commercialUses: ["Editorial", "Retail (summer sales)"],
    priority: "low",
    date: (y) => ({ date: lastWeekday(y, 5, 1), type: "computed", note: "Last Monday of May (US federal)." }),
  },
];

export function getEventsForYear(year: number): StockEvent[] {
  return SEEDS.map((s) => {
    const d = s.date(year);
    return {
      id: `${s.id}-${year}`,
      name: s.name,
      date: d.date,
      dateType: d.type,
      dateNote: d.note,
      region: s.region,
      categories: s.categories,
      productionWindow: s.productionWindow,
      contentSuggestions: s.contentSuggestions,
      keywords: s.keywords,
      commercialUses: s.commercialUses,
      priority: s.priority,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function filterEvents(
  events: StockEvent[],
  opts: { country?: string; category?: string; query?: string; favoritesOnly?: boolean; favoriteIds?: Set<string> },
): StockEvent[] {
  return events.filter((e) => {
    if (opts.country && opts.country !== "All" && e.region !== "Global" && e.region !== opts.country) return false;
    if (opts.category && opts.category !== "All" && !e.categories.includes(opts.category)) return false;
    if (opts.query) {
      const q = opts.query.toLowerCase();
      const hay = `${e.name} ${e.keywords.join(" ")} ${e.contentSuggestions.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (opts.favoritesOnly && !(opts.favoriteIds?.has(e.id))) return false;
    return true;
  });
}

export const DATE_TYPE_LABEL: Record<EventDateType, string> = {
  verified: "Verified date",
  computed: "Computed by rule",
  approximate: "Approximate — confirm locally",
};
