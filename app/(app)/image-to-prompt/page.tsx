"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Download,
  ImagePlus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useAuth } from "@/components/providers";
import { dbFor, bumpUsage } from "@/lib/db";
import { downloadCsv, downloadTextFile } from "@/lib/csv";
import {
  loadImageFromFile,
  analyzeImage,
  describeAnalysis,
  nearestColorName,
  type ImageAnalysis,
} from "@/lib/image";
import { uid, nowIso } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ACCEPT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT_EXT = [".jpg", ".jpeg", ".png", ".webp"];
const ACCEPT_ATTR = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const MAX_FILES = 20;
const DRAFT_KEY = "ssa:v1:draft:prompt-idea";

// ---------- Prompt-building constants ----------

type ModeId =
  | "photorealistic"
  | "commercial"
  | "vector"
  | "minimalist"
  | "render3d"
  | "silhouette"
  | "cinematic"
  | "abstract"
  | "mockup"
  | "custom";

interface ModeDef {
  id: ModeId;
  label: string;
  style: string;
  commercial: boolean;
}

const MODES: ModeDef[] = [
  {
    id: "photorealistic",
    label: "Photorealistic",
    style: "Ultra-detailed photorealistic photograph, natural textures, realistic light and shadow",
    commercial: false,
  },
  {
    id: "commercial",
    label: "Commercial Stock Photography",
    style:
      "Commercial stock photograph with broad market appeal, model-released look, versatile for advertising use",
    commercial: true,
  },
  {
    id: "vector",
    label: "Vector Illustration",
    style: "Clean flat vector illustration, crisp edges, scalable shapes, limited flat color palette",
    commercial: false,
  },
  {
    id: "minimalist",
    label: "Minimalist Design",
    style: "Minimalist design, generous empty space, simple geometric forms, restrained composition",
    commercial: false,
  },
  {
    id: "render3d",
    label: "3D Render",
    style: "High-quality 3D render, soft studio lighting, physically-based materials, clean geometry",
    commercial: false,
  },
  {
    id: "silhouette",
    label: "Silhouette",
    style: "Bold single-color silhouette illustration, high contrast, isolated subject",
    commercial: false,
  },
  {
    id: "cinematic",
    label: "Cinematic",
    style: "Cinematic still frame, film-grade color grading, dramatic light, shallow depth of field",
    commercial: false,
  },
  {
    id: "abstract",
    label: "Abstract",
    style: "Abstract digital artwork, flowing forms, expressive color interplay",
    commercial: false,
  },
  {
    id: "mockup",
    label: "Product Mockup",
    style: "Premium product mockup scene, studio presentation, elegant staging, advertising-ready",
    commercial: true,
  },
  {
    id: "custom",
    label: "Custom Instructions",
    style: "",
    commercial: false,
  },
];

const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:2"];

const BACKGROUNDS = [
  { id: "asis", label: "As-is (keep original)", phrase: "keep the original background and environment of the reference image" },
  { id: "white", label: "White", phrase: "isolated on a clean white background" },
  { id: "transparent", label: "Transparent", phrase: "isolated on a transparent background (alpha channel)" },
  { id: "blurred", label: "Blurred", phrase: "background softly blurred into smooth bokeh" },
];

const NEG_SPACE = [
  { id: "none", label: "None (full-bleed)", phrase: "full-bleed composition, subject fills the frame" },
  { id: "subject-left", label: "Subject left", phrase: "subject placed on the left third, open negative space on the right for design use" },
  { id: "copy-space", label: "Copy space", phrase: "ample copy space in the upper area for headlines and text overlays" },
];

const MARKETS = [
  { id: "adobe-stock", label: "Adobe Stock" },
  { id: "shutterstock", label: "Shutterstock" },
  { id: "freepik", label: "Freepik" },
  { id: "vecteezy", label: "Vecteezy" },
  { id: "dreamstime", label: "Dreamstime" },
  { id: "depositphotos", label: "Depositphotos" },
  { id: "123rf", label: "123RF" },
  { id: "generic", label: "Generic (any marketplace)" },
];

