/**
 * lib/metadata.ts — heuristic metadata generation engine (demo build).
 *
 * Everything here is computed on-device from statistical image analysis
 * (lib/image.ts) and marketplace profile rules. It is NOT AI, and nothing
 * here represents real marketplace performance, rankings, downloads or
 * revenue. All subjects, categories and concepts are heuristic suggestions
 * and must be reviewed by the contributor before submission.
 *
 * NOTE: profile limits are demo defaults — verify each platform's current
 * submission guidelines before uploading.
 */
import { nearestColorName, type ImageAnalysis } from "./image";
import type { UserPreferences } from "./db";

/* ------------------------------------------------------------------ */
/* Marketplace profiles                                                */
/* ------------------------------------------------------------------ */

export interface MarketplaceProfile {
  id: string;
  label: string;
  maxTitleWords: number;
  maxKeywords: number;
  keywordStyle: "single" | "mixed";
  notes: string;
}

export const MARKETPLACE_PROFILES: MarketplaceProfile[] = [
  {
    id: "adobe-stock",
    label: "Adobe Stock",
    maxTitleWords: 12,
    maxKeywords: 25,
    keywordStyle: "single",
    notes:
      "Demo defaults: lowercase single-word keywords, concise titles. Verify current submission guidelines before uploading.",
  },
  {
    id: "shutterstock",
    label: "Shutterstock",
    maxTitleWords: 20,
    maxKeywords: 50,
    keywordStyle: "mixed",
    notes:
      "Demo defaults: descriptive phrases allowed. Verify current submission guidelines before uploading.",
  },
  {
    id: "freepik",
    label: "Freepik",
    maxTitleWords: 20,
    maxKeywords: 30,
    keywordStyle: "mixed",
    notes:
      "Demo defaults: descriptive phrases allowed. Verify current submission guidelines before uploading.",
  },
  {
    id: "vecteezy",
    label: "Vecteezy",
    maxTitleWords: 15,
    maxKeywords: 50,
    keywordStyle: "mixed",
    notes: "Demo defaults. Verify current submission guidelines before uploading.",
  },
  {
    id: "dreamstime",
    label: "Dreamstime",
    maxTitleWords: 15,
    maxKeywords: 50,
    keywordStyle: "mixed",
    notes: "Demo defaults. Verify current submission guidelines before uploading.",
  },
  {
    id: "depositphotos",
    label: "Depositphotos",
    maxTitleWords: 15,
    maxKeywords: 50,
    keywordStyle: "mixed",
    notes: "Demo defaults. Verify current submission guidelines before uploading.",
  },
  {
    id: "123rf",
    label: "123RF",
    maxTitleWords: 12,
    maxKeywords: 50,
    keywordStyle: "single",
    notes:
      "Demo defaults: single-word keywords preferred. Verify current submission guidelines before uploading.",
  },
  {
    id: "generic-csv",
    label: "Generic CSV",
    maxTitleWords: 25,
    maxKeywords: 50,
    keywordStyle: "mixed",
    notes: "No platform caps — full metadata for CSV export.",
  },
];

