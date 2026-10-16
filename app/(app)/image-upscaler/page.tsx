"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play, XCircle, RotateCcw, Download, FileArchive, Trash2, Maximize2, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { ConfirmDialog } from "@/components/ui/dialog";
import { localDb, bumpUsage, Job } from "@/lib/db";
import { uid, nowIso, formatBytes, truncate } from "@/lib/utils";
import { downloadBlob } from "@/lib/csv";
import { downloadZip } from "@/lib/zip";
import {
  loadImageFromFile, upscaleCanvas, drawToCanvas, canvasToBlob,
} from "@/lib/image";

type ItemStatus = "queued" | "processing" | "done" | "failed";

interface UpscaleResult {
  blob: Blob;
  url: string; // preview of the actual output blob
  inW: number;
  inH: number;
  outW: number;
  outH: number;
  effScale: number; // actual scale applied (0 = capped to original size)
  capped: boolean;
  mime: string;
  ext: string;
  bytes: number;
}

interface UpscaleItem {
  id: string;
  file: File;
  thumbUrl: string;
  status: ItemStatus;
  error?: string;
  result?: UpscaleResult;
}

const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const MAX_OUTPUT_DIM = 8000;
const HONEST_LABEL = "Basic browser upscaling (not AI)";
const HONEST_DETAIL = "high-quality canvas resampling — no detail is invented.";

type Scale = 2 | 4;
type OutFormat = "jpg" | "png" | "webp";

const FORMAT_OPTIONS = [
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
];

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