const TRADEMARK_LINE = "Avoid trademarks, logos, and recognizable brands.";

// ---------- Types ----------

interface ImageItem {
  id: string;
  file: File;
  url: string;
  status: "pending" | "analyzing" | "done" | "error";
  analysis?: ImageAnalysis;
  descriptors?: string[];
  mood?: string;
  prompt?: string;
  error?: string;
}

// ---------- Measured-descriptor helpers ----------

function lightingPhrase(a: ImageAnalysis): string {
  const key = a.isMostlyDark ? "dark, low-key lighting" : a.isMostlyBright ? "bright, high-key lighting" : "balanced mid-tone exposure";
  const con = a.contrast > 0.55 ? "strong contrast" : a.contrast < 0.25 ? "soft, low-contrast tonal range" : "moderate contrast";
  const temp = a.warmth > 0.18 ? "warm color temperature" : a.warmth < -0.18 ? "cool color temperature" : "neutral color temperature";
  return `${key}, ${con}, ${temp}`;
}

function detailPhrase(a: ImageAnalysis): string {
  return a.edgeDensity > 0.5
    ? "highly detailed with intricate textures"
    : a.edgeDensity < 0.2
      ? "minimal detail, smooth surfaces"
      : "moderate fine detail";
}

/** Mood is inferred from brightness/contrast — always labeled "(suggested)". */
function moodFromAnalysis(a: ImageAnalysis): string {
  if (a.isMostlyDark && a.contrast > 0.5) return "moody and dramatic (suggested)";
  if (a.isMostlyBright && a.saturation > 0.5) return "upbeat and energetic (suggested)";
  if (a.saturation < 0.25 && a.contrast < 0.35) return "calm and minimal (suggested)";
  if (a.warmth > 0.3) return "warm and inviting (suggested)";
  if (a.warmth < -0.3) return "cool and clinical (suggested)";
  return "neutral and balanced (suggested)";
}

function palettePhrase(a: ImageAnalysis): string {
  const top = a.dominantColors.slice(0, 3);
  if (!top.length) return "no dominant palette detected";
  return top
    .map((c) => `${nearestColorName(c.hex)} (${c.hex}, ${Math.round(c.pct)}%)`)
    .join(", ");
}

interface BuilderControls {
  mode: ModeId;
  aspect: string;
  background: string;
  negSpace: string;
  market: string;
  customInstructions: string;
}

