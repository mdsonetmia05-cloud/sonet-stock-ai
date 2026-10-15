"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play, XCircle, RotateCcw, Download, FileArchive, Trash2, Eraser, AlertTriangle,
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
import { useAuth } from "@/components/providers";
import { dbFor, bumpUsage, Job } from "@/lib/db";
import { uid, nowIso, formatBytes, truncate } from "@/lib/utils";
import { downloadBlob } from "@/lib/csv";
import { downloadZip } from "@/lib/zip";
import {
  loadImageFromFile, removeBackgroundFloodFill, canvasToBlob,
} from "@/lib/image";

type ItemStatus = "queued" | "processing" | "done" | "failed";

interface BgResult {
  blob: Blob;
  url: string; // preview of the actual output blob (genuine alpha preserved)
  removedPct: number;
  width: number;
  height: number;
  mime: string;
  ext: string;
  bytes: number;
}

interface BgItem {
  id: string;
  file: File;
  thumbUrl: string;
  status: ItemStatus;
  error?: string;
  result?: BgResult;
}

const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const HONEST_LABEL = "Basic background removal (not AI)";

type BgChoice = "transparent" | "white" | "custom";
type OutFormat = "png" | "jpeg" | "webp";

const FORMAT_OPTIONS = [
  { value: "png", label: "PNG (keeps alpha)" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
];

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/** Composite a canvas with alpha over a solid color (used for white/custom bg + JPEG). */
function compositeOnColor(canvas: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

export default function BackgroundRemoverPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<BgItem[]>([]);
  const [tolerance, setTolerance] = useState(32);
  const [bgChoice, setBgChoice] = useState<BgChoice>("transparent");
  const [customColor, setCustomColor] = useState("#ffffff");
  const [format, setFormat] = useState<OutFormat>("png");
  const [running, setRunning] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);
  const itemsRef = useRef<BgItem[]>([]);
  itemsRef.current = items;
  const settingsRef = useRef({ tolerance, bgChoice, customColor, format });
  settingsRef.current = { tolerance, bgChoice, customColor, format };

  const patchItem = useCallback((id: string, patch: Partial<BgItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  // revoke object URLs on unmount
  useEffect(() => () => {
    itemsRef.current.forEach((i) => {
      URL.revokeObjectURL(i.thumbUrl);
      if (i.result) URL.revokeObjectURL(i.result.url);
    });
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const ok = files.filter((f) => /image\/(jpeg|png|webp)/.test(f.type));
    const rejected = files.length - ok.length;
    const next: BgItem[] = ok.map((file) => ({
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
    async (item: BgItem): Promise<void> => {
      const { tolerance: tol, bgChoice: bg, customColor: cc, format: fmt } = settingsRef.current;
      patchItem(item.id, { status: "processing", error: undefined });
      try {
        const img = await loadImageFromFile(item.file);
        // REAL flood-fill background removal — genuine alpha channel, not AI
        const { canvas, removedPct, width, height } = removeBackgroundFloodFill(img, tol);

        let outCanvas = canvas;
        const mime = fmt === "png" ? "image/png" : fmt === "jpeg" ? "image/jpeg" : "image/webp";
        const ext = fmt === "jpeg" ? "jpg" : fmt;
        if (fmt === "jpeg") {
          // JPEG has no alpha — composite on white (or the chosen color) honestly
          outCanvas = compositeOnColor(canvas, bg === "custom" ? cc : "#ffffff");
        } else if (bg === "white") {
          outCanvas = compositeOnColor(canvas, "#ffffff");
        } else if (bg === "custom") {
          outCanvas = compositeOnColor(canvas, cc);
        }
        const blob = await canvasToBlob(outCanvas, mime, 0.92);
        const url = URL.createObjectURL(blob);
        // revoke any previous result preview to keep memory sane
        const prev = itemsRef.current.find((i) => i.id === item.id);
        if (prev?.result) URL.revokeObjectURL(prev.result.url);
        patchItem(item.id, {
          status: "done",
          result: { blob, url, removedPct, width: outCanvas.width, height: outCanvas.height, mime, ext, bytes: blob.size },
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
      if (!user || runningRef.current) return;
      const db = dbFor(user.id);
      const { tolerance: tol, bgChoice: bg, format: fmt } = settingsRef.current;
      runningRef.current = true;
      setRunning(true);
      setSummary(null);
      cancelRef.current = false;

      const queue = itemsRef.current
        .filter((i) => (!onlyIds || onlyIds.includes(i.id)) && (i.status === "queued" || i.status === "failed"))
        .map((i) => i.id);
      queue.forEach((id) => patchItem(id, { status: "queued", error: undefined }));

      const job: Job = {
        id: uid(), type: "bg-remove",
        title: `Background removal (${queue.length} files, tol ${tol})`,
        status: "processing", total: queue.length, done: 0, failed: 0,
        note: `tolerance ${tol} · background ${bg} · format ${fmt}`,
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
        note: `${done} completed, ${failed} failed · tolerance ${tol} · background ${bg} · format ${fmt}`,
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
    [user, processOne, patchItem],
  );

  const retryFailed = () => {
    const ids = items.filter((i) => i.status === "failed").map((i) => i.id);
    if (ids.length) void runQueue(ids);
  };

  const downloadOne = useCallback(
    (item: BgItem) => {
      if (!item.result) return;
      const filename = `${baseName(item.file.name)}-bgremoved.${item.result.ext}`;
      downloadBlob(item.result.blob, filename);
      if (user) {
        const db = dbFor(user.id);
        db.exports.upsert({
          id: uid(), kind: "report", filename,
          detail: `Background-removed image export (${item.result.ext.toUpperCase()}, ${formatBytes(item.result.bytes)})`,
          sizeBytes: item.result.bytes, createdAt: nowIso(),
        });
        bumpUsage(db, { bytesExported: item.result.bytes });
      }
    },
    [user],
  );

  const downloadZipAll = useCallback(async () => {
    if (!user) return;
    const db = dbFor(user.id);
    const doneItems = itemsRef.current.filter((i) => i.status === "done" && i.result);
    const entries = doneItems.map((i) => ({
      name: `${baseName(i.file.name)}-bgremoved.${i.result!.ext}`,
      blob: i.result!.blob,
    }));
    const filename = `background-remover-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.zip`;
    const size = await downloadZip(filename, entries);
    db.exports.upsert({
      id: uid(), kind: "zip", filename,
      detail: `${entries.length} background-removed images`,
      sizeBytes: size, createdAt: nowIso(),
    });
    bumpUsage(db, { bytesExported: size });
    setSummary(`ZIP downloaded — ${entries.length} image(s).`);
  }, [user]);

  const clearAll = useCallback(() => {
    itemsRef.current.forEach((i) => {
      URL.revokeObjectURL(i.thumbUrl);
      if (i.result) URL.revokeObjectURL(i.result.url);
    });
    setItems([]);
    setSummary(null);
  }, []);

  const removeItem = useCallback((item: BgItem) => {
    URL.revokeObjectURL(item.thumbUrl);
    if (item.result) URL.revokeObjectURL(item.result.url);
    setItems((prev) => prev.filter((x) => x.id !== item.id));
  }, []);

  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const queuedCount = items.filter((i) => i.status === "queued").length;
  const processingCount = items.filter((i) => i.status === "processing").length;
  const overall = items.length ? Math.round(((doneCount + failedCount) / items.length) * 100) : 0;
  const jpegAlphaWarning = bgChoice === "transparent" && format === "jpeg";
  const showChecker = bgChoice === "transparent" && format !== "jpeg";

  return (
    <div>
      <PageHeader
        title="Background Remover"
        description="Remove backgrounds with a real edge flood-fill algorithm (genuine alpha channel — not AI). Best on solid or near-solid backgrounds; complex backgrounds need manual masking."
        actions={
          items.length > 0 && (
            <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)} disabled={running}>
              <Trash2 size={15} /> Clear all
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Eraser size={40} aria-hidden />}
          title="No images yet"
          description="Drop images below to strip their backgrounds. Exports keep a genuine transparent alpha channel when you choose Transparent PNG."
          action={null}
        />
      ) : null}

      {items.length === 0 && (
        <div className="mt-4">
          <FileDropzone
            accept={ACCEPT}
            onFiles={addFiles}
            label="Drag and drop images (PNG, JPG, WebP)"
            hint="Files are processed one at a time in your browser."
            formats={["PNG", "JPG", "WEBP"]}
          />
        </div>
      )}

      {items.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* controls */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="br-tolerance">Tolerance: {tolerance}</Label>
                  <input
                    id="br-tolerance"
                    type="range"
                    min={0}
                    max={100}
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "var(--blue-bright)" }}
                    aria-describedby="br-tolerance-hint"
                  />
                  <p id="br-tolerance-hint" className="mt-1 text-[11px] text-muted">
                    Higher removes more; too high eats into the subject. Default 32 works for most solid backgrounds.
                  </p>
                </div>

                <div>
                  <span id="br-bg-label" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Background</span>
                  <div role="radiogroup" aria-labelledby="br-bg-label" className="flex flex-col gap-2">
                    {(
                      [
                        ["transparent", "Transparent PNG"],
                        ["white", "White"],
                        ["custom", "Custom color"],
                      ] as Array<[BgChoice, string]>
                    ).map(([value, labelText]) => (
                      <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input
                          type="radio"
                          name="br-bg"
                          value={value}
                          checked={bgChoice === value}
                          onChange={() => setBgChoice(value)}
                          style={{ accentColor: "var(--blue-bright)" }}
                        />
                        {labelText}
                      </label>
                    ))}
                  </div>
                  {bgChoice === "custom" && (
                    <div className="mt-2 flex items-center gap-2">
                      <Label htmlFor="br-custom-color" className="mb-0">Color</Label>
                      <input
                        id="br-custom-color"
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="h-10 w-16 cursor-pointer rounded-xl border border-border bg-secondary"
                      />
                      <span className="text-xs text-muted">{customColor}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="br-format">Output format</Label>
                  <Select
                    id="br-format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as OutFormat)}
                    options={FORMAT_OPTIONS}
                  />
                  {jpegAlphaWarning && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-400" role="alert">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      JPEG has no alpha channel — transparent areas will be composited on white.
                    </p>
                  )}
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
              <p className="mt-3 text-[11px] text-muted">
                {HONEST_LABEL} — edge flood-fill from the image borders, genuine alpha channel.
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
                        tone={it.status === "done" ? "success" : it.status === "failed" ? "red" : it.status === "processing" ? "blue" : "neutral"}
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
                            <div
                              className={
                                showChecker
                                  ? "checkerboard max-h-56 w-full overflow-hidden rounded-xl border border-border"
                                  : "max-h-56 w-full overflow-hidden rounded-xl border border-border bg-secondary"
                              }
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={it.result.url}
                                alt={`Background removed: ${it.file.name}`}
                                className="max-h-56 w-full object-contain"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                          <span>
                            ~{it.result.removedPct.toFixed(1)}% of pixels made transparent — basic flood-fill from edges
                          </span>
                          <span>{it.result.width}×{it.result.height}px</span>
                          <span>
                            {formatBytes(it.file.size)} → {formatBytes(it.result.bytes)}
                          </span>
                        </div>
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
        message="Remove all images from the background remover? Completed outputs that were not downloaded will be lost."
        confirmLabel="Clear all"
        onConfirm={() => { clearAll(); setConfirmClear(false); }}
      />
    </div>
  );
}