export default function ImageUpscalerPage() {
  const [items, setItems] = useState<UpscaleItem[]>([]);
  const [scale, setScale] = useState<Scale>(2);
  const [denoise, setDenoise] = useState(25);
  const [sharpen, setSharpen] = useState(30);
  const [format, setFormat] = useState<OutFormat>("jpg");
  const [running, setRunning] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);
  const itemsRef = useRef<UpscaleItem[]>([]);
  itemsRef.current = items;
  const settingsRef = useRef({ scale, denoise, sharpen, format });
  settingsRef.current = { scale, denoise, sharpen, format };

  const patchItem = useCallback((id: string, patch: Partial<UpscaleItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  useEffect(() => () => {
    itemsRef.current.forEach((i) => {
      URL.revokeObjectURL(i.thumbUrl);
      if (i.result) URL.revokeObjectURL(i.result.url);
    });
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const ok = files.filter((f) => /image\/(jpeg|png|webp)/.test(f.type));
    const rejected = files.length - ok.length;
    const next: UpscaleItem[] = ok.map((file) => ({
      id: uid(),
      file,
      thumbUrl: URL.createObjectURL(file),
      status: "queued",
    }));
    setItems((prev) => [...prev, ...next]);
    if (rejected > 0) {
      setSummary(`${rejected} file(s) rejected — only JPG, PNG and WebP images are supported.`);
    }
  }, []);

  const processOne = useCallback(
    async (item: UpscaleItem): Promise<void> => {
      const { scale: req, denoise: dn, sharpen: sh, format: fmt } = settingsRef.current;
      patchItem(item.id, { status: "processing", error: undefined });
      try {
        const img = await loadImageFromFile(item.file);
        const inW = img.naturalWidth;
        const inH = img.naturalHeight;
        const maxDim = Math.max(inW, inH);

        // Honest infrastructure limit: never output beyond MAX_OUTPUT_DIM px
        let eff: Scale | 0 = req;
        let capped = false;
        if (maxDim * req > MAX_OUTPUT_DIM) {
          capped = true;
          eff = maxDim * 2 <= MAX_OUTPUT_DIM ? 2 : 0;
        }

        let canvas: HTMLCanvasElement;
        let effScale = 0;
        if (eff === 4 || eff === 2) {
          // high-quality canvas resampling (NOT AI) with optional denoise/sharpen
          canvas = upscaleCanvas(img, eff, { denoise: dn, sharpen: sh });
          effScale = eff;
        } else {
          // input already at/over the cap — export at original resolution, no upscale
          canvas = drawToCanvas(img, MAX_OUTPUT_DIM);
          effScale = 0;
        }

        const mime = fmt === "png" ? "image/png" : fmt === "jpg" ? "image/jpeg" : "image/webp";
        const blob = await canvasToBlob(canvas, mime, 0.92);
        const url = URL.createObjectURL(blob);
        const prev = itemsRef.current.find((i) => i.id === item.id);
        if (prev?.result) URL.revokeObjectURL(prev.result.url);
        patchItem(item.id, {
          status: "done",
          result: {
            blob, url, inW, inH, outW: canvas.width, outH: canvas.height,
            effScale, capped, mime, ext: fmt, bytes: blob.size,
          },
        });
      } catch (e) {
        patchItem(item.id, {
          status: "failed",
          error: e instanceof Error ? e.message : "Processing failed",
        });
      }
    },
    [patchItem],
  );

  const runQueue = useCallback(
    async (onlyIds?: string[]) => {
      if (runningRef.current) return;
      const db = localDb();
      const { scale: req, denoise: dn, sharpen: sh, format: fmt } = settingsRef.current;
      runningRef.current = true;
      setRunning(true);
      setSummary(null);
      cancelRef.current = false;

      const queue = itemsRef.current
        .filter((i) => (!onlyIds || onlyIds.includes(i.id)) && (i.status === "queued" || i.status === "failed"))
        .map((i) => i.id);
      queue.forEach((id) => patchItem(id, { status: "queued", error: undefined }));

      const job: Job = {
        id: uid(), type: "upscale",
        title: `Upscale ${req}x (${queue.length} files)`,
        status: "processing", total: queue.length, done: 0, failed: 0,
        note: `scale ${req}x · denoise ${dn} · sharpen ${sh} · format ${fmt}`,
        createdAt: nowIso(), updatedAt: nowIso(),
      };
      db.jobs.upsert(job);

      // sequential processing keeps memory sane
      for (const id of queue) {
        if (cancelRef.current) break;
        const item = itemsRef.current.find((i) => i.id === id);
        if (!item) continue;
        await processOne(item);
        await new Promise((r) => setTimeout(r, 0)); // yield to UI
      }

      const final = itemsRef.current;
      const done = final.filter((i) => i.status === "done").length;
      const failed = final.filter((i) => i.status === "failed").length;
      db.jobs.upsert({
        ...job,
        status: cancelRef.current ? "cancelled" : failed > 0 && done === 0 ? "failed" : "completed",
        done, failed, updatedAt: nowIso(),
        note: `${done} completed, ${failed} failed · ${req}x · denoise ${dn} · sharpen ${sh} · ${fmt}`,
      });
      bumpUsage(db, { imagesProcessed: done });
      setSummary(
        cancelRef.current
          ? `Cancelled — ${done} completed, ${failed} failed.`
          : `Complete — ${done} of ${queue.length} succeeded, ${failed} failed.`,
      );
      runningRef.current = false;
      setRunning(false);
    },
    [processOne, patchItem],
  );

  const retryFailed = () => {
    const ids = items.filter((i) => i.status === "failed").map((i) => i.id);
    if (ids.length) void runQueue(ids);
  };

  const downloadOne = useCallback(
    (item: UpscaleItem) => {
      if (!item.result) return;
      const suffix = item.result.effScale > 0 ? `${item.result.effScale}x` : "orig";
      const filename = `${baseName(item.file.name)}-upscaled-${suffix}.${item.result.ext}`;
      downloadBlob(item.result.blob, filename);
      const db = localDb();
      db.exports.upsert({
        id: uid(), kind: "report", filename,
        detail: `Upscaled image export (${item.result.ext.toUpperCase()}, ${formatBytes(item.result.bytes)})`,
        sizeBytes: item.result.bytes, createdAt: nowIso(),
      });
      bumpUsage(db, { bytesExported: item.result.bytes });
    },
    [],
  );

  const downloadZipAll = useCallback(async () => {
    const db = localDb();
    const doneItems = itemsRef.current.filter((i) => i.status === "done" && i.result);
    const entries = doneItems.map((i) => {
      const r = i.result!;
      const suffix = r.effScale > 0 ? `${r.effScale}x` : "orig";
      return { name: `${baseName(i.file.name)}-upscaled-${suffix}.${r.ext}`, blob: r.blob };
    });
    const filename = `image-upscaler-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.zip`;
    const size = await downloadZip(filename, entries);
    db.exports.upsert({
      id: uid(), kind: "zip", filename,
      detail: `${entries.length} upscaled images`,
      sizeBytes: size, createdAt: nowIso(),
    });
    bumpUsage(db, { bytesExported: size });
    setSummary(`ZIP downloaded — ${entries.length} image(s).`);
  }, []);

  const clearAll = useCallback(() => {
    itemsRef.current.forEach((i) => {
      URL.revokeObjectURL(i.thumbUrl);
      if (i.result) URL.revokeObjectURL(i.result.url);
    });
    setItems([]);
    setSummary(null);
  }, []);

  const removeItem = useCallback((item: UpscaleItem) => {
    URL.revokeObjectURL(item.thumbUrl);
    if (item.result) URL.revokeObjectURL(item.result.url);
    setItems((prev) => prev.filter((x) => x.id !== item.id));
  }, []);

  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const queuedCount = items.filter((i) => i.status === "queued").length;
  const processingCount = items.filter((i) => i.status === "processing").length;
  const cappedCount = items.filter((i) => i.result?.capped).length;
  const overall = items.length ? Math.round(((doneCount + failedCount) / items.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Image Upscaler"
        description={`${HONEST_LABEL} — ${HONEST_DETAIL} Outputs are capped at ${MAX_OUTPUT_DIM}px on the long side to stay within browser memory limits.`}
        actions={
          items.length > 0 && (
            <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)} disabled={running}>
              <Trash2 size={15} /> Clear all
            </Button>
          )
        }
      />

      {items.length === 0 && (
        <>
          <EmptyState
            icon={<Maximize2 size={40} aria-hidden />}
            title="No images yet"
            description="Drop images below to enlarge them with high-quality canvas resampling. Results are labeled honestly — no detail is invented."
          />
          <div className="mt-4">
            <FileDropzone
              accept={ACCEPT}
              onFiles={addFiles}
              label="Drag and drop images (PNG, JPG, WebP)"
              hint="Files are processed one at a time in your browser."
              formats={["PNG", "JPG", "WEBP"]}
            />
          </div>
        </>
      )}

      {items.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* controls */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
              <div className="flex flex-col gap-4">
                <div>
                  <span id="iu-scale-label" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Scale</span>
                  <div role="radiogroup" aria-labelledby="iu-scale-label" className="flex gap-4">
                    {([2, 4] as Scale[]).map((s) => (
                      <label key={s} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input
                          type="radio"
                          name="iu-scale"
                          value={s}
                          checked={scale === s}
                          onChange={() => setScale(s)}
                          style={{ accentColor: "var(--green-bright)" }}
                        />
                        {s}x
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="iu-denoise">Denoise: {denoise}</Label>
                  <input
                    id="iu-denoise"
                    type="range"
                    min={0}
                    max={100}
                    value={denoise}
                    onChange={(e) => setDenoise(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "var(--green-bright)" }}
                    aria-describedby="iu-denoise-hint"
                  />
                  <p id="iu-denoise-hint" className="mt-1 text-[11px] text-muted">
                    Softens noise before resampling. Higher values blur fine detail.
                  </p>
                </div>

                <div>
                  <Label htmlFor="iu-sharpen">Sharpen: {sharpen}</Label>
                  <input
                    id="iu-sharpen"
                    type="range"
                    min={0}
                    max={100}
                    value={sharpen}
                    onChange={(e) => setSharpen(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "var(--green-bright)" }}
                    aria-describedby="iu-sharpen-hint"
                  />
                  <p id="iu-sharpen-hint" className="mt-1 text-[11px] text-muted">
                    Unsharp-mask edge contrast after resampling. Too high adds halos.
                  </p>
                </div>

                <div>
                  <Label htmlFor="iu-format">Output format</Label>
                  <Select
                    id="iu-format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as OutFormat)}
                    options={FORMAT_OPTIONS}
                  />
                </div>

                <FileDropzone compact accept={ACCEPT} onFiles={addFiles} label="Add more images" />
              </div>
            </Card>

            <Card>
              <CardHeader><CardTitle>Run</CardTitle></CardHeader>
              <Progress value={overall} className="mb-2" />
              <p className="mb-3 text-xs text-muted">
                {doneCount} done · {failedCount} failed · {processingCount + queuedCount} pending · {items.length} total
              </p>
              <div className="flex flex-wrap gap-2">
                {!running ? (
                  <Button
                    onClick={() => void runQueue()}
                    disabled={queuedCount === 0 && failedCount === 0}
                  >
                    <Play size={15} /> {doneCount > 0 ? "Process remaining" : "Process"}
                  </Button>
                ) : (
                  <Button variant="danger" onClick={() => { cancelRef.current = true; }}>
                    <XCircle size={15} /> Cancel
                  </Button>
                )}
                {!running && failedCount > 0 && (
                  <Button variant="secondary" onClick={retryFailed}>
                    <RotateCcw size={15} /> Retry {failedCount} failed
                  </Button>
                )}
              </div>
              {summary && <p className="mt-3 text-sm text-muted" role="status">{summary}</p>}
              {cappedCount > 0 && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-400" role="alert">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {cappedCount} output{cappedCount === 1 ? " was" : "s"} capped to avoid browser memory limits
                  (max {MAX_OUTPUT_DIM}px on the long side).
                </p>
              )}
              <p className="mt-3 text-[11px] text-muted">
                {HONEST_LABEL} — {HONEST_DETAIL}
              </p>
            </Card>

            <Card>
              <CardHeader><CardTitle>Export</CardTitle></CardHeader>
              <p className="mb-3 text-xs text-muted">{doneCount} completed output(s) ready</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void downloadZipAll()}
                disabled={doneCount === 0 || running}
              >
                <FileArchive size={14} /> Download all as ZIP
              </Button>
            </Card>
          </div>

          {/* queue */}
          <div className="flex min-w-0 flex-col gap-3">
            {items.map((it) => (
              <Card key={it.id} className="!p-4">
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.thumbUrl}
                    alt={`Original: ${it.file.name}`}
                    className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground" title={it.file.name}>
                        {truncate(it.file.name, 40)}
                      </p>
                      <Badge
                        tone={it.status === "done" ? "success" : it.status === "failed" ? "red" : it.status === "processing" ? "info" : "neutral"}
                      >
                        {it.status}
                      </Badge>
                      <span className="text-[11px] text-muted">{formatBytes(it.file.size)}</span>
                    </div>
                    {it.error && <p className="mt-1.5 text-xs text-danger" role="alert">{it.error}</p>}
                    {it.status === "done" && it.result && (
                      <div className="mt-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Before</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={it.thumbUrl}
                              alt={`Before: ${it.file.name}`}
                              className="max-h-56 w-full rounded-xl border border-border object-contain bg-secondary"
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">After</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={it.result.url}
                              alt={`Upscaled: ${it.file.name}`}
                              className="max-h-56 w-full rounded-xl border border-border object-contain bg-secondary"
                            />
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                          <span>
                            {it.result.inW}×{it.result.inH} → {it.result.outW}×{it.result.outH}px
                            {it.result.effScale > 0 ? ` (${it.result.effScale}x)` : " (original size)"}
                          </span>
                          <span>
                            {formatBytes(it.file.size)} → {formatBytes(it.result.bytes)}
                          </span>
                        </div>
                        {it.result.capped && (
                          <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-400">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                            Scale capped to avoid browser memory limits — output stays within {MAX_OUTPUT_DIM}px.
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{HONEST_LABEL}</Badge>
                          <Button size="sm" variant="secondary" onClick={() => downloadOne(it)}>
                            <Download size={13} /> Download .{it.result.ext}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(it)}
                    aria-label={`Remove ${it.file.name}`}
                    disabled={running}
                    className="rounded-lg p-1.5 text-muted hover:bg-secondary hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            ))}
            {failedCount > 0 && !running && (
              <Card className="border-danger/40">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-danger">{failedCount} file(s) failed.</span>{" "}
                  Decode errors are shown above — fix the file and use “Retry failed”.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear queue?"
        message="Remove all images from the upscaler? Completed outputs that were not downloaded will be lost."
        confirmLabel="Clear all"
        onConfirm={() => { clearAll(); setConfirmClear(false); }}
      />
    </div>
  );
}