export function profileFor(id: string): MarketplaceProfile {
  return MARKETPLACE_PROFILES.find((p) => p.id === id) ?? MARKETPLACE_PROFILES[0];
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface MetadataSettings {
  profileId: string;
  minTitleWords: number;
  maxTitleWords: number;
  minKeywords: number;
  maxKeywords: number;
  descriptionWords: number;
  singleWordMode: boolean;
  whiteBackground: boolean;
  transparentBackground: boolean;
  silhouetteMode: boolean;
  customInstructions: string;
  prohibitedWords: string; // comma-separated
}

export function defaultMetadataSettings(prefs: UserPreferences): MetadataSettings {
  return {
    profileId: prefs.defaultMarketplace,
    minTitleWords: prefs.minTitleWords,
    maxTitleWords: prefs.maxTitleWords,
    minKeywords: prefs.minKeywords,
    maxKeywords: prefs.maxKeywords,
    descriptionWords: prefs.descriptionWords,
    singleWordMode: prefs.singleWordKeywords,
    whiteBackground: false,
    transparentBackground: false,
    silhouetteMode: false,
    customInstructions: "",
    prohibitedWords: prefs.prohibitedWords,
  };
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const CONTENT_CATEGORIES = [
  "Nature",
  "Animals",
  "People",
  "Food",
  "Travel",
  "Technology",
  "Business",
  "Lifestyle",
  "Architecture",
  "Art",
  "Abstract",
  "Backgrounds",
  "Objects",
  "Science",
  "Sports",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

const CATEGORY_TERMS: Record<string, string[]> = {
  Nature: ["nature", "landscape", "natural", "outdoor", "scenic", "environment", "wilderness", "green", "earth", "serene", "organic", "fresh", "botanical", "ecology"],
  Animals: ["animal", "wildlife", "fauna", "creature", "pet", "mammal", "habitat", "species", "natural habitat", "wild", "fur", "countryside", "zoo", "conservation"],
  People: ["people", "person", "human", "portrait", "adult", "lifestyle", "emotion", "expression", "culture", "diversity", "community", "daily life", "candid", "character"],
  Food: ["food", "cuisine", "meal", "delicious", "fresh", "cooking", "ingredient", "recipe", "gourmet", "healthy", "nutrition", "dining", "tasty", "kitchen"],
  Travel: ["travel", "destination", "tourism", "journey", "vacation", "adventure", "landmark", "exploration", "wanderlust", "trip", "culture", "sightseeing", "holiday", "scenic"],
  Technology: ["technology", "digital", "innovation", "computer", "software", "data", "internet", "device", "future", "network", "electronic", "gadget", "artificial intelligence", "tech"],
  Business: ["business", "corporate", "office", "finance", "professional", "meeting", "success", "strategy", "teamwork", "entrepreneur", "growth", "management", "marketing", "economy"],
  Lifestyle: ["lifestyle", "leisure", "wellness", "relaxation", "home", "cozy", "everyday", "hobby", "comfort", "happy", "family", "interior", "decor", "modern living"],
  Architecture: ["architecture", "building", "structure", "design", "urban", "modern", "facade", "construction", "city", "geometry", "interior", "landmark", "skyline", "minimalist"],
  Art: ["art", "creative", "artistic", "painting", "design", "illustration", "colorful", "abstract art", "expression", "gallery", "craft", "handmade", "aesthetic", "composition"],
  Abstract: ["abstract", "conceptual", "shape", "form", "pattern", "design element", "modern", "artistic", "geometric", "fluid", "dynamic", "creative", "decorative", "stylized"],
  Backgrounds: ["background", "backdrop", "texture", "wallpaper", "banner", "template", "decorative", "design", "subtle", "elegant", "modern", "clean", "space", "copy space"],
  Objects: ["object", "still life", "single object", "studio shot", "product", "detail", "closeup", "item", "arrangement", "minimal", "isolated", "concept", "symbol", "element"],
  Science: ["science", "research", "laboratory", "experiment", "technology", "data", "discovery", "medical", "biology", "chemistry", "innovation", "analysis", "microscope", "knowledge"],
  Sports: ["sport", "fitness", "athlete", "exercise", "competition", "training", "active", "health", "team", "game", "energy", "movement", "stadium", "outdoor activity"],
};

const CATEGORY_NOUNS: Record<string, string> = {
  Nature: "natural scene",
  Animals: "animal portrait",
  People: "people scene",
  Food: "food still life",
  Travel: "travel destination",
  Technology: "technology concept",
  Business: "business scene",
  Lifestyle: "lifestyle scene",
  Architecture: "architectural detail",
  Art: "artistic composition",
  Abstract: "abstract composition",
  Backgrounds: "abstract background",
  Objects: "studio object",
  Science: "science concept",
  Sports: "sports action",
};

/* ------------------------------------------------------------------ */
/* Keyword banks                                                       */
/* ------------------------------------------------------------------ */

const GENERIC_STOCK_TERMS = [
  "stock photo", "stock image", "royalty free", "creative", "design",
  "modern", "professional", "high quality", "colorful", "concept",
  "illustration", "graphic", "visual", "artwork", "digital",
  "template", "banner", "poster", "presentation", "website",
  "marketing", "advertising", "social media", "blog", "editorial",
];

const GENERIC_FILL_TERMS = [
  "stock", "photo", "image", "picture", "creative", "design", "modern",
  "professional", "concept", "visual", "digital", "colorful", "graphic",
  "artwork", "template", "marketing", "presentation", "website", "blog",
  "banner", "poster", "advertising", "social media", "detail", "style",
  "texture", "pattern", "light", "color", "shape",
];

const WHITE_BG_TERMS = [
  "white background", "isolated on white", "cut out", "blank background",
  "studio shot", "empty", "clean background", "isolated", "simple",
];

const TRANSPARENT_TERMS = [
  "transparent background", "alpha channel", "cut out", "isolated",
  "png with transparency", "no background", "clipping path",
];

const SILHOUETTE_TERMS = [
  "silhouette", "shadow", "dark shape", "backlit", "dramatic", "mystery",
  "contrast", "outline", "anonymous", "figure shadow",
];

/* ------------------------------------------------------------------ */
/* Descriptor builders from ImageAnalysis                              */
/* ------------------------------------------------------------------ */

function topColorName(a: ImageAnalysis): string {
  if (!a.dominantColors.length) return "neutral";
  return nearestColorName(a.dominantColors[0].hex);
}

function colorWords(a: ImageAnalysis): string[] {
  const names = a.dominantColors.slice(0, 3).map((c) => nearestColorName(c.hex));
  const out: string[] = [];
  for (const n of names) {
    if (!out.includes(n) && n !== "neutral") out.push(n);
  }
  if (out.length) out.push(`${out[0]} tones`);
  return out;
}

function lightingTerms(a: ImageAnalysis): string[] {
  const t: string[] = [];
  if (a.isMostlyDark) t.push("low key", "moody lighting", "dark", "shadows", "dramatic lighting");
  else if (a.isMostlyBright) t.push("high key", "bright", "even illumination", "soft light");
  else t.push("natural light", "balanced exposure", "soft shadows");
  if (a.warmth > 0.18) t.push("warm light", "golden tones");
  else if (a.warmth < -0.18) t.push("cool light", "blue tones");
  if (a.contrast > 0.55) t.push("strong contrast");
  else if (a.contrast < 0.25) t.push("soft contrast");
  return t;
}

function compositionTerms(a: ImageAnalysis): string[] {
  const t: string[] = [];
  t.push(a.orientation === "landscape" ? "landscape format" : a.orientation === "portrait" ? "vertical format" : "square format");
  if (a.edgeDensity > 0.55) t.push("detailed", "intricate", "textured", "rich detail");
  else if (a.edgeDensity < 0.22) t.push("minimal", "copy space", "simple", "clean", "smooth");
  else t.push("moderate detail");
  if (a.saturation > 0.55) t.push("vivid colors", "vibrant");
  else if (a.saturation < 0.22) t.push("muted tones", "desaturated");
  return t;
}

function styleAdjective(a: ImageAnalysis): string {
  if (a.edgeDensity < 0.22) return "minimal";
  if (a.saturation > 0.55) return "vibrant";
  if (a.isMostlyDark) return "dark";
  if (a.isMostlyBright) return "bright";
  if (a.contrast > 0.55) return "bold";
  return "soft";
}

/** Category picked by brightness/detail/color heuristics (suggested). */
export function suggestCategory(a: ImageAnalysis): string {
  const top = topColorName(a);
  if (a.saturation < 0.12 && a.edgeDensity < 0.2) return "Backgrounds";
  if (top === "green" || top === "blue" || top === "teal") return "Nature";
  if ((top === "white" || top === "gray" || top === "black") && a.edgeDensity < 0.3) return "Objects";
  if (a.edgeDensity > 0.6) return "Architecture";
  if (a.saturation > 0.6 && a.edgeDensity > 0.35) return "Art";
  if (a.warmth > 0.15 && a.saturation > 0.4) return "Lifestyle";
  return "Abstract";
}

function buildStyle(a: ImageAnalysis, settings: MetadataSettings): string {
  const parts: string[] = [];
  parts.push(styleAdjective(a));
  parts.push(a.saturation > 0.55 ? "vivid colors" : a.saturation < 0.22 ? "muted tones" : "natural colors");
  parts.push(a.contrast > 0.55 ? "strong contrast" : a.contrast < 0.25 ? "soft contrast" : "balanced contrast");
  parts.push(a.warmth > 0.18 ? "warm tones" : a.warmth < -0.18 ? "cool tones" : "neutral tones");
  parts.push(a.edgeDensity > 0.55 ? "rich texture" : a.edgeDensity < 0.22 ? "smooth surfaces" : "moderate detail");
  if (settings.whiteBackground) parts.push("isolated on white");
  if (settings.transparentBackground) parts.push("transparent background");
  if (settings.silhouetteMode) parts.push("silhouette treatment");
  return `${parts.join(", ")} — visual characteristics (suggested)`;
}

function buildCommercialConcept(category: string): string {
  return `Suggested commercial uses: ${category.toLowerCase()}-themed marketing materials, presentations, websites and editorial content.`;
}

/* ------------------------------------------------------------------ */
/* Keyword pipeline                                                    */
/* ------------------------------------------------------------------ */

/** Case-insensitive dedupe preserving first-occurrence order. */
export function dedupeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords) {
    const k = raw.trim();
    if (!k) continue;
    const key = k.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(k);
    }
  }
  return out;
}

