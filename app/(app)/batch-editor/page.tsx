"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play, Pause, XCircle, RotateCcw, Download, FileArchive, Trash2,
  CheckSquare, Square, Copy, Check, ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useAuth } from "@/components/providers";
import { dbFor, bumpUsage, Job } from "@/lib/db";
import { uid, nowIso, formatBytes, truncate } from "@/lib/utils";
import { downloadCsv, downloadTextFile, downloadBlob } from "@/lib/csv";
import { downloadZip } from "@/lib/zip";
import {
  loadImageFromFile, analyzeImage, describeAnalysis, nearestColorName,
} from "@/lib/image";

type ItemStatus = "queued" | "processing" | "done" | "failed" | "skipped";

interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  displayName: string;
  override: string;
  status: ItemStatus;
  error?: string;
  prompt?: string;
  title?: string;
  keywords?: string[];
  selected: boolean;
}

const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const CONCURRENCY = 3;

const PROMPT_MODES = [
  "commercial stock photography",
  "photorealistic",
  "vector illustration",
  "minimalist design",
  "3D render",
  "product mockup",
];

function buildPrompt(
  descriptors: string[],
  colorNames: string[],
  mode: string,
  shared: string,
  override: string,
): { prompt: string; title: string; keywords: string[] } {
  const palette = colorNames.length ? `color palette of ${colorNames.join(", ")}` : "balanced color palette";
  const desc = descriptors.join("; ");
  const instruction = override.trim() || shared.trim();
  const prompt =
    `${mode} of a versatile commercial subject, ${desc}, ${palette}. ` +
    `Clean composition with copy space, professional stock quality, no text, no watermark. ` +
    (instruction ? `Creative direction: ${instruction}. ` : "") +
    `Avoid trademarks, logos, and recognizable brands.`;
  const title = `Versatile ${mode} concept with ${colorNames.slice(0, 2).join(" and ") || "balanced"} tones for commercial use`;
  const keywords = Array.from(
    new Set([
      ...colorNames,
      mode.split(" ")[0],
      "commercial", "stock", "background", "design", "concept",
      "professional", "copy space", "marketing", "advertising",
    ]),
  ).slice(0, 15);
  return { prompt, title, keywords };
}

