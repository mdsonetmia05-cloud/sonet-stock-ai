"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileCode,
  FileImage,
  Film,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers";
import {
  bumpUsage,
  dbFor,
  type Job,
  type MetadataRecord,
  type UserPreferences,
} from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { downloadCsv } from "@/lib/csv";
import { loadImageFromFile, analyzeImage, type ImageAnalysis } from "@/lib/image";
import {
  MARKETPLACE_PROFILES,
  CONTENT_CATEGORIES,
  blankManualMetadata,
  buildRankedKeywords,
  dedupeKeywords,
  defaultMetadataSettings,
  generateMetadata,
  generateVectorMetadata,
  humanizeFileName,
  parseSvgHints,
  profileFor,
  type GeneratedMetadata,
  type MetadataSettings,
  type SvgHints,
} from "@/lib/metadata";
import { cn, nowIso, uid } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type FileKind = "raster" | "svg" | "manual" | "rejected";
type MediaType = "image" | "video" | "vector" | "other";
type ItemStatus = "queued" | "analyzing" | "ready" | "error";

interface MetaFields {
  title: string;
  description: string;
  keywords: string[];
  category: string;
  style: string;
  commercialConcept: string;
  mainSubject: string;
  secondarySubjects: string[];
}

interface WorkFile {
  id: string;
  file: File;
  name: string;
  kind: FileKind;
  mediaType: MediaType;
  previewUrl: string | null;
  status: ItemStatus;
  error?: string;
  analysis?: ImageAnalysis;
  svgHints?: SvgHints;
  recordId?: string;
  savedAt?: string;
  fields: MetaFields;
}

const ACCEPT = ".jpg,.jpeg,.png,.webp,.svg,.eps,.ai,.mp4,.mov,.webm";
const RASTER_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "webm"]);

function classifyFile(file: File): { kind: FileKind; mediaType: MediaType; error?: string } {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (RASTER_EXTS.has(ext) || file.type.startsWith("image/")) {
    if (ext === "svg") return { kind: "svg", mediaType: "vector" };
    return { kind: "raster", mediaType: "image" };
  }
  if (ext === "svg") return { kind: "svg", mediaType: "vector" };
  if (ext === "eps" || ext === "ai") return { kind: "manual", mediaType: "other" };
  if (VIDEO_EXTS.has(ext) || file.type.startsWith("video/"))
    return { kind: "manual", mediaType: "video" };
  return {
    kind: "rejected",
    mediaType: "other",
    error: `Unsupported file type ".${ext || "?"}" — accepted: JPG, JPEG, PNG, WebP, SVG, EPS, AI, MP4, MOV, WebM.`,
  };
}

function fieldsFromGenerated(g: GeneratedMetadata): MetaFields {
  return {
    title: g.title,
    description: g.description,
    keywords: g.keywords,
    category: g.category,
    style: g.style,
    commercialConcept: g.commercialConcept,
    mainSubject: g.mainSubject,
    secondarySubjects: g.secondarySubjects,
  };
}