function prohibitedSet(prohibitedWords: string): Set<string> {
  return new Set(
    prohibitedWords
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean),
  );
}

function stripProhibited(keywords: string[], prohibitedWords: string): string[] {
  const banned = prohibitedSet(prohibitedWords);
  if (!banned.size) return keywords;
  return keywords.filter((k) => !banned.has(k.trim().toLowerCase()));
}

function splitToSingleWords(keywords: string[]): string[] {
  const out: string[] = [];
  for (const k of keywords) {
    for (const w of k.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 2) out.push(w);
    }
  }
  return out;
}

/**
 * Ranked keyword list: subject-ish terms first, then category terms,
 * colors, lighting, composition, then generic stock terms.
 */
export function buildRankedKeywords(
  subjectTerms: string[],
  category: string,
  colors: string[],
  lighting: string[],
  composition: string[],
  settings: MetadataSettings,
  profile: MarketplaceProfile,
): string[] {
  const candidates = [
    ...subjectTerms,
    ...(CATEGORY_TERMS[category] ?? CATEGORY_TERMS.Abstract),
    ...colors,
    ...lighting,
    ...composition,
    ...(settings.whiteBackground ? WHITE_BG_TERMS : []),
    ...(settings.transparentBackground ? TRANSPARENT_TERMS : []),
    ...(settings.silhouetteMode ? SILHOUETTE_TERMS : []),
    ...GENERIC_STOCK_TERMS,
  ];

  const singleWord = settings.singleWordMode || profile.keywordStyle === "single";
  let keywords = singleWord ? splitToSingleWords(candidates) : candidates;
  keywords = dedupeKeywords(keywords);
  keywords = stripProhibited(keywords, settings.prohibitedWords);
  // pad up to the minimum with generic terms (dedupe keeps it clean)
  if (keywords.length < settings.minKeywords) {
    keywords = dedupeKeywords([...keywords, ...GENERIC_FILL_TERMS]);
  }
  const cap = Math.min(profile.maxKeywords, Math.max(1, settings.maxKeywords));
  return keywords.slice(0, cap);
}

