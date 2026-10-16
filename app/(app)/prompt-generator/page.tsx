"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Box,
  Camera,
  Check,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Heart,
  PenTool,
  Plus,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { ConfirmDialog } from "@/components/ui/dialog";
import { localDb, bumpUsage, type PromptRecord } from "@/lib/db";
import { downloadCsv, downloadTextFile } from "@/lib/csv";
import {
  loadImageFromFile,
  analyzeImage,
  describeAnalysis,
  nearestColorName,
  type ImageAnalysis,
} from "@/lib/image";
import { uid, nowIso, formatDateTime, truncate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "ssa:v1:draft:prompt-idea";

// ---------- Category presets ----------

interface CategoryPreset {
  id: string;
  label: string;
  assetClass: "photo" | "vector" | "video" | "cgi";
  style: string;
  composition: string;
  negative: string;
}

const CATEGORIES: CategoryPreset[] = [
  {
    id: "stock-photo",
    label: "Stock Photo",
    assetClass: "photo",
    style: "versatile commercial stock photography, natural light, authentic feel",
    composition: "rule of thirds, clear focal subject, balanced framing",
    negative: "blurry, watermark, logo, text overlay, distorted faces",
  },
  {
    id: "vector",
    label: "Vector Illustration",
    assetClass: "vector",
    style: "clean flat vector illustration, crisp edges, scalable shapes",
    composition: "balanced layout, consistent stroke weight, clear visual hierarchy",
    negative: "photorealistic noise, raster artifacts, watermark, blurry edges",
  },
  {
    id: "silhouette",
    label: "Single Black Silhouette",
    assetClass: "vector",
    style: "bold single black silhouette on a clean white background",
    composition: "isolated centered subject, maximum contrast, no gradients",
    negative: "gray tones, gradients, multiple colors, background clutter, photo texture",
  },
  {
    id: "icons",
    label: "Icon Packs",
    assetClass: "vector",
    style: "minimal icon set with consistent line weight and rounded corners",
    composition: "even grid layout, generous padding, uniform visual weight",
    negative: "photorealistic, gradients, text, drop shadows, watermark",
  },
  {
    id: "stickers",
    label: "Stickers",
    assetClass: "vector",
    style: "playful sticker design with a thick white die-cut border",
    composition: "bold centered motif, high saturation, fun energy",
    negative: "photorealistic, dull colors, watermark, thin fragile lines",
  },
  {
    id: "3d",
    label: "3D Illustration",
    assetClass: "cgi",
    style: "soft 3D render, clay-like material, studio lighting, gentle shadows",
    composition: "hero object centered, slight perspective, soft depth of field",
    negative: "flat design, pixelated, watermark, harsh shadows",
  },
  {
    id: "product-photo",
    label: "Product Photography",
    assetClass: "photo",
    style: "premium product photography, controlled studio lighting, tack-sharp focus",
    composition: "product as hero, clean surface, subtle reflection, breathing room",
    negative: "messy background, glare, watermark, recognizable brand logos",
  },
  {
    id: "backgrounds",
    label: "Commercial Backgrounds",
    assetClass: "photo",
    style: "seamless commercial background, subtle texture, even tone",
    composition: "edge-to-edge pattern, no focal subject, copy-friendly",
    negative: "focal subject, text, watermark, harsh vignette",
  },
  {
    id: "seasonal",
    label: "Seasonal Designs",
    assetClass: "photo",
    style: "festive seasonal composition, thematic props, warm celebratory mood",
    composition: "layered depth, themed foreground accents, clear central area",
    negative: "off-season elements, watermark, cluttered frame",
  },
  {
    id: "cinematic-video",
    label: "Cinematic Video",
    assetClass: "video",
    style: "cinematic film still, 24fps motion feel, film-grade color grading",
    composition: "dynamic framing, leading lines, subject in motion",
    negative: "amateur footage, shaky camera, watermark, overexposed",
  },
  {
    id: "motion-graphics",
    label: "Motion Graphics",
    assetClass: "video",
    style: "dynamic motion graphics frame, bold shapes, kinetic energy",
    composition: "diagonal energy, layered elements, clear focal point",
    negative: "static dull layout, watermark, muddy colors",
  },
  {
    id: "cgi-ads",
    label: "CGI Advertising",
    assetClass: "cgi",
    style: "hyper-realistic CGI advertisement scene, dramatic product lighting",
    composition: "hero product large in frame, aspirational environment, clean logo-safe area",
    negative: "low quality, watermark, recognizable real brands, clutter",
  },
  {
    id: "documentary",
    label: "Documentary Scenes",
    assetClass: "video",
    style: "authentic documentary film frame, natural realism, observational tone",
    composition: "environmental context, candid framing, available light",
    negative: "staged look, artificial lighting, watermark, over-posed",
  },
];

// ---------- Control options ----------

const OUTPUT_TYPES = [
  { value: "image", label: "Image" },
  { value: "vector", label: "Vector" },
  { value: "video", label: "Video" },
];

const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:2", "21:9"];

const VISUAL_STYLES = ["Photorealistic", "Flat Vector", "3D Render", "Minimalist", "Cinematic", "Abstract", "Line Art", "Hand-drawn"];

const LIGHTING = ["Natural daylight", "Studio softbox", "Golden hour", "Dramatic low-key", "High-key bright", "Neon glow", "Overcast soft"];

const COMPOSITION = ["Centered", "Rule of thirds", "Symmetrical", "Close-up macro", "Wide shot", "Aerial view", "Diagonal dynamic"];

const NEG_SPACE = [
  { value: "none", label: "None" },
  { value: "copy-top", label: "Copy space (top)" },
  { value: "copy-right", label: "Copy space (right)" },
  { value: "minimal", label: "Minimal margins" },
];

const NEG_SPACE_PHRASE: Record<string, string> = {
  none: "full-bleed composition",
  "copy-top": "ample copy space at the top for headlines",
  "copy-right": "open space on the right for text placement",
  minimal: "minimal margins, subject fills most of the frame",
};

const BACKGROUNDS = ["White", "Transparent", "Blurred", "Gradient", "Scene environment", "Dark"];

const DETAIL_LEVELS = ["Low", "Medium", "High", "Ultra-detailed"];

const PALETTES = ["Vibrant", "Pastel", "Monochrome", "Warm earth tones", "Cool blues", "Neon glow", "Custom…"];

const OUTPUT_FORMATS = ["JPG", "PNG", "WebP", "SVG", "EPS", "MP4", "MOV"];

const AUDIENCES = ["General", "Business", "Lifestyle", "Technology", "Education", "Healthcare", "Travel", "Food"];

const PLATFORMS = [
  { value: "adobe-stock", label: "Adobe Stock" },
  { value: "shutterstock", label: "Shutterstock" },
  { value: "freepik", label: "Freepik" },
  { value: "vecteezy", label: "Vecteezy" },
  { value: "dreamstime", label: "Dreamstime" },
  { value: "depositphotos", label: "Depositphotos" },
  { value: "123rf", label: "123RF" },
  { value: "generic-csv", label: "Generic CSV" },
  { value: "generic", label: "Generic (any marketplace)" },
];

interface AssetPreset {
  id: string;
  label: string;
  icon: typeof Camera;
  category: string;
  outputType: string;
  visualStyle: string;
  lighting: string;
  outputFormat: string;
}

const ASSET_PRESETS: AssetPreset[] = [
  { id: "photo", label: "Photo", icon: Camera, category: "stock-photo", outputType: "image", visualStyle: "Photorealistic", lighting: "Natural daylight", outputFormat: "JPG" },
  { id: "vector", label: "Vector", icon: PenTool, category: "vector", outputType: "vector", visualStyle: "Flat Vector", lighting: "High-key bright", outputFormat: "SVG" },
  { id: "video", label: "Video", icon: Clapperboard, category: "cinematic-video", outputType: "video", visualStyle: "Cinematic", lighting: "Dramatic low-key", outputFormat: "MP4" },
  { id: "cgi", label: "CGI", icon: Box, category: "cgi-ads", outputType: "image", visualStyle: "3D Render", lighting: "Studio softbox", outputFormat: "PNG" },
];

// ---------- Prompt assembly (on-device templates) ----------

interface GeneratorInputs {
  idea: string;
  categoryId: string;
  instructions: string;
  platform: string;
  outputType: string;
  aspect: string;
  visualStyle: string;
  lighting: string;
  composition: string;
  negSpace: string;
  background: string;
  detail: string;
  palette: string;
  customPalette: string;
  outputFormat: string;
  audience: string;
  reference?: { analysis: ImageAnalysis; descriptors: string[] };
}

function palettePhraseFor(i: GeneratorInputs): string {
  return i.palette === "Custom…" ? i.customPalette.trim() || "custom palette" : i.palette.toLowerCase();
}

function referencePhrase(ref: { analysis: ImageAnalysis; descriptors: string[] }): string {
  const a = ref.analysis;
  const colors = a.dominantColors
    .slice(0, 3)
    .map((c) => `${nearestColorName(c.hex)} (${c.hex})`)
    .join(", ");
  return `Measured from reference (${a.width}×${a.height}px, ${a.orientation}): ${ref.descriptors.join("; ")}; reference palette ${colors}.`;
}

function buildMainPrompt(i: GeneratorInputs): string {
  const cat = CATEGORIES.find((c) => c.id === i.categoryId) ?? CATEGORIES[0];
  const platformLabel = PLATFORMS.find((p) => p.value === i.platform)?.label ?? i.platform;
  const parts = [
    `${i.visualStyle} ${cat.style}`,
    `subject: ${i.idea.trim() || "a versatile creative stock concept"}`,
    `composition: ${cat.composition}; ${i.composition}`,
    `lighting: ${i.lighting}`,
    `background: ${i.background}`,
    `color palette: ${palettePhraseFor(i)}`,
    `detail level: ${i.detail.toLowerCase()}`,
    `framing: ${NEG_SPACE_PHRASE[i.negSpace] ?? "full-bleed composition"}`,
    `aspect ratio ${i.aspect}`,
  ];
  if (i.reference) parts.push(referencePhrase(i.reference));
  if (i.instructions.trim()) parts.push(`extra direction: ${i.instructions.trim()}`);
  parts.push(`target audience: ${i.audience.toLowerCase()}`);
  parts.push(`optimized for ${platformLabel}`);
  parts.push("no watermarks, no text overlays unless requested");
  parts.push("avoid trademarks, logos, and recognizable brands");
  return parts.join(". ") + ".";
}

function buildNegativePrompt(i: GeneratorInputs): string {
  const cat = CATEGORIES.find((c) => c.id === i.categoryId) ?? CATEGORIES[0];
  return cat.negative;
}

function buildSpecs(i: GeneratorInputs): string {
  const cat = CATEGORIES.find((c) => c.id === i.categoryId) ?? CATEGORIES[0];
  const platformLabel = PLATFORMS.find((p) => p.value === i.platform)?.label ?? i.platform;
  return [
    `Category: ${cat.label}`,
    `Output: ${i.outputType} → ${i.outputFormat}`,
    `Aspect ratio: ${i.aspect}`,
    `Palette: ${palettePhraseFor(i)}`,
    `Lighting: ${i.lighting}`,
    `Marketplace: ${platformLabel}`,
  ].join("\n");
}

/** Three rewordings of the main prompt (template assembly). */
function buildVariations(main: string): string[] {
  const clauses = main.split(". ").filter(Boolean);
  const v1 = [...clauses].reverse().join(". ") + (clauses.length ? "." : "");
  const swaps: Array<[RegExp, string]> = [
    [/\bphotograph(s)?\b/gi, "photo$1"],
    [/\bultra-detailed\b/gi, "highly detailed"],
    [/\bversatile\b/gi, "adaptable"],
    [/\bcomposition\b/gi, "framing"],
    [/\bpremium\b/gi, "high-end"],
    [/\bauthentic\b/gi, "genuine"],
  ];
  let v2 = main;
  for (const [re, rep] of swaps) v2 = v2.replace(re, rep);
  const v3 = `${main} Render at high resolution with clean, marketplace-ready composition and accurate color.`;
  return [v1, v2, v3];
}

interface GeneratedSet {
  main: string;
  negative: string;
  specs: string;
  variations: string[];
  createdAt: string;
}

interface ReferenceState {
  file: File;
  url: string;
  analysis: ImageAnalysis;
  descriptors: string[];
}

// ---------- Page ----------

export default function PromptGeneratorPage() {
  const db = useMemo(() => localDb(), []);

  const [idea, setIdea] = useState("");
  const [category, setCategory] = useState("stock-photo");
  const [instructions, setInstructions] = useState("");
  const [platform, setPlatform] = useState("adobe-stock");
  const [outputType, setOutputType] = useState("image");
  const [aspect, setAspect] = useState("1:1");
  const [visualStyle, setVisualStyle] = useState("Photorealistic");
  const [lighting, setLighting] = useState("Natural daylight");
  const [composition, setComposition] = useState("Rule of thirds");
  const [negSpace, setNegSpace] = useState("none");
  const [background, setBackground] = useState("White");
  const [detail, setDetail] = useState("High");
  const [palette, setPalette] = useState("Vibrant");
  const [customPalette, setCustomPalette] = useState("");
  const [outputFormat, setOutputFormat] = useState("JPG");
  const [audience, setAudience] = useState("General");

  const [reference, setReference] = useState<ReferenceState | null>(null);
  const [refAnalyzing, setRefAnalyzing] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  const [generated, setGenerated] = useState<GeneratedSet | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [draftNotice, setDraftNotice] = useState(false);

  const [history, setHistory] = useState<PromptRecord[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Draft handoff: Image → Prompt (or Event Calendar) may write ssa:v1:draft:prompt-idea.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { idea?: string; category?: string };
        if (d.idea) setIdea(d.idea);
        if (d.category && CATEGORIES.some((c) => c.id === d.category)) setCategory(d.category);
        setDraftNotice(true);
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      // ignore malformed draft
    }
  }, []);

  useEffect(() => {
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revoke the reference image URL on unmount (tracks latest via ref).
  const refUrlRef = useRef<string | null>(null);
  useEffect(() => {
    refUrlRef.current = reference?.url ?? null;
  }, [reference]);
  useEffect(() => {
    return () => {
      if (refUrlRef.current) URL.revokeObjectURL(refUrlRef.current);
    };
  }, []);

  const refreshHistory = () => {
    setHistory(db.prompts.all().filter((p) => p.source === "prompt-generator"));
  };

  const copyText = async (text: string, key: string) => {
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
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1600);
  };

  const collectInputs = (): GeneratorInputs => ({
    idea,
    categoryId: category,
    instructions,
    platform,
    outputType,
    aspect,
    visualStyle,
    lighting,
    composition,
    negSpace,
    background,
    detail,
    palette,
    customPalette,
    outputFormat,
    audience,
    reference: reference ? { analysis: reference.analysis, descriptors: reference.descriptors } : undefined,
  });

  const applyAssetPreset = (p: AssetPreset) => {
    setCategory(p.category);
    setOutputType(p.outputType);
    setVisualStyle(p.visualStyle);
    setLighting(p.lighting);
    setOutputFormat(p.outputFormat);
  };

  const handleReferenceFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
    if (!f.type.startsWith("image/") && ![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      setRefError("Only image files (JPG, PNG, WebP) can be used as a reference.");
      return;
    }
    setRefError(null);
    setRefAnalyzing(true);
    try {
      const img = await loadImageFromFile(f);
      const a = analyzeImage(img);
      if (reference) URL.revokeObjectURL(reference.url);
      setReference({ file: f, url: URL.createObjectURL(f), analysis: a, descriptors: describeAnalysis(a) });
    } catch (e) {
      setRefError(e instanceof Error ? e.message : "Could not decode reference image.");
    } finally {
      setRefAnalyzing(false);
    }
  };

  const clearReference = () => {
    if (reference) URL.revokeObjectURL(reference.url);
    setReference(null);
    setRefError(null);
  };

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 300)); // visible loading state
    const inputs = collectInputs();
    const main = buildMainPrompt(inputs);
    const negative = buildNegativePrompt(inputs);
    setGenerated({
      main,
      negative,
      specs: buildSpecs(inputs),
      variations: buildVariations(main),
      createdAt: nowIso(),
    });
    bumpUsage(db, { promptsCreated: 1 });
    setGenerating(false);
  };

  const savePrompt = (text: string, negative: string | undefined) => {
    const cat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
    db.prompts.upsert({
      id: uid(),
      text,
      negative,
      category: cat.label,
      mode: visualStyle,
      favorite: false,
      source: "prompt-generator",
      createdAt: nowIso(),
    });
    bumpUsage(db, { promptsCreated: 1 });
    refreshHistory();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const toggleFavorite = (p: PromptRecord) => {
    const next = { ...p, favorite: !p.favorite };
    db.prompts.upsert(next);
    if (next.favorite) {
      db.favorites.upsert({ id: uid(), kind: "prompt", refId: p.id, label: truncate(p.text, 60), createdAt: nowIso() });
    } else {
      const fav = db.favorites.all().find((f) => f.kind === "prompt" && f.refId === p.id);
      if (fav) db.favorites.remove(fav.id);
    }
    refreshHistory();
  };

  const deletePrompt = (id: string) => {
    db.prompts.remove(id);
    const fav = db.favorites.all().find((f) => f.kind === "prompt" && f.refId === id);
    if (fav) db.favorites.remove(fav.id);
    refreshHistory();
    setDeleteId(null);
  };

  const recordExport = (kind: "txt" | "csv", filename: string, detail: string, sizeBytes: number) => {
    db.exports.upsert({ id: uid(), kind, filename, detail, sizeBytes, createdAt: nowIso() });
    bumpUsage(db, { bytesExported: sizeBytes });
  };

  const exportGeneratedTxt = () => {
    if (!generated) return;
    const cat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
    const text = [
      `PROMPT GENERATOR — ${cat.label}`,
      `Generated: ${generated.createdAt} (template assembly)`,
      "",
      "MAIN PROMPT",
      generated.main,
      "",
      "NEGATIVE PROMPT",
      generated.negative,
      "",
      "TECHNICAL SPECS",
      generated.specs,
      "",
      "VARIATIONS",
      ...generated.variations.map((v, i) => `Variation ${i + 1}:\n${v}`),
    ].join("\n\n");
    const filename = `prompt-${category}-${Date.now()}.txt`;
    downloadTextFile(filename, text);
    recordExport("txt", filename, `Prompt generator export: ${cat.label}`, new Blob([text]).size);
  };

  const exportGeneratedCsv = () => {
    if (!generated) return;
    const cat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
    const rows = [
      { Category: cat.label, Prompt: generated.main, Negative: generated.negative, CreatedAt: generated.createdAt },
      ...generated.variations.map((v, i) => ({
        Category: `${cat.label} — Variation ${i + 1}`,
        Prompt: v,
        Negative: generated.negative,
        CreatedAt: generated.createdAt,
      })),
    ];
    const size = downloadCsv(`prompt-${category}-${Date.now()}.csv`, ["Category", "Prompt", "Negative", "CreatedAt"], rows);
    recordExport("csv", `prompt-${category}.csv`, `Prompt generator CSV: ${cat.label}`, size);
  };

  const exportHistoryItem = (p: PromptRecord) => {
    const text = [`PROMPT — ${p.category}`, `Saved: ${p.createdAt}`, "", "PROMPT", p.text, "", "NEGATIVE PROMPT", p.negative ?? "—"].join("\n");
    const filename = `prompt-saved-${p.id.slice(-6)}.txt`;
    downloadTextFile(filename, text);
    recordExport("txt", filename, `Saved prompt export: ${truncate(p.text, 40)}`, new Blob([text]).size);
  };

  const activeCat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  return (
    <div>
      <PageHeader
        title="Prompt Generator"
        description="Assemble detailed generator prompts from 13 category templates plus your own controls. Everything is built on-device from templates — no API key needed."
      />

      <div className="mb-6 flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          <strong className="font-semibold">No guarantees:</strong> prompts do not guarantee marketplace
          acceptance, downloads, or sales.
        </p>
      </div>

      {draftNotice && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
          <p>Draft imported from another tool — idea and category prefilled.</p>
          <button onClick={() => setDraftNotice(false)} aria-label="Dismiss draft notice" className="rounded-lg p-1 text-muted hover:text-foreground">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Left: inputs */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>1 · Asset presets</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Asset class presets">
              {ASSET_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyAssetPreset(p)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors",
                    category === p.category
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary text-muted hover:border-primary hover:text-foreground",
                  )}
                  aria-pressed={category === p.category}
                >
                  <p.icon size={20} aria-hidden />
                  {p.label}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2 · Idea & category</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="pg-idea">Idea / topic / keyword</Label>
                <Textarea
                  id="pg-idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="e.g. smiling barista handing a coffee cup across a wooden counter"
                />
              </div>
              <div>
                <Label htmlFor="pg-category">Category</Label>
                <Select
                  id="pg-category"
                  options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Template: {activeCat.style}. Composition: {activeCat.composition}.
                </p>
              </div>
              <div>
                <Label htmlFor="pg-outputtype">Output type</Label>
                <Select
                  id="pg-outputtype"
                  options={OUTPUT_TYPES}
                  value={outputType}
                  onChange={(e) => setOutputType(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pg-instructions">Custom instructions (optional)</Label>
                <Textarea
                  id="pg-instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Extra direction, e.g. 'warm morning light, shallow depth of field'"
                  className="min-h-[72px]"
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3 · Reference image (optional)</CardTitle>
            </CardHeader>
            {reference ? (
              <div className="flex gap-3 rounded-xl border border-border bg-secondary/50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reference.url} alt="Reference" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{reference.file.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    Measured from reference: {reference.analysis.width}×{reference.analysis.height}px,{" "}
                    {reference.analysis.orientation},{" "}
                    {reference.descriptors.slice(1, 4).join(", ")}.
                  </p>
                </div>
                <button onClick={clearReference} aria-label="Remove reference image" className="h-fit rounded-lg p-1 text-muted hover:bg-card hover:text-foreground">
                  <X size={16} aria-hidden />
                </button>
              </div>
            ) : (
              <>
                <FileDropzone
                  compact
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  multiple={false}
                  onFiles={handleReferenceFiles}
                  label={refAnalyzing ? "Analyzing reference…" : "Drop a reference image"}
                  hint="Measured on-device and injected into the prompt"
                />
                {refError && (
                  <p className="mt-2 text-xs text-danger" role="alert">{refError}</p>
                )}
              </>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4 · Controls</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pg-aspect">Aspect ratio</Label>
                <Select id="pg-aspect" options={ASPECTS} value={aspect} onChange={(e) => setAspect(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pg-style">Visual style</Label>
                <Select id="pg-style" options={VISUAL_STYLES} value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pg-lighting">Lighting</Label>
                <Select id="pg-lighting" options={LIGHTING} value={lighting} onChange={(e) => setLighting(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pg-composition">Composition</Label>
                <Select id="pg-composition" options={COMPOSITION} value={composition} onChange={(e) => setComposition(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pg-negspace">Negative space</Label>
                <Select id="pg-negspace" options={NEG_SPACE} value={negSpace} onChange={(e) => setNegSpace(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pg-bg">Background</Label>
                <Select id="pg-bg" options={BACKGROUNDS} value={background} onChange={(e) => setBackground(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pg-detail">Detail level</Label>
                <Select id="pg-detail" options={DETAIL_LEVELS} value={detail} onChange={(e) => setDetail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pg-palette">Color palette</Label>
                <Select id="pg-palette" options={PALETTES} value={palette} onChange={(e) => setPalette(e.target.value)} />
              </div>
              {palette === "Custom…" && (
                <div className="col-span-2">
                  <Label htmlFor="pg-custom-palette">Custom palette</Label>
                  <Input
                    id="pg-custom-palette"
                    value={customPalette}
                    onChange={(e) => setCustomPalette(e.target.value)}
                    placeholder="e.g. dusty rose, sage green and cream"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="pg-format">Output format</Label>
                <Select id="pg-format" options={OUTPUT_FORMATS} value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pg-audience">Target audience</Label>
                <Select id="pg-audience" options={AUDIENCES} value={audience} onChange={(e) => setAudience(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="pg-platform">Marketplace</Label>
                <Select id="pg-platform" options={PLATFORMS} value={platform} onChange={(e) => setPlatform(e.target.value)} />
              </div>
            </div>
            <Button className="mt-5 w-full" size="lg" onClick={generate} loading={generating}>
              <Wand2 size={18} aria-hidden />
              {generating ? "Assembling…" : "Generate prompt"}
            </Button>
          </Card>
        </div>

        {/* Right: generated + history */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Generated prompt</CardTitle>
              {generated && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={exportGeneratedTxt}>
                    <Download size={14} aria-hidden /> TXT
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportGeneratedCsv}>
                    <Download size={14} aria-hidden /> CSV
                  </Button>
                </div>
              )}
            </CardHeader>
            {!generated ? (
              <EmptyState
                icon={<FileText size={36} aria-hidden />}
                title="Nothing generated yet"
                description="Fill in your idea, pick a category and controls, then hit Generate prompt."
              />
            ) : (
              <div className="flex flex-col gap-4">
                                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label>Main prompt</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => copyText(generated.main, "main")}>
                        {copiedKey === "main" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                        {copiedKey === "main" ? "Copied" : "Copy"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => savePrompt(generated.main, generated.negative)}>
                        <Plus size={14} aria-hidden /> Save
                      </Button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap rounded-xl border border-border bg-secondary/50 p-4 text-sm leading-relaxed text-foreground">
                    {generated.main}
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label>Negative prompt</Label>
                    <Button size="sm" variant="ghost" onClick={() => copyText(generated.negative, "neg")}>
                      {copiedKey === "neg" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                      {copiedKey === "neg" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="rounded-xl border border-border bg-secondary/50 p-3 text-sm text-muted">{generated.negative}</p>
                </div>

                <div>
                  <Label>Technical specs</Label>
                  <pre className="mt-1.5 whitespace-pre-wrap rounded-xl border border-border bg-secondary/50 p-3 text-xs leading-relaxed text-muted">
                    {generated.specs}
                  </pre>
                </div>

                <div>
                  <Label>Variations (rewordings)</Label>
                  <div className="mt-1.5 flex flex-col gap-3">
                    {generated.variations.map((v, i) => (
                      <div key={i} className="rounded-xl border border-border bg-secondary/50 p-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">Variation {i + 1}</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => copyText(v, `var-${i}`)}>
                              {copiedKey === `var-${i}` ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                              {copiedKey === `var-${i}` ? "Copied" : "Copy"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => savePrompt(v, generated.negative)} aria-label={`Save variation ${i + 1}`}>
                              <Plus size={14} aria-hidden />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-muted">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {savedNotice && (
                  <p className="flex items-center gap-1.5 text-xs text-primaryBright" role="status">
                    <Check size={14} aria-hidden /> Saved to prompt history.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prompt history</CardTitle>
              <Badge tone="neutral">{history.length} saved</Badge>
            </CardHeader>
            {history.length === 0 ? (
              <EmptyState
                title="No saved prompts"
                description="Use Save on any generated prompt to keep it here."
              />
            ) : (
              <div className="flex max-h-[480px] flex-col gap-3 overflow-y-auto pr-1">
                {history.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-secondary/50 p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge tone="info">{p.category}</Badge>
                        <span className="truncate text-[11px] text-muted">{formatDateTime(p.createdAt)}</span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => toggleFavorite(p)}
                          aria-label={p.favorite ? "Remove from favorites" : "Add to favorites"}
                          aria-pressed={p.favorite}
                          className={cn(
                            "rounded-lg p-1.5 transition-colors",
                            p.favorite ? "text-danger" : "text-muted hover:bg-card hover:text-foreground",
                          )}
                        >
                          <Heart size={15} aria-hidden fill={p.favorite ? "currentColor" : "none"} />
                        </button>
                        <button
                          onClick={() => copyText(p.text, `hist-${p.id}`)}
                          aria-label="Copy prompt"
                          className="rounded-lg p-1.5 text-muted hover:bg-card hover:text-foreground"
                        >
                          {copiedKey === `hist-${p.id}` ? <Check size={15} aria-hidden className="text-primaryBright" /> : <Copy size={15} aria-hidden />}
                        </button>
                        <button
                          onClick={() => exportHistoryItem(p)}
                          aria-label="Export prompt as TXT"
                          className="rounded-lg p-1.5 text-muted hover:bg-card hover:text-foreground"
                        >
                          <Download size={15} aria-hidden />
                        </button>
                        <button
                          onClick={() => setDeleteId(p.id)}
                          aria-label="Delete prompt"
                          className="rounded-lg p-1.5 text-muted hover:bg-danger/20 hover:text-danger"
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{truncate(p.text, 280)}</p>
                    {p.negative && <p className="mt-1 text-xs text-muted">Negative: {truncate(p.negative, 120)}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deletePrompt(deleteId)}
        title="Delete saved prompt?"
        message="This prompt will be removed from your history. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
