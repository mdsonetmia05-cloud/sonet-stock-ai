"use client";

import { useMemo, useState } from "react";
import {
  Camera, PenTool, Palette, Video, Shapes, Image as ImageIcon, Sticker,
  Search, Copy, Download, FileText, Save, Star, Sparkles, BarChart3,
  Lightbulb, Check, FlaskConical,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/components/providers";
import { dbFor, bumpUsage } from "@/lib/db";
import { downloadCsv, downloadTextFile } from "@/lib/csv";
import { uid, nowIso, cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Built-in SAMPLE dataset. Every metric here is illustrative — no real
// marketplace counts exist anywhere in this file.
// ---------------------------------------------------------------------------

const PLATFORMS = [
  "Adobe Stock", "Shutterstock", "Freepik", "Vecteezy",
  "Dreamstime", "Depositphotos", "123RF",
];

const ASSET_TYPES = ["photo", "vector", "illustration", "video", "icon", "background", "sticker"];

const CATEGORIES = [
  "Technology & AI", "Nature", "Business", "Animals", "Food",
  "People & Lifestyle", "Abstract & Art", "Travel", "Architecture", "Holidays & Seasonal",
];

interface SampleItem {
  id: string;
  title: string;
  platform: string;
  assetType: string;
  category: string;
  keywords: string[];
  relatedConcepts: string[];
  contentGapSuggestion: string;
}

const SAMPLE_ITEMS: SampleItem[] = [
  {
    id: "sa-01", title: "AI robot hand reaching toward a glowing circuit board",
    platform: "Adobe Stock", assetType: "photo", category: "Technology & AI",
    keywords: ["artificial intelligence", "robot", "technology", "future", "circuit board", "innovation"],
    relatedConcepts: ["machine learning", "neural network", "automation", "human-robot interaction"],
    contentGapSuggestion: "AI imagery with everyday context (clinics, farms, classrooms) is thin in this sample — consider realistic applied-AI scenes.",
  },
  {
    id: "sa-02", title: "Neural network nodes on a dark blue gradient",
    platform: "Freepik", assetType: "vector", category: "Technology & AI",
    keywords: ["neural network", "data", "network", "digital", "abstract", "connections"],
    relatedConcepts: ["big data", "deep learning", "data visualization", "cyber security"],
    contentGapSuggestion: "Editable neural-network vectors in non-blue palettes are rare in this sample — try warm or duotone variants.",
  },
  {
    id: "sa-03", title: "City traffic timelapse at night, light trails",
    platform: "Dreamstime", assetType: "video", category: "Technology & AI",
    keywords: ["timelapse", "city", "night", "traffic", "urban", "motion"],
    relatedConcepts: ["smart city", "urban mobility", "nightlife", "infrastructure"],
    contentGapSuggestion: "Few timelapse clips in the sample overall — urban motion footage could stand out.",
  },
  {
    id: "sa-04", title: "Misty mountain lake at sunrise",
    platform: "Adobe Stock", assetType: "photo", category: "Nature",
    keywords: ["mountains", "lake", "sunrise", "mist", "landscape", "serene"],
    relatedConcepts: ["wilderness", "national park", "reflection", "calm"],
    contentGapSuggestion: "Heavily covered theme in the sample — only upload if the composition is genuinely distinctive.",
  },
  {
    id: "sa-05", title: "Tropical monstera leaves seamless pattern",
    platform: "Freepik", assetType: "background", category: "Nature",
    keywords: ["monstera", "leaves", "pattern", "tropical", "seamless", "botanical"],
    relatedConcepts: ["wallpaper", "textile design", "jungle", "plant"],
    contentGapSuggestion: "Local plant species patterns (e.g. South Asian flora) barely appear — a localization gap.",
  },
  {
    id: "sa-06", title: "Ocean wave crashing in slow motion",
    platform: "Dreamstime", assetType: "video", category: "Nature",
    keywords: ["ocean", "wave", "slow motion", "water", "power", "sea"],
    relatedConcepts: ["surf", "coastline", "energy", "natural force"],
    contentGapSuggestion: "Slow-motion nature clips are a classic evergreen — shoot in 4K/60fps for reusability.",
  },
  {
    id: "sa-07", title: "Sunset over rural rice fields",
    platform: "Depositphotos", assetType: "photo", category: "Nature",
    keywords: ["rice field", "sunset", "rural", "agriculture", "bangladesh", "harvest"],
    relatedConcepts: ["farming", "countryside", "golden hour", "sustainability"],
    contentGapSuggestion: "South Asian agricultural scenes are underrepresented in the sample — strong regional niche.",
  },
  {
    id: "sa-08", title: "Diverse business team meeting around a glass table",
    platform: "Shutterstock", assetType: "photo", category: "Business",
    keywords: ["business", "team", "meeting", "office", "diversity", "collaboration"],
    relatedConcepts: ["startup", "strategy", "leadership", "remote work"],
    contentGapSuggestion: "Overrepresented in samples generally — differentiate with authentic, non-staged moments.",
  },
  {
    id: "sa-09", title: "Stock market growth chart on a laptop screen",
    platform: "Adobe Stock", assetType: "photo", category: "Business",
    keywords: ["stock market", "finance", "chart", "laptop", "investment", "trading"],
    relatedConcepts: ["economy", "crypto", "analytics", "growth"],
    contentGapSuggestion: "Finance imagery skews generic in the sample — add real-context shots (traders, small business owners).",
  },
  {
    id: "sa-10", title: "Flat vector illustration of a handshake deal",
    platform: "123RF", assetType: "vector", category: "Business",
    keywords: ["handshake", "deal", "agreement", "partnership", "flat design", "business"],
    relatedConcepts: ["contract", "negotiation", "success", "cooperation"],
    contentGapSuggestion: "Diverse-skin-tone handshake vectors are a visible gap in this sample.",
  },
  {
    id: "sa-11", title: "Bengal tiger walking through the jungle",
    platform: "Depositphotos", assetType: "photo", category: "Animals",
    keywords: ["tiger", "bengal tiger", "wildlife", "jungle", "predator", "nature"],
    relatedConcepts: ["conservation", "safari", "big cat", "endangered"],
    contentGapSuggestion: "Wildlife photos need exceptional sharpness — only 2 animal items in the sample, so competition looks thin here.",
  },
  {
    id: "sa-12", title: "Cute cartoon cat stickers set",
    platform: "Freepik", assetType: "sticker", category: "Animals",
    keywords: ["cat", "sticker", "cartoon", "cute", "kawaii", "pet"],
    relatedConcepts: ["messaging", "emoji", "pack", "illustration"],
    contentGapSuggestion: "Sticker sets sell as bundles in samples — build cohesive 8–12 piece packs, not single stickers.",
  },
  {
    id: "sa-13", title: "Traditional biryani dish, top view",
    platform: "Dreamstime", assetType: "photo", category: "Food",
    keywords: ["biryani", "food", "indian food", "rice", "spicy", "cuisine"],
    relatedConcepts: ["restaurant", "recipe", "dinner", "traditional"],
    contentGapSuggestion: "Regional dishes beyond the obvious are thin — document local street food with clean styling.",
  },
  {
    id: "sa-14", title: "Fresh organic vegetables flat lay",
    platform: "123RF", assetType: "photo", category: "Food",
    keywords: ["vegetables", "organic", "healthy", "flat lay", "fresh", "nutrition"],
    relatedConcepts: ["vegan", "farm to table", "cooking", "diet"],
    contentGapSuggestion: "Seasonal produce flat-lays are evergreen; add copy-space variants for designers.",
  },
  {
    id: "sa-15", title: "Young woman practicing yoga at sunrise",
    platform: "Adobe Stock", assetType: "photo", category: "People & Lifestyle",
    keywords: ["yoga", "wellness", "sunrise", "meditation", "health", "woman"],
    relatedConcepts: ["mindfulness", "fitness", "balance", "morning routine"],
    contentGapSuggestion: "Wellness is crowded — differentiate with real people (not models) and imperfect, honest moments.",
  },
  {
    id: "sa-16", title: "Family picnic in the park",
    platform: "Shutterstock", assetType: "photo", category: "People & Lifestyle",
    keywords: ["family", "picnic", "park", "happy", "outdoor", "together"],
    relatedConcepts: ["leisure", "weekend", "children", "lifestyle"],
    contentGapSuggestion: "Multigenerational and non-Western family scenes are scarce in the sample.",
  },
  {
    id: "sa-17", title: "Man lifting dumbbells in a modern gym",
    platform: "Vecteezy", assetType: "photo", category: "People & Lifestyle",
    keywords: ["gym", "fitness", "workout", "dumbbells", "training", "muscles"],
    relatedConcepts: ["exercise", "strength", "health", "sports"],
    contentGapSuggestion: "Home-workout and senior-fitness angles are underrepresented compared with gym shots.",
  },
  {
    id: "sa-18", title: "Colorful liquid marble abstract background",
    platform: "Freepik", assetType: "background", category: "Abstract & Art",
    keywords: ["abstract", "marble", "background", "colorful", "liquid", "texture"],
    relatedConcepts: ["wallpaper", "fluid art", "design", "creative"],
    contentGapSuggestion: "Abstract backgrounds are abundant — unique color stories or techniques stand a better chance.",
  },
  {
    id: "sa-19", title: "Minimal line icon set for mobile apps",
    platform: "Vecteezy", assetType: "icon", category: "Abstract & Art",
    keywords: ["icons", "line icons", "ui", "mobile", "minimal", "app"],
    relatedConcepts: ["ux design", "interface", "symbols", "set"],
    contentGapSuggestion: "Icons sell as large cohesive sets (50+) in samples — niche domains (medical, logistics) have thinner coverage.",
  },
  {
    id: "sa-20", title: "Aerial view of Santorini white buildings",
    platform: "Dreamstime", assetType: "photo", category: "Travel",
    keywords: ["santorini", "greece", "travel", "aerial", "island", "vacation"],
    relatedConcepts: ["tourism", "mediterranean", "landmark", "summer"],
    contentGapSuggestion: "Famous landmarks are saturated — lesser-known destinations in this sample are the gap.",
  },
  {
    id: "sa-21", title: "Traveler with backpack at a mountain viewpoint",
    platform: "Adobe Stock", assetType: "photo", category: "Travel",
    keywords: ["travel", "backpack", "mountains", "adventure", "hiking", "explorer"],
    relatedConcepts: ["wanderlust", "journey", "viewpoint", "freedom"],
    contentGapSuggestion: "Authentic local-traveler perspectives beat generic tourist shots in buyer interest (hypothesis).",
  },
  {
    id: "sa-22", title: "Modern glass skyscraper looking up",
    platform: "123RF", assetType: "photo", category: "Architecture",
    keywords: ["skyscraper", "architecture", "glass", "building", "modern", "city"],
    relatedConcepts: ["downtown", "facade", "urban", "construction"],
    contentGapSuggestion: "Architecture is the thinnest category in this sample — interior details and textures could fill it.",
  },
  {
    id: "sa-23", title: "Carved pumpkins and autumn decorations",
    platform: "Shutterstock", assetType: "photo", category: "Holidays & Seasonal",
    keywords: ["halloween", "pumpkin", "autumn", "spooky", "decoration", "fall"],
    relatedConcepts: ["october", "harvest", "party", "seasonal"],
    contentGapSuggestion: "Seasonal content must be uploaded 6–10 weeks early — check the Event Calendar for timing.",
  },
  {
    id: "sa-24", title: "Isometric illustration of a cloud server farm",
    platform: "Vecteezy", assetType: "illustration", category: "Technology & AI",
    keywords: ["cloud", "server", "isometric", "data center", "illustration", "technology"],
    relatedConcepts: ["hosting", "infrastructure", "saas", "network"],
    contentGapSuggestion: "Isometric tech illustrations are a compact niche — keep palettes consistent across a series.",
  },
];

const ASSET_ICONS: Record<string, typeof Camera> = {
  photo: Camera, vector: PenTool, illustration: Palette, video: Video,
  icon: Shapes, background: ImageIcon, sticker: Sticker,
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  "Technology & AI": "from-sky-600 via-indigo-700 to-indigo-950",
  "Nature": "from-emerald-600 via-green-700 to-green-950",
  "Business": "from-slate-600 via-slate-700 to-slate-950",
  "Animals": "from-amber-600 via-orange-700 to-orange-950",
  "Food": "from-red-600 via-rose-700 to-rose-950",
  "People & Lifestyle": "from-violet-600 via-purple-700 to-purple-950",
  "Abstract & Art": "from-fuchsia-600 via-pink-700 to-pink-950",
  "Travel": "from-cyan-600 via-teal-700 to-teal-950",
  "Architecture": "from-stone-600 via-stone-700 to-stone-950",
  "Holidays & Seasonal": "from-red-700 via-red-800 to-stone-950",
};

const DOWNLOADS_NA = "n/a — not exposed";

function useClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
  };
  return { copied, copy };
}