/* ------------------------------------------------------------------ */
/* Title & description builders                                        */
/* ------------------------------------------------------------------ */

function capWord(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

function buildTitle(
  subjectPhrase: string,
  extraTerms: string[],
  assetWord: string,
  orientation: string,
  settings: MetadataSettings,
  profile: MarketplaceProfile,
): string {
  const orientationWord = orientation === "landscape" ? "landscape" : orientation === "portrait" ? "vertical" : "square";
  const pool = dedupeKeywords([
    ...subjectPhrase.split(" "),
    orientationWord,
    "stock",
    assetWord,
    ...extraTerms,
  ]);
  const effectiveMax = Math.max(3, Math.min(settings.maxTitleWords, profile.maxTitleWords));
  const min = Math.max(1, Math.min(settings.minTitleWords, effectiveMax));
  const filler = GENERIC_FILL_TERMS.filter((w) => !pool.map((p) => p.toLowerCase()).includes(w));
  let words = pool.slice(0, effectiveMax);
  let fi = 0;
  while (words.length < min && fi < filler.length) {
    words.push(filler[fi]);
    fi++;
  }
  return words.map(capWord).join(" ");
}

function fitWords(text: string, target: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= target) return text.trim();
  return words.slice(0, target).join(" ");
}

function buildDescription(
  lead: string,
  sentences: string[],
  customInstructions: string,
  commercialConcept: string,
  targetWords: number,
): string {
  const parts = [lead, ...sentences];
  if (customInstructions.trim()) parts.push(customInstructions.trim());
  parts.push(commercialConcept);
  const joined = parts.join(" ");
  // trim to roughly the target (± allow a little slack so sentences stay whole)
  const words = joined.split(/\s+/).filter(Boolean);
  if (words.length <= targetWords + 8) return joined.trim();
  return fitWords(joined, targetWords);
}