export default function BatchEditorPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [mode, setMode] = useState(PROMPT_MODES[0]);
  const [shared, setShared] = useState("");
  const [renamePattern, setRenamePattern] = useState("{name}-{n}");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const controlRef = useRef({ paused: false, cancelled: false });
  const itemsRef = useRef<BatchItem[]>([]);
  itemsRef.current = items;

  useEffect(() => () => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<BatchItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) => /image\/(jpeg|png|webp)/.test(f.type));
    const rejected = files.length - valid.length;
    if (rejected > 0) {
      setSummary(`${rejected} file(s) rejected — only JPG, PNG, WebP are supported.`);
    }
    const next: BatchItem[] = valid.map((file) => ({
      id: uid(),
      file,
      previewUrl: URL.createObjectURL(file),
      displayName: file.name.replace(/\.[^.]+$/, ""),
      override: "",
      status: "queued",
      selected: true,
    }));
    setItems((prev) => [...prev, ...next]);
  }, []);

  const processOne = useCallback(
    async (item: BatchItem) => {
      patchItem(item.id, { status: "processing", error: undefined });
      try {
        const img = await loadImageFromFile(item.file);
        const a = analyzeImage(img);
        const descriptors = describeAnalysis(a);
        const colorNames = a.dominantColors.slice(0, 3).map((c) => nearestColorName(c.hex));
        const { prompt, title, keywords } = buildPrompt(descriptors, colorNames, mode, shared, item.override);
        patchItem(item.id, { status: "done", prompt, title, keywords });
      } catch (e) {
        patchItem(item.id, { status: "failed", error: e instanceof Error ? e.message : "Processing failed" });
      }
    },
    [mode, shared, patchItem],
  );

  const runQueue = useCallback(
    async (onlyIds?: string[]) => {
      if (!user || running) return;
      const db = dbFor(user.id);
      setRunning(true);
      setPaused(false);
      setSummary(null);
      controlRef.current = { paused: false, cancelled: false };
      const job: Job = {
        id: uid(), type: "batch", title: `Batch prompts (${itemsRef.current.length} files)`,
        status: "processing", total: itemsRef.current.length, done: 0, failed: 0,
        createdAt: nowIso(), updatedAt: nowIso(),
      };
      db.jobs.upsert(job);
      const started = Date.now();

      const queue = itemsRef.current
        .filter((i) => (!onlyIds || onlyIds.includes(i.id)) && (i.status === "queued" || i.status === "failed" || i.status === "skipped"))
        .map((i) => i.id);
      queue.forEach((id) => patchItem(id, { status: "queued", error: undefined }));

      let cursor = 0;
      const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (cursor < queue.length) {
          if (controlRef.current.cancelled) break;
          while (controlRef.current.paused && !controlRef.current.cancelled) {
            await new Promise((r) => setTimeout(r, 200));
          }
          if (controlRef.current.cancelled) break;
          const id = queue[cursor++];
          const item = itemsRef.current.find((i) => i.id === id);
          if (!item) continue;
          await processOne(item);
          await new Promise((r) => setTimeout(r, 0)); // yield to UI
        }
      });
      await Promise.all(workers);

      const final = itemsRef.current;
      const done = final.filter((i) => i.status === "done").length;
      const failed = final.filter((i) => i.status === "failed").length;
      if (controlRef.current.cancelled) {
        final.filter((i) => i.status === "queued" || i.status === "processing")
          .forEach((i) => patchItem(i.id, { status: "skipped" }));
      }
      db.jobs.upsert({
        ...job, status: controlRef.current.cancelled ? "cancelled" : failed > 0 && done === 0 ? "failed" : "completed",
        done, failed, updatedAt: nowIso(),
        note: `${done} completed, ${failed} failed in ${((Date.now() - started) / 1000).toFixed(1)}s`,
      });
      bumpUsage(db, { imagesProcessed: done, promptsCreated: done });
      setSummary(
        controlRef.current.cancelled
          ? `Cancelled — ${done} completed, ${failed} failed.`
          : `Complete — ${done} of ${queue.length} succeeded, ${failed} failed.`,
      );
      setRunning(false);
      setPaused(false);
    },
    [user, running, processOne, patchItem],
  );

  const pause = () => { controlRef.current.paused = true; setPaused(true); };
  const resume = () => { controlRef.current.paused = false; setPaused(false); };
  const cancel = () => { controlRef.current.cancelled = true; };

  const retryFailed = () => {
    const ids = items.filter((i) => i.status === "failed").map((i) => i.id);
    if (ids.length) runQueue(ids);
  };

  const applyRename = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    setItems((prev) =>
      prev.map((it, idx) => {
        if (!it.selected) return it;
        const base = it.file.name.replace(/\.[^.]+$/, "");
        const name = renamePattern
          .replaceAll("{n}", String(idx + 1).padStart(3, "0"))
          .replaceAll("{name}", base)
          .replaceAll("{date}", date)
          .replace(/[^\w\- ]+/g, "")
          .trim() || base;
        return { ...it, displayName: name };
      }),
    );
  };

  const completedSelected = items.filter((i) => i.selected && i.status === "done");

  const exportManifestCsv = () => {
    if (!user) return;
    const db = dbFor(user.id);
    const rows = completedSelected.map((i) => ({
      Filename: `${i.displayName}.txt`,
      Original: i.file.name,
      Title: i.title ?? "",
      Keywords: (i.keywords ?? []).join("; "),
      Prompt: i.prompt ?? "",
    }));
    const size = downloadCsv("batch-prompts-manifest.csv", ["Filename", "Original", "Title", "Keywords", "Prompt"], rows);
    db.exports.upsert({ id: uid(), kind: "csv", filename: "batch-prompts-manifest.csv", detail: `${rows.length} batch prompts`, sizeBytes: size, createdAt: nowIso() });
    bumpUsage(db, { bytesExported: size });
  };

  const downloadZipAll = async () => {
    if (!user) return;
    const db = dbFor(user.id);
    const entries = completedSelected.map((i) => ({
      name: `${i.displayName}.txt`,
      blob: new Blob([`TITLE: ${i.title ?? ""}\n\nKEYWORDS: ${(i.keywords ?? []).join(", ")}\n\nPROMPT:\n${i.prompt ?? ""}\n`], { type: "text/plain;charset=utf-8" }),
    }));
    const size = await downloadZip("batch-prompts.zip", entries);
    db.exports.upsert({ id: uid(), kind: "zip", filename: "batch-prompts.zip", detail: `${entries.length} prompt files`, sizeBytes: size, createdAt: nowIso() });
    bumpUsage(db, { bytesExported: size });
  };

  const copyPrompt = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* clipboard unavailable */ }
  };

  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const queuedCount = items.filter((i) => i.status === "queued" || i.status === "processing").length;
  const overall = items.length ? Math.round(((doneCount + failedCount) / items.length) * 100) : 0;

  const toggleSelectAll = () => {
    const all = items.every((i) => i.selected);
    setItems((prev) => prev.map((i) => ({ ...i, selected: !all })));
  };

  return (
    <div>
      <PageHeader
        title="Batch Editor"
        description="Process many assets at once with bounded concurrency (3 parallel workers). Assign prompts with shared instructions and per-file overrides, bulk-rename outputs, and export everything."
        actions={
          items.length > 0 && (
            <>
              <Button variant="secondary" size="sm" onClick={toggleSelectAll}>
                {items.every((i) => i.selected) ? <CheckSquare size={15} /> : <Square size={15} />}
                {items.every((i) => i.selected) ? "Deselect all" : "Select all"}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>Clear</Button>
            </>
          )
        }
      />

      {items.length === 0 ? (
        <FileDropzone
          accept={ACCEPT}
          onFiles={addFiles}
          label="Drag and drop images for batch processing"
          hint="JPG, PNG, WebP supported. Prompts are generated with on-device heuristics (demo mode)."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* control panel */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader><CardTitle>Batch settings</CardTitle></CardHeader>
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="be-mode">Prompt mode</Label>
                  <Select id="be-mode" value={mode} onChange={(e) => setMode(e.target.value)} options={PROMPT_MODES} />
                </div>
                <div>
                  <Label htmlFor="be-shared">Shared instructions (applied to all)</Label>
                  <Textarea id="be-shared" value={shared} onChange={(e) => setShared(e.target.value)} placeholder="e.g. warm autumn mood, copy space on the left" />
                </div>
                <div>
                  <Label htmlFor="be-rename">Bulk rename pattern</Label>
                  <Input id="be-rename" value={renamePattern} onChange={(e) => setRenamePattern(e.target.value)} placeholder="{name}-{n}" />
                  <p className="mt-1 text-[11px] text-muted">Placeholders: {"{n}"} number, {"{name}"} original name, {"{date}"} today</p>
                  <Button variant="secondary" size="sm" className="mt-2" onClick={applyRename}>Apply rename to selected</Button>
                </div>
                <FileDropzone compact accept={ACCEPT} onFiles={addFiles} label="Add more files" />
              </div>
            </Card>

            <Card>
              <CardHeader><CardTitle>Run</CardTitle></CardHeader>
              <Progress value={overall} className="mb-2" />
              <p className="mb-3 text-xs text-muted">
                {doneCount} done · {failedCount} failed · {queuedCount} pending · {items.length} total
              </p>
              <div className="flex flex-wrap gap-2">
                {!running ? (
                  <Button onClick={() => runQueue()} disabled={queuedCount === 0 && failedCount === 0}>
                    <Play size={15} /> Start batch
                  </Button>
                ) : paused ? (
                  <Button onClick={resume}><Play size={15} /> Resume</Button>
                ) : (
                  <Button variant="secondary" onClick={pause}><Pause size={15} /> Pause</Button>
                )}
                {running && <Button variant="danger" onClick={cancel}><XCircle size={15} /> Cancel</Button>}
                {!running && failedCount > 0 && (
                  <Button variant="secondary" onClick={retryFailed}><RotateCcw size={15} /> Retry {failedCount} failed</Button>
                )}
              </div>
              {summary && <p className="mt-3 text-sm text-muted" role="status">{summary}</p>}
            </Card>

            <Card>
              <CardHeader><CardTitle>Export</CardTitle></CardHeader>
              <p className="mb-3 text-xs text-muted">{completedSelected.length} selected completed outputs</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={exportManifestCsv} disabled={completedSelected.length === 0}>
                  <Download size={14} /> Manifest CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadZipAll} disabled={completedSelected.length === 0}>
                  <FileArchive size={14} /> ZIP of prompts
                </Button>
              </div>
            </Card>
          </div>

          {/* queue */}
          <div className="flex min-w-0 flex-col gap-3">
            {items.map((it) => (
              <Card key={it.id} className="!p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => patchItem(it.id, { selected: !it.selected })}
                    aria-label={it.selected ? `Deselect ${it.file.name}` : `Select ${it.file.name}`}
                    className="mt-1 text-muted hover:text-foreground"
                  >
                    {it.selected ? <CheckSquare size={18} className="text-primaryBright" /> : <Square size={18} />}
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.previewUrl} alt={it.file.name} className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={it.displayName}
                        onChange={(e) => patchItem(it.id, { displayName: e.target.value })}
                        aria-label={`Output name for ${it.file.name}`}
                        className="!h-8 !py-1 text-sm font-medium"
                      />
                      <Badge tone={it.status === "done" ? "green" : it.status === "failed" ? "red" : it.status === "processing" ? "blue" : "neutral"}>
                        {it.status}
                      </Badge>
                      <span className="text-[11px] text-muted">{formatBytes(it.file.size)} · {truncate(it.file.name, 32)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        value={it.override}
                        onChange={(e) => patchItem(it.id, { override: e.target.value })}
                        placeholder="Per-file override instructions (optional)"
                        aria-label={`Per-file instructions for ${it.file.name}`}
                        className="!h-8 !py-1 text-xs"
                      />
                    </div>
                    {it.error && <p className="mt-1.5 text-xs text-danger" role="alert">{it.error}</p>}
                    {it.status === "done" && it.prompt && (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpandedId(expandedId === it.id ? null : it.id)}
                          className="flex items-center gap-1 text-xs font-medium text-primaryBright hover:underline"
                          aria-expanded={expandedId === it.id}
                        >
                          <ChevronDown size={14} className={expandedId === it.id ? "rotate-180" : ""} />
                          {expandedId === it.id ? "Hide prompt" : "View generated prompt"}
                        </button>
                        {expandedId === it.id && (
                          <div className="mt-2 rounded-xl bg-secondary p-3">
                            <p className="text-xs font-semibold text-foreground">{it.title}</p>
                            <p className="mt-1 text-xs text-muted">{it.prompt}</p>
                            <div className="mt-2 flex gap-2">
                              <Button size="sm" variant="secondary" onClick={() => copyPrompt(it.id, it.prompt!)}>
                                {copiedId === it.id ? <Check size={13} /> : <Copy size={13} />}
                                {copiedId === it.id ? "Copied" : "Copy"}
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => downloadTextFile(`${it.displayName}.txt`, `TITLE: ${it.title}\n\nKEYWORDS: ${(it.keywords ?? []).join(", ")}\n\nPROMPT:\n${it.prompt}`)}>
                                <Download size={13} /> TXT
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(it.previewUrl);
                      setItems((prev) => prev.filter((x) => x.id !== it.id));
                    }}
                    aria-label={`Remove ${it.file.name}`}
                    className="rounded-lg p-1.5 text-muted hover:bg-secondary hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            ))}
            {failedCount > 0 && !running && (
              <Card className="border-danger/40">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-danger">{failedCount} file(s) failed.</span> Failed files keep their error messages above — fix the issue (e.g. corrupt file) and use “Retry failed”.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear batch?"
        message="Remove all files from the batch queue? Generated prompts that were not exported will be lost."
        confirmLabel="Clear all"
        onConfirm={() => {
          items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
          setItems([]);
          setSummary(null);
        }}
      />
    </div>
  );
}