export default function StockAnalysisPage() {
  const { user, signIn } = useAuth();
  const { copied, copy } = useClipboard();

  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("All");
  const [assetType, setAssetType] = useState("All");
  const [category, setCategory] = useState("All");
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(() =>
    user ? new Set(dbFor(user.id).favorites.all().filter((f) => f.kind === "topic").map((f) => f.refId)) : new Set(),
  );
  const [savedProjects, setSavedProjects] = useState(() =>
    user ? dbFor(user.id).research.all() : [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAMPLE_ITEMS.filter((item) => {
      if (platform !== "All" && item.platform !== platform) return false;
      if (assetType !== "All" && item.assetType !== assetType) return false;
      if (category !== "All" && item.category !== category) return false;
      if (q) {
        const hay = `${item.title} ${item.keywords.join(" ")} ${item.relatedConcepts.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, platform, assetType, category]);

  // ---- Report: observed facts computed from the filtered sample ----
  const observed = useMemo(() => {
    const byCategory = new Map<string, number>();
    const byPlatform = new Map<string, number>();
    const byAssetType = new Map<string, number>();
    for (const item of filtered) {
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
      byPlatform.set(item.platform, (byPlatform.get(item.platform) ?? 0) + 1);
      byAssetType.set(item.assetType, (byAssetType.get(item.assetType) ?? 0) + 1);
    }
    const sort = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { byCategory: sort(byCategory), byPlatform: sort(byPlatform), byAssetType: sort(byAssetType) };
  }, [filtered]);

  // ---- Report: hypotheses (explicitly labeled, never presented as facts) ----
  const hypotheses = useMemo(() => {
    const notes: string[] = [];
    const thin = observed.byCategory.filter(([, n]) => n <= 2).map(([c]) => c);
    if (thin.length) {
      notes.push(
        `Categories with ≤2 items in this sample (${thin.join(", ")}) may have thinner competition — this reflects sample composition only, not measured marketplace demand.`,
      );
    }
    for (const [cat, n] of observed.byCategory) {
      const types = new Set(filtered.filter((i) => i.category === cat).map((i) => i.assetType));
      if (n >= 2 && types.size === 1) {
        notes.push(
          `In "${cat}", all ${n} sample items are "${[...types][0]}" — trying other asset types here is a differentiation angle (unverified).`,
        );
      }
    }
    const kwCount = new Map<string, number>();
    for (const item of filtered) for (const k of item.keywords) kwCount.set(k, (kwCount.get(k) ?? 0) + 1);
    const longTail = [...kwCount.entries()].filter(([, n]) => n === 1).map(([k]) => k).slice(0, 8);
    if (longTail.length) {
      notes.push(
        `Long-tail keywords appearing once in this sample (${longTail.join(", ")}) suggest possible niche upload ideas — unverified, treat as brainstorming fuel only.`,
      );
    }
    notes.push(
      "Sample size is ~24 items, far too small for market conclusions. Use this panel for ideation, then validate with real marketplace research before producing at scale.",
    );
    return notes;
  }, [observed, filtered]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl pt-16">
        <EmptyState
          icon={<BarChart3 size={40} />}
          title="Sign in to use Stock Analysis"
          description="Your research projects and saved topics are stored per user."
          action={<Button onClick={() => signIn("Demo Creator", "demo@sonetstock.ai")}>Continue as demo creator</Button>}
        />
      </div>
    );
  }

  const db = dbFor(user.id);

  const toggleFavorite = (item: SampleItem) => {
    if (favIds.has(item.id)) {
      const existing = db.favorites.all().find((f) => f.kind === "topic" && f.refId === item.id);
      if (existing) db.favorites.remove(existing.id);
      setFavIds((s) => { const n = new Set(s); n.delete(item.id); return n; });
    } else {
      db.favorites.upsert({ id: uid(), kind: "topic", refId: item.id, label: item.title, createdAt: nowIso() });
      setFavIds((s) => new Set(s).add(item.id));
    }
  };

  const saveProject = () => {
    const project = {
      id: uid(),
      query: query.trim() || "(all topics)",
      platform, assetType, category,
      resultCount: filtered.length,
      createdAt: nowIso(),
    };
    db.research.upsert(project);
    setSavedProjects(db.research.all());
    setSavedNote("Research project saved.");
    setTimeout(() => setSavedNote(null), 2000);
  };

  const buildTxt = () => {
    const lines: string[] = [];
    lines.push("SONET STOCK AI — Research Report");
    lines.push("NOTE: All item data below is a built-in ILLUSTRATIVE SAMPLE, not real marketplace metrics.");
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Filters — query: "${query.trim() || "(none)"}", platform: ${platform}, asset type: ${assetType}, category: ${category}`);
    lines.push(`Matching sample items: ${filtered.length}`);
    lines.push("");
    lines.push("== Observed (from sample dataset) ==");
    lines.push(`By category: ${observed.byCategory.map(([c, n]) => `${c}: ${n}`).join(" | ") || "—"}`);
    lines.push(`By platform: ${observed.byPlatform.map(([c, n]) => `${c}: ${n}`).join(" | ") || "—"}`);
    lines.push(`By asset type: ${observed.byAssetType.map(([c, n]) => `${c}: ${n}`).join(" | ") || "—"}`);
    lines.push("");
    lines.push("== Hypotheses & suggestions (AI-generated, UNVERIFIED — not facts) ==");
    hypotheses.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
    lines.push("");
    lines.push("== Items ==");
    filtered.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.title}`);
      lines.push(`   Platform: ${item.platform} | Asset type: ${item.assetType} | Category: ${item.category}`);
      lines.push(`   Downloads: ${DOWNLOADS_NA}`);
      lines.push(`   Keywords: ${item.keywords.join(", ")}`);
      lines.push(`   Related concepts: ${item.relatedConcepts.join(", ")}`);
      lines.push(`   Content-gap suggestion: ${item.contentGapSuggestion}`);
    });
    return lines.join("\n");
  };

  const exportTxt = () => {
    const text = buildTxt();
    downloadTextFile(`stock-analysis-report-${Date.now()}.txt`, text);
    db.exports.upsert({
      id: uid(), kind: "txt", filename: "stock-analysis-report.txt",
      detail: `${filtered.length} sample items, TXT report`, sizeBytes: new Blob([text]).size, createdAt: nowIso(),
    });
    bumpUsage(db, { bytesExported: new Blob([text]).size });
  };

  const exportCsv = () => {
    const columns = ["Title", "Platform", "AssetType", "Category", "Keywords", "Note"];
    const rows = filtered.map((item) => ({
      Title: item.title,
      Platform: item.platform,
      AssetType: item.assetType,
      Category: item.category,
      Keywords: item.keywords.join("; "),
      Note: `SAMPLE DATA — downloads: ${DOWNLOADS_NA}. Gap suggestion: ${item.contentGapSuggestion}`,
    }));
    const size = downloadCsv(`stock-analysis-${Date.now()}.csv`, columns, rows);
    db.exports.upsert({
      id: uid(), kind: "csv", filename: "stock-analysis.csv",
      detail: `${filtered.length} sample items, CSV export`, sizeBytes: size, createdAt: nowIso(),
    });
    bumpUsage(db, { bytesExported: size });
  };

  return (
    <div>
      <PageHeader
        title="Stock Analysis"
        description="Explore an illustrative sample dataset of stock topics. All downloads metrics are not exposed by marketplaces and are shown as n/a."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportTxt} disabled={!filtered.length}>
              <FileText size={16} /> Export TXT
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download size={16} /> Export CSV
            </Button>
            <Button size="sm" onClick={saveProject}>
              <Save size={16} /> Save project
            </Button>
          </>
        }
      />

      {savedNote && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primaryBright">
          <Check size={16} /> {savedNote}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <Badge tone="amber">SAMPLE DATASET</Badge>
        <p className="text-sm text-muted">
          Illustrative sample data — not real marketplace metrics. Real marketplaces do not publicly expose per-asset download counts.
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Label htmlFor="sa-query">Search topics</Label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                id="sa-query"
                placeholder="e.g. yoga, tiger, fintech…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="sa-platform">Platform</Label>
            <Select id="sa-platform" options={["All", ...PLATFORMS]} value={platform} onChange={(e) => setPlatform(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sa-asset">Asset type</Label>
            <Select id="sa-asset" options={["All", ...ASSET_TYPES]} value={assetType} onChange={(e) => setAssetType(e.target.value)} />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="sa-category">Category</Label>
            <Select id="sa-category" options={["All", ...CATEGORIES]} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="flex items-end">
            <p className="text-sm text-muted" aria-live="polite">
              <span className="font-semibold text-foreground">{filtered.length}</span> sample items match
            </p>
          </div>
        </div>
      </Card>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={40} />}
          title="No sample items match"
          description="Try a broader keyword or clear a filter."
          action={<Button variant="secondary" onClick={() => { setQuery(""); setPlatform("All"); setAssetType("All"); setCategory("All"); }}>Clear filters</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const Icon = ASSET_ICONS[item.assetType] ?? Camera;
            const isFav = favIds.has(item.id);
            return (
              <Card key={item.id} className="flex flex-col gap-3">
                <div className={cn("relative flex h-28 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br", CATEGORY_GRADIENTS[item.category] ?? "from-slate-600 to-slate-900")}>
                  <Icon size={44} className="text-white/80" aria-hidden />
                  <span className="absolute left-2 top-2"><Badge tone="neutral" className="bg-black/40 text-white border-white/20">{item.assetType}</Badge></span>
                  <button
                    onClick={() => toggleFavorite(item)}
                    aria-label={isFav ? `Remove "${item.title}" from favorites` : `Favorite topic "${item.title}"`}
                    title={isFav ? "Remove from favorites" : "Favorite this topic"}
                    className={cn("absolute right-2 top-2 rounded-lg p-1.5 transition-colors", isFav ? "bg-amber-500/90 text-white" : "bg-black/40 text-white/70 hover:text-white")}
                  >
                    <Star size={16} fill={isFav ? "currentColor" : "none"} />
                  </button>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone="blue">{item.platform}</Badge>
                    <Badge tone="neutral">{item.category}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    Downloads: <span className="font-medium">{DOWNLOADS_NA}</span>
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Keyword ideas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.keywords.map((k) => (
                      <button
                        key={k}
                        onClick={() => copy(k, `${item.id}:${k}`)}
                        aria-label={`Copy keyword ${k}`}
                        title="Click to copy"
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-foreground hover:border-primary hover:text-primaryBright"
                      >
                        {copied === `${item.id}:${k}` ? <Check size={12} /> : <Copy size={12} />}
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Related concepts</p>
                  <p className="text-xs text-muted">{item.relatedConcepts.join(" · ")}</p>
                </div>

                <div className="rounded-xl border border-border bg-secondary/60 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                    <Lightbulb size={14} /> Content gap — suggestion
                  </p>
                  <p className="text-xs leading-relaxed text-muted">{item.contentGapSuggestion}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Research report */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FlaskConical size={18} className="text-primaryBright" /> Research report</CardTitle>
            <Badge tone="amber">Sample-based</Badge>
          </CardHeader>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <BarChart3 size={16} className="text-primaryBright" /> Observed (from sample dataset)
              </h4>
              <p className="mb-3 text-xs text-muted">Counts computed from the current filtered results ({filtered.length} items).</p>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Items" value={filtered.length} sample />
                <StatCard label="Categories" value={observed.byCategory.length} sample />
                <StatCard label="Platforms" value={observed.byPlatform.length} sample />
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <p className="font-medium text-foreground">By category</p>
                  <p className="text-muted">{observed.byCategory.map(([c, n]) => `${c} (${n})`).join(" · ") || "—"}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">By platform</p>
                  <p className="text-muted">{observed.byPlatform.map(([c, n]) => `${c} (${n})`).join(" · ") || "—"}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">By asset type</p>
                  <p className="text-muted">{observed.byAssetType.map(([c, n]) => `${c} (${n})`).join(" · ") || "—"}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles size={16} className="text-amber-400" /> Hypotheses &amp; suggestions <span className="text-xs font-normal text-muted">(AI-generated, unverified)</span>
              </h4>
              <p className="mb-3 text-xs text-muted">Template-generated brainstorming — these are NOT measured facts.</p>
              <ul className="space-y-2">
                {hypotheses.map((h, i) => (
                  <li key={i} className="flex gap-2 rounded-xl border border-border bg-secondary/50 p-3 text-xs leading-relaxed text-muted">
                    <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Saved projects */}
      {savedProjects.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Saved research projects</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {savedProjects.map((p) => (
              <Card key={p.id} className="p-4">
                <p className="font-medium text-foreground">{p.query}</p>
                <p className="mt-1 text-xs text-muted">
                  {p.platform} · {p.assetType} · {p.category} · {p.resultCount} sample results
                </p>
                <p className="mt-1 text-xs text-muted">{new Date(p.createdAt).toLocaleString()}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