function buildPrompt(a: ImageAnalysis, controls: BuilderControls): string {
  const mode = MODES.find((m) => m.id === controls.mode) ?? MODES[0];
  const styleLine =
    controls.mode === "custom"
      ? controls.customInstructions.trim() || "Custom creative artwork"
      : mode.style;
  const bg = BACKGROUNDS.find((b) => b.id === controls.background) ?? BACKGROUNDS[0];
  const ns = NEG_SPACE.find((n) => n.id === controls.negSpace) ?? NEG_SPACE[0];
  const market = MARKETS.find((m) => m.id === controls.market) ?? MARKETS[7];

  const parts = [
    styleLine,
    `${a.orientation} composition at ${a.width} by ${a.height} pixels`,
    `lighting: ${lightingPhrase(a)}`,
    `color palette: ${palettePhrase(a)}`,
    `detail: ${detailPhrase(a)}`,
    `mood: ${moodFromAnalysis(a)}`,
    bg.phrase,
    ns.phrase,
    `aspect ratio ${controls.aspect}`,
    `composition optimized for ${market.label}`,
  ];
  let prompt = parts.join(". ") + ".";
  if (mode.commercial) prompt += ` ${TRADEMARK_LINE}`;
  return prompt;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

// ---------- Page ----------

export default function ImageToPromptPage() {
  const { user } = useAuth();
  const router = useRouter();
  const db = useMemo(() => dbFor(user?.id ?? "demo-user"), [user?.id]);

  const [items, setItems] = useState<ImageItem[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const [mode, setMode] = useState<ModeId>("photorealistic");
  const [aspect, setAspect] = useState("1:1");
  const [background, setBackground] = useState("asis");
  const [negSpace, setNegSpace] = useState("none");
  const [market, setMarket] = useState("adobe-stock");
  const [customInstructions, setCustomInstructions] = useState("");

  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replacingId = useRef<string | null>(null);

  // Revoke all object URLs on unmount (without touching state).
  const itemsRef = useRef<ImageItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, []);

  const dismissFileError = (idx: number) =>
    setFileErrors((prev) => prev.filter((_, i) => i !== idx));

  const addFiles = (files: File[]) => {
    const ok: File[] = [];
    const rejected: string[] = [];
    for (const f of files) {
      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
      if (ACCEPT_TYPES.includes(f.type) || ACCEPT_EXT.includes(ext)) ok.push(f);
      else rejected.push(f.name);
    }
    if (rejected.length) {
      setFileErrors((prev) => [
        ...prev,
        `Rejected ${rejected.length} file(s): ${rejected.join(", ")} — only JPG, JPEG, PNG and WebP are supported.`,
      ]);
    }
    if (ok.length) {
      setItems((prev) => [
        ...prev,
        ...ok.map((f) => ({
          id: uid(),
          file: f,
          url: URL.createObjectURL(f),
          status: "pending" as const,
        })),
      ]);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    setItems((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.url));
      return [];
    });
    setFileErrors([]);
    setConfirmClear(false);
  };

  const startReplace = (id: string) => {
    replacingId.current = id;
    replaceInputRef.current?.click();
  };

  const handleReplace = (files: FileList | null) => {
    const id = replacingId.current;
    replacingId.current = null;
    const f = files?.[0];
    if (!id || !f) return;
    const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
    if (!ACCEPT_TYPES.includes(f.type) && !ACCEPT_EXT.includes(ext)) {
      setFileErrors((prev) => [...prev, `Replacement rejected: ${f.name} — only JPG, JPEG, PNG and WebP are supported.`]);
      return;
    }
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        URL.revokeObjectURL(i.url);
        return {
          id,
          file: f,
          url: URL.createObjectURL(f),
          status: "pending" as const,
        };
      }),
    );
  };

  const copyText = async (text: string, id: string) => {
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
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600);
  };

  const analyzeAll = async () => {
    const targets = items.filter((i) => i.status === "pending" || i.status === "error");
    if (!targets.length || analyzing) return;
    setAnalyzing(true);
    setProgress(0);

    const controls: BuilderControls = { mode, aspect, background, negSpace, market, customInstructions };
    const jobId = uid();
    const startedAt = nowIso();
    const title = `Image → Prompt: ${targets.length} image(s)`;
    db.jobs.upsert({ id: jobId, type: "image-to-prompt", title, status: "processing", total: targets.length, done: 0, failed: 0, createdAt: startedAt, updatedAt: startedAt });

    let done = 0;
    let failed = 0;
    for (let idx = 0; idx < targets.length; idx++) {
      const item = targets[idx];
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "analyzing" as const, error: undefined } : p)));
      await new Promise((r) => setTimeout(r, 0)); // UI yield
      try {
        const img = await loadImageFromFile(item.file);
        const a = analyzeImage(img);
        const prompt = buildPrompt(a, controls);
        const descriptors = describeAnalysis(a);
        const mood = moodFromAnalysis(a);
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, status: "done" as const, analysis: a, descriptors, mood, prompt } : p,
          ),
        );
        done++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not decode image";
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "error" as const, error: msg } : p)));
        failed++;
      }
      db.jobs.upsert({ id: jobId, type: "image-to-prompt", title, status: "processing", total: targets.length, done, failed, createdAt: startedAt, updatedAt: nowIso() });
      setProgress(Math.round(((idx + 1) / targets.length) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }

    db.jobs.upsert({
      id: jobId,
      type: "image-to-prompt",
      title,
      status: failed === targets.length ? "failed" : "completed",
      total: targets.length,
      done,
      failed,
      note: `${done} prompt(s) created, ${failed} failed`,
      createdAt: startedAt,
      updatedAt: nowIso(),
    });
    if (done > 0) bumpUsage(db, { imagesProcessed: done, promptsCreated: done });
    setAnalyzing(false);
  };

  /** Rebuild prompts for analyzed images with the current controls (no re-analysis). */
  const rebuildPrompts = () => {
    const controls: BuilderControls = { mode, aspect, background, negSpace, market, customInstructions };
    setItems((prev) =>
      prev.map((i) =>
        i.status === "done" && i.analysis
          ? { ...i, prompt: buildPrompt(i.analysis, controls) }
          : i,
      ),
    );
  };

  const recordExport = (kind: "txt" | "csv", filename: string, detail: string, sizeBytes: number) => {
    db.exports.upsert({ id: uid(), kind, filename, detail, sizeBytes, createdAt: nowIso() });
    bumpUsage(db, { bytesExported: sizeBytes });
  };

  const downloadPromptTxt = (item: ImageItem) => {
    if (!item.prompt) return;
    const modeLabel = MODES.find((m) => m.id === mode)?.label ?? mode;
    const text = [
      `IMAGE-TO-PROMPT — ${item.file.name}`,
      `Generated: ${nowIso()}`,
      `Mode: ${modeLabel}`,
      `Aspect: ${aspect} · Background: ${background} · Negative space: ${negSpace} · Marketplace: ${market}`,
      "",
      "PROMPT",
      item.prompt,
      "",
      "MEASURED ANALYSIS (on-device, not AI)",
      ...(item.descriptors ?? []),
      `Suggested mood: ${item.mood ?? "n/a"}`,
    ].join("\n");
    const filename = `${stripExtension(item.file.name)}-prompt.txt`;
    downloadTextFile(filename, text);
    recordExport("txt", filename, `Image-to-prompt: ${item.file.name}`, new Blob([text]).size);
  };

  const doneItems = items.filter((i) => i.status === "done" && i.prompt);

  const downloadAllTxt = () => {
    if (!doneItems.length) return;
    const modeLabel = MODES.find((m) => m.id === mode)?.label ?? mode;
    const text = doneItems
      .map((i) => `--- ${i.file.name} (mode: ${modeLabel}) ---\n${i.prompt}`)
      .join("\n\n\n");
    const filename = `image-to-prompt-all-${Date.now()}.txt`;
    downloadTextFile(filename, text);
    recordExport("txt", filename, `Image-to-prompt bulk: ${doneItems.length} prompt(s)`, new Blob([text]).size);
  };

  const downloadAllCsv = () => {
    if (!doneItems.length) return;
    const modeLabel = MODES.find((m) => m.id === mode)?.label ?? mode;
    const size = downloadCsv(
      `image-to-prompt-all-${Date.now()}.csv`,
      ["Filename", "Mode", "Prompt"],
      doneItems.map((i) => ({ Filename: i.file.name, Mode: modeLabel, Prompt: i.prompt })),
    );
    recordExport("csv", `image-to-prompt-all.csv`, `Image-to-prompt bulk CSV: ${doneItems.length} prompt(s)`, size);
  };

  const sendToGenerator = (item: ImageItem) => {
    if (!item.prompt) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ idea: item.prompt, category: "stock-photo" }));
    } catch {
      // storage unavailable — still navigate
    }
    router.push("/prompt-generator");
  };

  const pendingCount = items.filter((i) => i.status === "pending" || i.status === "error").length;

  return (
    <div>
      <PageHeader
        title="Image → Prompt"
        description="Upload reference photos. Each image is measured on-device (dimensions, lighting, palette) and turned into a detailed, ready-to-use generator prompt — no AI, no cloud upload."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Left column: upload + controls */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>1 · Upload images</CardTitle>
              <Badge tone="neutral">{items.length}/{MAX_FILES}</Badge>
            </CardHeader>
            <FileDropzone
              accept={ACCEPT_ATTR}
              multiple
              maxFiles={MAX_FILES}
              onFiles={addFiles}
              label="Drag and drop images (PNG, JPG, WebP)"
              hint="Analyzed on-device."
              batchLimit={MAX_FILES}
              formats={["PNG", "JPG", "WEBP"]}
            />
            <input
              ref={replaceInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              aria-hidden
              onChange={(e) => {
                handleReplace(e.target.files);
                e.target.value = "";
              }}
            />
            {fileErrors.length > 0 && (
              <div className="mt-4 flex flex-col gap-2" role="alert">
                {fileErrors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
                    <span className="flex-1">{err}</span>
                    <button onClick={() => dismissFileError(idx)} aria-label="Dismiss error" className="rounded p-0.5 hover:bg-danger/20">
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2 · Prompt controls</CardTitle>
            </CardHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="itp-mode">Generation mode</Label>
                <Select
                  id="itp-mode"
                  options={MODES.map((m) => ({ value: m.id, label: m.label }))}
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ModeId)}
                />
              </div>
              {mode === "custom" && (
                <div className="sm:col-span-2">
                  <Label htmlFor="itp-custom">Custom instructions</Label>
                  <Textarea
                    id="itp-custom"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Describe exactly what you want the prompt to say, e.g. 'flat lay of workspace items, pastel colors…'"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="itp-aspect">Aspect ratio</Label>
                <Select id="itp-aspect" options={ASPECTS} value={aspect} onChange={(e) => setAspect(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="itp-bg">Background</Label>
                <Select
                  id="itp-bg"
                  options={BACKGROUNDS.map((b) => ({ value: b.id, label: b.label }))}
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="itp-negspace">Negative space</Label>
                <Select
                  id="itp-negspace"
                  options={NEG_SPACE.map((n) => ({ value: n.id, label: n.label }))}
                  value={negSpace}
                  onChange={(e) => setNegSpace(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="itp-market">Marketplace</Label>
                <Select
                  id="itp-market"
                  options={MARKETS.map((m) => ({ value: m.id, label: m.label }))}
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={analyzeAll} loading={analyzing} disabled={!pendingCount}>
                <Sparkles size={16} aria-hidden />
                {analyzing ? "Analyzing…" : `Analyze ${pendingCount ? `(${pendingCount})` : ""}`}
              </Button>
              <Button variant="secondary" onClick={rebuildPrompts} disabled={!doneItems.length || analyzing}>
                <RotateCcw size={16} aria-hidden />
                Rebuild prompts
              </Button>
              <Button variant="ghost" onClick={() => setConfirmClear(true)} disabled={!items.length || analyzing}>
                <Trash2 size={16} aria-hidden />
                Clear all
              </Button>
            </div>
            {analyzing && (
              <div className="mt-4">
                <Progress value={progress} aria-label="Analysis progress" />
                <p className="mt-2 text-xs text-muted">Analyzing images on-device… {progress}%</p>
              </div>
            )}
          </Card>
        </div>

        {/* Right column: thumbnails + results */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>3 · Results</CardTitle>
              {doneItems.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={downloadAllTxt}>
                    <Download size={14} aria-hidden /> All as TXT
                  </Button>
                  <Button size="sm" variant="secondary" onClick={downloadAllCsv}>
                    <Download size={14} aria-hidden /> All as CSV
                  </Button>
                </div>
              )}
            </CardHeader>

            {items.length === 0 ? (
              <EmptyState
                icon={<ImagePlus size={36} aria-hidden />}
                title="No images yet"
                description="Upload JPG, JPEG, PNG or WebP images to measure their visual attributes and build prompts from them."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((item) => (
                  <div key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-secondary/50">
                    <div className="relative aspect-video w-full overflow-hidden bg-black/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" />
                      <div className="absolute left-2 top-2">
                        <Badge
                          tone={
                            item.status === "done" ? "success" : item.status === "error" ? "red" : item.status === "analyzing" ? "blue" : "neutral"
                          }
                        >
                          {item.status === "done" ? "Prompt ready" : item.status === "error" ? "Failed" : item.status === "analyzing" ? "Analyzing…" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <p className="truncate text-sm font-medium text-foreground" title={item.file.name}>
                        {item.file.name}
                      </p>

                      {item.status === "error" && (
                        <p className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs text-danger" role="alert">
                          {item.error ?? "Could not decode image."}
                        </p>
                      )}

                      {item.status === "done" && item.analysis && (
                        <div className="rounded-xl border border-border bg-card p-3 text-xs">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                            Measured on-device
                          </p>
                          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-muted">
                            <div><dt className="inline text-muted">Size: </dt><dd className="inline text-foreground">{item.analysis.width}×{item.analysis.height}px</dd></div>
                            <div><dt className="inline text-muted">Orientation: </dt><dd className="inline text-foreground capitalize">{item.analysis.orientation}</dd></div>
                            <div><dt className="inline text-muted">Brightness: </dt><dd className="inline text-foreground">{Math.round(item.analysis.brightness * 100)}%</dd></div>
                            <div><dt className="inline text-muted">Contrast: </dt><dd className="inline text-foreground">{Math.round(item.analysis.contrast * 100)}%</dd></div>
                          </dl>
                          <div className="mt-2.5">
                            <p className="mb-1.5 text-muted">Top colors</p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.analysis.dominantColors.slice(0, 5).map((c) => (
                                <span
                                  key={c.hex}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-foreground"
                                  title={`${c.hex} — ${Math.round(c.pct)}%`}
                                >
                                  <span
                                    className="h-3 w-3 rounded-full border border-black/30"
                                    style={{ backgroundColor: c.hex }}
                                    aria-hidden
                                  />
                                  {nearestColorName(c.hex)} · {Math.round(c.pct)}%
                                </span>
                              ))}
                            </div>
                          </div>
                          {item.mood && (
                            <p className="mt-2 text-muted">
                              Suggested mood: <span className="text-foreground">{item.mood}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {item.prompt && (
                        <Textarea
                          value={item.prompt}
                          readOnly
                          aria-label={`Generated prompt for ${item.file.name}`}
                          className="min-h-[120px] text-xs leading-relaxed"
                        />
                      )}

                      <div className="mt-auto flex flex-wrap gap-2 pt-1">
                        {item.prompt && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => copyText(item.prompt!, item.id)}>
                              {copiedId === item.id ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                              {copiedId === item.id ? "Copied" : "Copy"}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => downloadPromptTxt(item)}>
                              <Download size={14} aria-hidden /> TXT
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => sendToGenerator(item)}>
                              Send to Prompt Generator <ArrowRight size={14} aria-hidden />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => startReplace(item.id)} disabled={analyzing}>
                          <RefreshCw size={14} aria-hidden /> Replace
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)} disabled={analyzing} aria-label={`Remove ${item.file.name}`}>
                          <X size={14} aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <p className={cn("mt-6 text-xs text-muted")}>
        Prompts are assembled on-device from measured image attributes and templates — demo mode, not a real AI
        model. Prompts do not guarantee marketplace acceptance, downloads, or sales.
      </p>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAll}
        title="Clear all images?"
        message={`Remove all ${items.length} uploaded image(s) and their results? This cannot be undone.`}
        confirmLabel="Clear all"
      />
    </div>
  );
}