const CSV_COLUMNS = ["Filename", "Title", "Description", "Keywords", "Category", "Platform"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function MetadataGeneratorPage() {
  const { user } = useAuth();
  const db = useMemo(() => (user ? dbFor(user.id) : null), [user]);

  const [items, setItems] = useState<WorkFile[]>([]);
  const [settings, setSettings] = useState<MetadataSettings>(() =>
    defaultMetadataSettings({
      theme: "dark",
      defaultMarketplace: "adobe-stock",
      minTitleWords: 7,
      maxTitleWords: 15,
      minKeywords: 25,
      maxKeywords: 35,
      descriptionWords: 20,
      singleWordKeywords: true,
      prohibitedWords: "",
    }),
  );
  const [processing, setProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [notice, setNotice] = useState<{ tone: "green" | "red" | "amber"; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [kwInputs, setKwInputs] = useState<Record<string, string>>({});

  const processingRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /* Load saved preferences on mount */
  useEffect(() => {
    if (!db) return;
    try {
      const prefs = db.preferences.get();
      setSettings(defaultMetadataSettings(prefs));
    } catch {
      /* keep defaults */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* Revoke previews on unmount */
  useEffect(() => {
    return () => {
      setItems((prev) => {
        prev.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
        return prev;
      });
    };
  }, []);

  const flashNotice = (tone: "green" | "red" | "amber", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 6000);
  };

  /* ---------------- db persistence ---------------- */

  const persistRecord = useCallback(
    (item: WorkFile): string | undefined => {
      if (!db || item.status !== "ready") return undefined;
      const profile = profileFor(settingsRef.current.profileId);
      const rec: MetadataRecord = {
        id: item.recordId ?? uid(),
        jobId: jobIdRef.current ?? undefined,
        filename: item.name,
        title: item.fields.title,
        description: item.fields.description,
        keywords: dedupeKeywords(item.fields.keywords),
        category: item.fields.category,
        style: item.fields.style || undefined,
        commercialConcept: item.fields.commercialConcept || undefined,
        platform: profile.label,
        createdAt: nowIso(),
      };
      const saved = db.metadata.upsert(rec);
      return saved.id;
    },
    [db],
  );

  const updateFields = useCallback(
    (id: string, patch: Partial<MetaFields>, save = true) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;
          const fields: MetaFields = { ...it.fields, ...patch };
          return { ...it, fields };
        }),
      );
      if (save) {
        // persist after state settles — read latest item snapshot below
        window.setTimeout(() => {
          setItems((prev) => {
            const it = prev.find((x) => x.id === id);
            if (it && it.status === "ready" && db) {
              const recordId = persistRecord(it);
              if (recordId && recordId !== it.recordId) {
                return prev.map((x) =>
                  x.id === id ? { ...x, recordId, savedAt: nowIso() } : x,
                );
              }
              return prev.map((x) => (x.id === id ? { ...x, savedAt: nowIso() } : x));
            }
            return prev;
          });
        }, 0);
      }
    },
    [db, persistRecord],
  );

  /* ---------------- file intake & processing ---------------- */

  const patchItem = useCallback((id: string, patch: Partial<WorkFile>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const processItem = useCallback(
    async (item: WorkFile, snap: MetadataSettings): Promise<WorkFile> => {
      const profile = profileFor(snap.profileId);
      try {
        if (item.kind === "raster") {
          const img = await loadImageFromFile(item.file);
          const analysis = analyzeImage(img);
          const gen = generateMetadata({
            analysis,
            fileName: item.name,
            settings: snap,
            profile,
          });
          return {
            ...item,
            status: "ready",
            analysis,
            fields: fieldsFromGenerated(gen),
          };
        }
        if (item.kind === "svg") {
          const text = await item.file.text();
          const hints = parseSvgHints(text);
          const gen = generateVectorMetadata(item.name, hints, snap, profile);
          return {
            ...item,
            status: "ready",
            svgHints: hints,
            fields: fieldsFromGenerated(gen),
          };
        }
        if (item.kind === "manual") {
          await new Promise((r) => setTimeout(r, 0));
          const gen = blankManualMetadata(item.name, snap, profile);
          return { ...item, status: "ready", fields: fieldsFromGenerated(gen) };
        }
        return item;
      } catch (e) {
        return {
          ...item,
          status: "error",
          error: e instanceof Error ? e.message : "Failed to process this file.",
        };
      }
    },
    [],
  );

  const recordJobProgress = useCallback(
    (jobId: string, total: number, done: number, failed: number) => {
      if (!db) return;
      const existing =
        (db.jobs.get(jobId) as Job | undefined) ??
        ({
          id: jobId,
          type: "metadata",
          title: `Metadata generation — ${total} file${total === 1 ? "" : "s"}`,
          status: "processing",
          total,
          done: 0,
          failed: 0,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        } as Job);
      const finished = done + failed >= total;
      db.jobs.upsert({
        ...existing,
        total,
        done,
        failed,
        status: finished ? (done > 0 ? "completed" : "failed") : "processing",
        note: `${done} of ${total} completed, ${failed} failed`,
        updatedAt: nowIso(),
      });
    },
    [db],
  );

  const runQueue = useCallback(
    async (ids: string[]) => {
      if (processingRef.current || ids.length === 0) return;
      processingRef.current = true;
      setProcessing(true);
      const jobId = uid();
      jobIdRef.current = jobId;
      const total = ids.length;
      let done = 0;
      let failed = 0;
      recordJobProgress(jobId, total, 0, 0);

      const snap = settingsRef.current;
      for (const id of ids) {
        // read the freshest copy of the item, mark analyzing, then process
        patchItem(id, { status: "analyzing", error: undefined });
        // small yield so the UI stays responsive
        await new Promise((r) => setTimeout(r, 0));
        let base: WorkFile | undefined;
        setItems((prev) => {
          base = prev.find((x) => x.id === id);
          return prev;
        });
        if (!base) {
          failed++;
          continue;
        }
        const result = await processItem(base, snap);
        if (result.status === "ready") {
          done++;
          // persist + usage
          const recordId = db ? persistRecord(result) : undefined;
          patchItem(id, { ...result, recordId, savedAt: recordId ? nowIso() : undefined });
          if (db) {
            bumpUsage(db, {
              metadataGenerated: 1,
              imagesProcessed: result.kind === "raster" ? 1 : 0,
            });
          }
        } else {
          failed++;
          patchItem(id, { ...result });
        }
        recordJobProgress(jobId, total, done, failed);
        await new Promise((r) => setTimeout(r, 0));
      }

      processingRef.current = false;
      setProcessing(false);
      if (failed === 0) flashNotice("green", `Done — ${done} of ${total} file${total === 1 ? "" : "s"} generated.`);
      else if (done === 0) flashNotice("red", `All ${total} files failed. Check the error cards and retry.`);
      else flashNotice("amber", `${done} of ${total} completed, ${failed} failed.`);
    },
    [db, patchItem, persistRecord, processItem, recordJobProgress],
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      const fresh: WorkFile[] = files.map((file) => {
        const { kind, mediaType, error } = classifyFile(file);
        const needsPreview = mediaType === "image" || mediaType === "video" || mediaType === "vector";
        return {
          id: uid(),
          file,
          name: file.name,
          kind,
          mediaType,
          previewUrl: needsPreview && !error ? URL.createObjectURL(file) : null,
          status: error ? ("error" as ItemStatus) : ("queued" as ItemStatus),
          error,
          fields: {
            title: humanizeFileName(file.name),
            description: "",
            keywords: [],
            category: "Objects",
            style: "",
            commercialConcept: "",
            mainSubject: "",
            secondarySubjects: [],
          },
        };
      });
      setItems((prev) => [...prev, ...fresh]);
      const queued = fresh.filter((f) => f.status === "queued").map((f) => f.id);
      if (queued.length) void runQueue(queued);
    },
    [runQueue],
  );

  const retryItem = useCallback(
    (id: string) => {
      patchItem(id, { status: "queued", error: undefined, analysis: undefined });
      void runQueue([id]);
    },
    [patchItem, runQueue],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
      return [];
    });
    jobIdRef.current = null;
  }, []);

  /* ---------------- clipboard ---------------- */

  const copyText = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* clipboard unavailable */
      }
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }, []);

  const formatRecord = (f: WorkFile): string =>
    `Filename: ${f.name}\nTitle: ${f.fields.title}\nDescription: ${f.fields.description}\nKeywords: ${f.fields.keywords.join(", ")}\nCategory: ${f.fields.category}\nPlatform: ${profileFor(settingsRef.current.profileId).label}`;

  /* ---------------- CSV export ---------------- */

  const rowFor = (f: WorkFile): Record<string, unknown> => ({
    Filename: f.name,
    Title: f.fields.title,
    Description: f.fields.description,
    Keywords: dedupeKeywords(f.fields.keywords).join("; "),
    Category: f.fields.category,
    Platform: profileFor(settingsRef.current.profileId).label,
  });

  const logExport = (filename: string, detail: string, sizeBytes: number) => {
    if (!db) return;
    db.exports.upsert({
      id: uid(),
      kind: "csv",
      filename,
      detail,
      sizeBytes,
      createdAt: nowIso(),
    });
    bumpUsage(db, { bytesExported: sizeBytes });
  };

  const exportAllCsv = () => {
    const ready = items.filter((i) => i.status === "ready");
    if (!ready.length) {
      flashNotice("amber", "Nothing to export yet — generate metadata first.");
      return;
    }
    const filename = `sonet-stock-ai-metadata-${new Date().toISOString().slice(0, 10)}.csv`;
    const size = downloadCsv(filename, CSV_COLUMNS, ready.map(rowFor));
    logExport(filename, `${ready.length} metadata records`, size);
    flashNotice("green", `Exported ${ready.length} record${ready.length === 1 ? "" : "s"} to ${filename}.`);
  };

  const exportOneCsv = (f: WorkFile) => {
    const base = humanizeFileName(f.name) || "metadata";
    const filename = `${base}-metadata.csv`;
    const size = downloadCsv(filename, CSV_COLUMNS, [rowFor(f)]);
    logExport(filename, `1 metadata record (${f.name})`, size);
    flashNotice("green", `Exported metadata for ${f.name}.`);
  };

  const copyAll = () => {
    const ready = items.filter((i) => i.status === "ready");
    if (!ready.length) {
      flashNotice("amber", "Nothing to copy yet — generate metadata first.");
      return;
    }
    void copyText(ready.map(formatRecord).join("\n\n---\n\n"), "bulk");
  };

  /* ---------------- settings ---------------- */

  const saveSettings = () => {
    if (!db) {
      flashNotice("amber", "Sign in to persist settings.");
      return;
    }
    const current = db.preferences.get();
    const next: UserPreferences = {
      ...current,
      defaultMarketplace: settings.profileId,
      minTitleWords: settings.minTitleWords,
      maxTitleWords: settings.maxTitleWords,
      minKeywords: settings.minKeywords,
      maxKeywords: settings.maxKeywords,
      descriptionWords: settings.descriptionWords,
      singleWordKeywords: settings.singleWordMode,
      prohibitedWords: settings.prohibitedWords,
    };
    db.preferences.save(next);
    flashNotice("green", "Settings saved to preferences.");
  };

  const resetSettings = () => {
    setSettings(
      defaultMetadataSettings({
        theme: "dark",
        defaultMarketplace: "adobe-stock",
        minTitleWords: 7,
        maxTitleWords: 15,
        minKeywords: 25,
        maxKeywords: 35,
        descriptionWords: 20,
        singleWordKeywords: true,
        prohibitedWords: "",
      }),
    );
    flashNotice("green", "Settings reset to defaults.");
  };

  const setNum = (key: "minTitleWords" | "maxTitleWords" | "minKeywords" | "maxKeywords" | "descriptionWords") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseInt(e.target.value, 10);
      setSettings((s) => ({ ...s, [key]: Number.isNaN(v) ? s[key] : Math.max(1, Math.min(200, v)) }));
    };

  const regenerateItem = useCallback(
    (item: WorkFile) => {
      const snap = settingsRef.current;
      const profile = profileFor(snap.profileId);
      let gen: GeneratedMetadata | null = null;
      if (item.kind === "raster" && item.analysis) {
        gen = generateMetadata({ analysis: item.analysis, fileName: item.name, settings: snap, profile });
      } else if (item.kind === "svg" && item.svgHints) {
        gen = generateVectorMetadata(item.name, item.svgHints, snap, profile);
      } else if (item.kind === "svg") {
        gen = generateVectorMetadata(item.name, {}, snap, profile);
      } else if (item.kind === "manual") {
        const kw = buildRankedKeywords([], "Objects", [], [], [], snap, profile);
        gen = blankManualMetadata(item.name, snap, profile);
        if (!item.fields.keywords.length) gen.keywords = kw;
      }
      if (!gen) return;
      updateFields(item.id, fieldsFromGenerated(gen));
      flashNotice("green", `Regenerated suggested metadata for ${item.name}.`);
    },
    [updateFields],
  );

  /* ---------------- derived ---------------- */

  const total = items.length;
  const doneCount = items.filter((i) => i.status === "ready").length;
  const failedCount = items.filter((i) => i.status === "error").length;
  const activeCount = items.filter((i) => i.status === "queued" || i.status === "analyzing").length;
  const progress = total ? Math.round(((doneCount + failedCount) / total) * 100) : 0;
  const profile = profileFor(settings.profileId);

  /* ---------------- render helpers ---------------- */

  const renderPreview = (f: WorkFile) => {
    if (f.previewUrl && f.mediaType === "image") {
      return <img src={f.previewUrl} alt={f.name} className="h-full w-full rounded-xl object-cover" />;
    }
    if (f.previewUrl && f.mediaType === "video") {
      return <video src={f.previewUrl} controls className="h-full w-full rounded-xl object-cover" aria-label={f.name} />;
    }
    if (f.previewUrl && f.mediaType === "vector") {
      return <img src={f.previewUrl} alt={f.name} className="h-full w-full rounded-xl bg-secondary object-contain p-4" />;
    }
    const Icon = f.kind === "svg" ? FileCode : f.mediaType === "video" ? Film : FileImage;
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-secondary">
        <Icon size={44} className="text-muted" aria-hidden />
      </div>
    );
  };

  const kindBadge = (f: WorkFile) => {
    if (f.status === "error") return <Badge tone="red">Error</Badge>;
    if (f.status === "analyzing" || f.status === "queued") return <Badge tone="blue">Analyzing…</Badge>;
    if (f.kind === "raster") return <Badge tone="green">Vision-analyzed</Badge>;
    if (f.kind === "svg") return <Badge tone="amber">Metadata-only</Badge>;
    return <Badge tone="neutral">Manual flow</Badge>;
  };

  const flowNotice = (f: WorkFile) => {
    if (f.kind === "svg")
      return (
        <p className="mt-2 flex items-start gap-2 text-xs text-amber-400">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          Metadata-only flow — vector file, not vision-analyzed on-device.
        </p>
      );
    if (f.kind === "manual")
      return (
        <p className="mt-2 flex items-start gap-2 text-xs text-amber-400">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          Cannot be vision-analyzed on-device in demo mode. Use the manual metadata flow below.
        </p>
      );
    return null;
  };

  const addKeyword = (f: WorkFile) => {
    const raw = (kwInputs[f.id] ?? "").trim();
    if (!raw) return;
    const next = dedupeKeywords([...f.fields.keywords, raw]);
    updateFields(f.id, { keywords: next });
    setKwInputs((s) => ({ ...s, [f.id]: "" }));
  };

  const removeKeyword = (f: WorkFile, kw: string) => {
    updateFields(f.id, { keywords: f.fields.keywords.filter((k) => k !== kw) });
  };

  /* ---------------- render ---------------- */

  return (
    <div>
      <PageHeader
        title="AI Metadata Generator"
        description="Drop in your assets — titles, descriptions and ranked keywords are suggested on-device from image statistics and marketplace profile rules. Review everything before submitting; nothing here promises acceptance, downloads or sales."
      />

      {notice && (
        <div
          role="status"
          className={cn(
            "mb-4 rounded-xl border px-4 py-3 text-sm",
            notice.tone === "green" && "border-primary/30 bg-primary/10 text-primaryBright",
            notice.tone === "red" && "border-danger/30 bg-danger/10 text-danger",
            notice.tone === "amber" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
          )}
        >
          {notice.text}
        </div>
      )}

      {/* Upload */}
      <Card className="mb-6">
        <FileDropzone
          accept={ACCEPT}
          multiple
          onFiles={handleFiles}
          label="Drag and drop assets here"
          hint="JPG, JPEG, PNG, WebP · SVG · EPS, AI · MP4, MOV, WebM — raster images are vision-analyzed on-device"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted" aria-live="polite">
            Detected files: <span className="font-semibold text-foreground">{total}</span>
            {total > 0 && (
              <span className="ml-3">
                {doneCount} ready · {activeCount} analyzing · {failedCount} failed
              </span>
            )}
          </p>
          {total > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportAllCsv} disabled={doneCount === 0}>
                <Download size={14} aria-hidden /> Export all CSV
              </Button>
              <Button variant="outline" size="sm" onClick={copyAll} disabled={doneCount === 0}>
                {copiedKey === "bulk" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                {copiedKey === "bulk" ? "Copied" : "Copy all"}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <Trash2 size={14} aria-hidden /> Start over
              </Button>
            </div>
          )}
        </div>
        {total > 0 && (
          <div className="mt-3">
            <Progress value={progress} />
            {processing && (
              <p className="mt-2 text-xs text-muted" aria-live="polite">
                Analyzing files… {doneCount + failedCount} of {total} processed
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 size={16} aria-hidden /> Generation settings
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
            <ChevronDown size={16} className={cn("transition-transform", !showSettings && "-rotate-90")} aria-hidden />
            {showSettings ? "Hide" : "Show"}
          </Button>
        </CardHeader>
        {showSettings && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="mg-profile">Marketplace profile</Label>
              <Select
                id="mg-profile"
                options={MARKETPLACE_PROFILES.map((p) => ({ value: p.id, label: p.label }))}
                value={settings.profileId}
                onChange={(e) => setSettings((s) => ({ ...s, profileId: e.target.value }))}
              />
              <p className="mt-1.5 text-xs text-muted">{profile.notes}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mg-min-title">Min title words</Label>
                <Input id="mg-min-title" type="number" min={1} max={50} value={settings.minTitleWords} onChange={setNum("minTitleWords")} />
              </div>
              <div>
                <Label htmlFor="mg-max-title">Max title words</Label>
                <Input id="mg-max-title" type="number" min={1} max={50} value={settings.maxTitleWords} onChange={setNum("maxTitleWords")} />
              </div>
              <div>
                <Label htmlFor="mg-min-kw">Min keywords</Label>
                <Input id="mg-min-kw" type="number" min={1} max={100} value={settings.minKeywords} onChange={setNum("minKeywords")} />
              </div>
              <div>
                <Label htmlFor="mg-max-kw">Max keywords</Label>
                <Input id="mg-max-kw" type="number" min={1} max={100} value={settings.maxKeywords} onChange={setNum("maxKeywords")} />
              </div>
            </div>
            <div>
              <Label htmlFor="mg-desc-words">Description target words</Label>
              <Input id="mg-desc-words" type="number" min={5} max={200} value={settings.descriptionWords} onChange={setNum("descriptionWords")} />
              <div className="mt-3 space-y-2">
                {(
                  [
                    ["singleWordMode", "Single-word keywords"],
                    ["whiteBackground", "White-background mode"],
                    ["transparentBackground", "Transparent-background mode"],
                    ["silhouetteMode", "Silhouette mode"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                      className="h-4 w-4 accent-[#22c55e]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="mg-custom">Custom prompt instructions</Label>
              <Textarea
                id="mg-custom"
                placeholder="e.g. Emphasize festive mood, keep keywords lowercase…"
                value={settings.customInstructions}
                onChange={(e) => setSettings((s) => ({ ...s, customInstructions: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="mg-prohibited">Prohibited words (comma-separated)</Label>
              <Input
                id="mg-prohibited"
                placeholder="e.g. free, cheap, best"
                value={settings.prohibitedWords}
                onChange={(e) => setSettings((s) => ({ ...s, prohibitedWords: e.target.value }))}
              />
              <div className="mt-3 flex gap-2">
                <Button variant="primary" size="sm" onClick={saveSettings}>
                  <Save size={14} aria-hidden /> Save to preferences
                </Button>
                <Button variant="outline" size="sm" onClick={resetSettings}>
                  <RotateCcw size={14} aria-hidden /> Reset
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-secondary/50 p-3 text-xs text-muted">
              <p className="mb-1 font-semibold text-foreground">Active profile caps</p>
              <p>Title ≤ {Math.min(profile.maxTitleWords, settings.maxTitleWords)} words · Keywords ≤ {Math.min(profile.maxKeywords, settings.maxKeywords)} · Style: {settings.singleWordMode || profile.keywordStyle === "single" ? "single-word" : "mixed"}</p>
              <p className="mt-1">Subjects and categories are heuristic suggestions — always review before submitting.</p>
            </div>
          </div>
        )}
      </Card>

      {/* Results */}
      {total === 0 ? (
        <EmptyState
          icon={<Sparkles size={40} aria-hidden />}
          title="No assets yet"
          description="Drop JPG, PNG, WebP, SVG, EPS, AI or video files above. Raster images get on-device vision analysis; vectors and videos use the honest manual flow."
        />
      ) : (
        <div className="space-y-4">
          {doneCount + failedCount === total && total > 0 && (
            <div role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <span className="font-semibold text-foreground">{doneCount} of {total} completed</span>
              <span className="text-muted">, {failedCount} failed.</span>
              {failedCount > 0 && <span className="ml-2 text-muted">Use Retry on the failed cards below.</span>}
            </div>
          )}

          {items.map((f) => (
            <Card key={f.id} className={cn(f.status === "error" && "border-danger/40")}>
              {f.status === "error" ? (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden />
                    <div>
                      <p className="font-medium text-foreground">{f.name}</p>
                      <p className="mt-1 text-sm text-danger">{f.error ?? "Unknown error."}</p>
                      {kindBadge(f)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {f.kind !== "rejected" && (
                      <Button variant="outline" size="sm" onClick={() => retryItem(f.id)} disabled={processing}>
                        <RefreshCw size={14} aria-hidden /> Retry
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => removeItem(f.id)} aria-label={`Remove ${f.name}`}>
                      <Trash2 size={14} aria-hidden /> Remove
                    </Button>
                  </div>
                </div>
              ) : f.status === "analyzing" || f.status === "queued" ? (
                <div className="flex items-center gap-3">
                  <Loader2 size={18} className="animate-spin text-primaryBright" aria-hidden />
                  <div>
                    <p className="font-medium text-foreground">{f.name}</p>
                    <p className="text-sm text-muted">Analyzing on-device…</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                  {/* Preview */}
                  <div>
                    <div className="aspect-square w-full overflow-hidden">{renderPreview(f)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {kindBadge(f)}
                      <span className="truncate text-xs text-muted" title={f.name}>{f.name}</span>
                    </div>
                    {flowNotice(f)}
                  </div>

                  {/* Editable fields */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted">Main subject <span className="normal-case">(suggested)</span></p>
                        <p className="text-sm font-medium text-foreground">{f.fields.mainSubject || "—"}</p>
                        {f.fields.secondarySubjects.length > 0 && (
                          <p className="mt-1 text-xs text-muted">
                            Secondary: {f.fields.secondarySubjects.join(" · ")}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(f.id)} aria-label={`Remove ${f.name}`}>
                        <X size={16} aria-hidden />
                      </Button>
                    </div>

                    <div>
                      <Label htmlFor={`title-${f.id}`}>Title ({f.fields.title.trim().split(/\s+/).filter(Boolean).length} words)</Label>
                      <Input
                        id={`title-${f.id}`}
                        value={f.fields.title}
                        onChange={(e) => updateFields(f.id, { title: e.target.value }, false)}
                        onBlur={(e) => updateFields(f.id, { title: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor={`desc-${f.id}`}>Description ({f.fields.description.trim().split(/\s+/).filter(Boolean).length} words)</Label>
                      <Textarea
                        id={`desc-${f.id}`}
                        value={f.fields.description}
                        onChange={(e) => updateFields(f.id, { description: e.target.value }, false)}
                        onBlur={(e) => updateFields(f.id, { description: e.target.value })}
                      />
                    </div>

                    <div>
                      <span id={`kw-label-${f.id}`} className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                        Keywords ({f.fields.keywords.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`kw-label-${f.id}`}>
                        {f.fields.keywords.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-foreground"
                          >
                            {kw}
                            <button
                              type="button"
                              onClick={() => removeKeyword(f, kw)}
                              aria-label={`Remove keyword ${kw}`}
                              className="rounded-full p-0.5 text-muted hover:bg-card hover:text-danger"
                            >
                              <X size={12} aria-hidden />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Input
                          aria-label={`Add keyword for ${f.name}`}
                          placeholder="Add keyword…"
                          value={kwInputs[f.id] ?? ""}
                          onChange={(e) => setKwInputs((s) => ({ ...s, [f.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && addKeyword(f)}
                        />
                        <Button variant="outline" size="sm" onClick={() => addKeyword(f)} className="shrink-0">
                          <Plus size={14} aria-hidden /> Add
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`cat-${f.id}`}>Category (suggested)</Label>
                        <Select
                          id={`cat-${f.id}`}
                          options={[...CONTENT_CATEGORIES]}
                          value={f.fields.category}
                          onChange={(e) => updateFields(f.id, { category: e.target.value })}
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Visual characteristics (suggested)</p>
                        <p className="text-sm text-foreground">{f.fields.style || "—"}</p>
                        {f.fields.commercialConcept && (
                          <p className="mt-1 text-xs text-muted">{f.fields.commercialConcept}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <Button variant="outline" size="sm" onClick={() => void copyText(f.fields.title, `t-${f.id}`)}>
                        {copiedKey === `t-${f.id}` ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                        {copiedKey === `t-${f.id}` ? "Copied" : "Copy title"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void copyText(f.fields.keywords.join(", "), `k-${f.id}`)}>
                        {copiedKey === `k-${f.id}` ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                        {copiedKey === `k-${f.id}` ? "Copied" : "Copy keywords"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void copyText(formatRecord(f), `a-${f.id}`)}>
                        {copiedKey === `a-${f.id}` ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                        {copiedKey === `a-${f.id}` ? "Copied" : "Copy all"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportOneCsv(f)}>
                        <Download size={14} aria-hidden /> Download CSV
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => regenerateItem(f)} disabled={processing}>
                        <RefreshCw size={14} aria-hidden /> Regenerate
                      </Button>
                      {f.savedAt && (
                        <span className="ml-auto text-xs text-muted">Saved {f.savedAt ? new Date(f.savedAt).toLocaleTimeString() : ""}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* EXIF honesty note */}
      {doneCount > 0 && (
        <p className="mt-6 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted">
          Metadata embedding (EXIF/IPTC) is not performed in this demo build — use the CSV for platform upload.
        </p>
      )}
    </div>
  );
}