/* ------------------------------------------------------------------ */
/* Public generation API                                               */
/* ------------------------------------------------------------------ */

export interface GeneratedMetadata {
  title: string;
  description: string;
  keywords: string[];
  mainSubject: string;
  secondarySubjects: string[];
  category: string;
  style: string;
  commercialConcept: string;
  /** Honest one-line label about how this metadata was produced. */
  flowLabel?: string;
}

export interface GenerationInput {
  analysis: ImageAnalysis;
  fileName: string;
  settings: MetadataSettings;
  profile: MarketplaceProfile;
  assetWord?: string; // "photo" | "video clip" | "illustration"
}

export function generateMetadata(input: GenerationInput): GeneratedMetadata {
  const { analysis: a, settings, profile } = input;
  const assetWord = input.assetWord ?? "photo";

  const category = suggestCategory(a);
  const noun = CATEGORY_NOUNS[category] ?? "abstract composition";
  const adj = styleAdjective(a);
  const topColor = topColorName(a);
  const subjectPhrase =
    settings.silhouetteMode
      ? `silhouette ${noun}`
      : `${adj} ${topColor === "neutral" ? "" : `${topColor} `}${noun}`.replace(/\s+/g, " ").trim();

  const secondarySubjects = [
    `${topColor} color tones`,
    `${lightingTerms(a)[0] ?? "soft light"} treatment`,
    `${compositionTerms(a).find((t) => !t.includes("format")) ?? "clean composition"} detail`,
  ].map((s) => `${s} (suggested)`);

  const colors = colorWords(a);
  const lighting = lightingTerms(a);
  const composition = compositionTerms(a);

  const subjectTerms =
    settings.silhouetteMode
      ? ["silhouette", ...subjectPhrase.split(" ")]
      : subjectPhrase.split(" ");

  const keywords = buildRankedKeywords(
    subjectTerms,
    category,
    colors,
    lighting,
    composition,
    settings,
    profile,
  );

  const title = buildTitle(
    subjectPhrase,
    [...colors.slice(0, 2), ...lighting.slice(0, 2), category.toLowerCase()],
    assetWord,
    a.orientation,
    settings,
    profile,
  );

  const lead = `A ${a.orientation} stock ${assetWord} featuring a ${subjectPhrase}, created from on-device image analysis (heuristic, suggested).`;
  const sentences = [
    `Dominant ${colors.slice(0, 2).join(" and ") || "neutral"} tones with ${lighting[0] ?? "soft light"} give the ${assetWord} a ${adj} feel.`,
    `${capWord(composition[0] ?? "balanced composition")}, ${a.width}×${a.height}px, suitable for ${category.toLowerCase()}-themed layouts.`,
  ];
  const commercialConcept = buildCommercialConcept(category);
  const description = buildDescription(
    lead,
    sentences,
    settings.customInstructions,
    commercialConcept,
    Math.max(8, settings.descriptionWords),
  );

  return {
    title,
    description,
    keywords,
    mainSubject: `${subjectPhrase} (suggested)`,
    secondarySubjects,
    category,
    style: buildStyle(a, settings),
    commercialConcept,
  };
}

/* ------------------------------------------------------------------ */
/* Vector (SVG) flow — metadata-only, never vision-analyzed             */
/* ------------------------------------------------------------------ */

export interface SvgHints {
  width?: number;
  height?: number;
  title?: string;
}

/** Parse width/height/<title> hints out of SVG source text. */
export function parseSvgHints(text: string): SvgHints {
  const hints: SvgHints = {};
  const svgTag = text.match(/<svg[^>]*>/i)?.[0] ?? "";
  const num = (m: RegExpMatchArray | null) => (m ? parseFloat(m[1]) : undefined);
  hints.width = num(svgTag.match(/\bwidth\s*=\s*["']?([\d.]+)/i));
  hints.height = num(svgTag.match(/\bheight\s*=\s*["']?([\d.]+)/i));
  if (hints.width === undefined || hints.height === undefined) {
    const vb = svgTag.match(/viewBox\s*=\s*["'][\d.\s-]*\s([\d.]+)\s+([\d.]+)["']/i);
    if (vb) {
      hints.width = hints.width ?? parseFloat(vb[1]);
      hints.height = hints.height ?? parseFloat(vb[2]);
    }
  }
  const title = text.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
  if (title) hints.title = title[1].trim();
  return hints;
}

export function humanizeFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function generateVectorMetadata(
  fileName: string,
  hints: SvgHints,
  settings: MetadataSettings,
  profile: MarketplaceProfile,
): GeneratedMetadata {
  const seed = hints.title || humanizeFileName(fileName) || "vector illustration";
  const dims = hints.width && hints.height ? ` ${Math.round(hints.width)}×${Math.round(hints.height)}px` : "";
  const category = "Art";

  const subjectPhrase = `${capWord(seed)} vector illustration`;
  const subjectTerms = ["vector", "illustration", ...seed.split(" ")];
  const keywords = buildRankedKeywords(
    subjectTerms,
    category,
    [],
    [],
    ["scalable", "editable", "clean lines"],
    settings,
    profile,
  );

  const title = buildTitle(
    subjectPhrase,
    ["vector", "illustration", "design", "graphic"],
    "vector illustration",
    "square",
    settings,
    profile,
  );

  const lead = `A scalable vector illustration${dims}, described from file metadata hints only — this file was not vision-analyzed on-device (suggested metadata).`;
  const commercialConcept = buildCommercialConcept(category);
  const description = buildDescription(
    lead,
    ["Clean vector artwork suitable for print and digital layouts."],
    settings.customInstructions,
    commercialConcept,
    Math.max(8, settings.descriptionWords),
  );

  return {
    title,
    description,
    keywords,
    mainSubject: `${subjectPhrase} (suggested)`,
    secondarySubjects: ["vector artwork (suggested)", "scalable graphic design (suggested)"],
    category,
    style: `Vector illustration, clean lines, scalable — visual characteristics (suggested)`,
    commercialConcept,
    flowLabel: "Metadata-only flow — vector file, not vision-analyzed on-device",
  };
}

/* ------------------------------------------------------------------ */
/* Manual flow (EPS / AI / video) — editable blanks                    */
/* ------------------------------------------------------------------ */

export function blankManualMetadata(
  fileName: string,
  settings: MetadataSettings,
  profile: MarketplaceProfile,
): GeneratedMetadata {
  const seed = humanizeFileName(fileName) || "untitled asset";
  const title = fitWords(
    capWord(seed).split(" ").map(capWord).join(" "),
    Math.max(3, Math.min(settings.maxTitleWords, profile.maxTitleWords)),
  );
  return {
    title,
    description: "",
    keywords: [],
    mainSubject: `${seed} (suggested)`,
    secondarySubjects: [],
    category: "Objects",
    style: "Not analyzed on-device (manual flow)",
    commercialConcept: "",
    flowLabel: "Cannot be vision-analyzed on-device in demo mode. Use the manual metadata flow below.",
  };
}
