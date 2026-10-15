"use client";

import { useMemo, useRef, useState } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldX, Download, Check,
  AlertTriangle, Info, ClipboardCheck, Wrench, ChevronDown, XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/components/providers";
import { dbFor, bumpUsage, type QcReport, type QcFinding } from "@/lib/db";
import { downloadTextFile } from "@/lib/csv";
import { loadImageFromFile, analyzeImage, sharpnessScore, exposureReport, noiseEstimate } from "@/lib/image";
import { uid, nowIso, cn, formatDateTime } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Risk engine — transparent weights. Score starts at 100, deductions listed.
// ---------------------------------------------------------------------------

const SHARPNESS_FAIL = 35;   // below → fail
const SHARPNESS_SOFT = 55;   // below → warn (soft)
const SHADOW_CLIP_WARN = 15; // % above → warn
const HIGHLIGHT_CLIP_WARN = 12; // % above → warn
const NOISE_WARN = 60;       // above → warn
const NOISE_SOFT = 40;       // above → soft warn

const GUIDELINES = [
  { id: "logos", label: "No visible logos, trademarks, or brand marks", detail: "Commercial stock must be free of identifiable brands." },
  { id: "faces", label: "No recognizable faces without a model release (self-declared)", detail: "Tick only if every recognizable person signed a release — or no people appear." },
  { id: "text", label: "No text, watermarks, or overlaid graphics", detail: "Burned-in text is a common rejection reason." },
  { id: "ai", label: "AI-disclosure understood", detail: "If the image is AI-generated, the marketplace's AI-content disclosure rules apply." },
] as const;

type GuidelineId = (typeof GUIDELINES)[number]["id"];

interface AnalyzedImage {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  orientation: string;
  sharpness: number; // 0-100
  shadowClip: number; // %
  highlightClip: number; // %
  exposureVerdict: string;
  noise: number; // 0-100
  brightnessPct: number;
}

interface RiskResult {
  score: number;
  risk: "low" | "review" | "high";
  deductions: { label: string; points: number }[];
  findings: QcFinding[];
}

function riskLabel(score: number): "low" | "review" | "high" {
  if (score >= 75) return "low";
  if (score >= 45) return "review";
  return "high";
}

function evaluate(img: AnalyzedImage, unchecked: Set<GuidelineId>): RiskResult {
  const deductions: { label: string; points: number }[] = [];
  const findings: QcFinding[] = [];
  const deduct = (label: string, points: number) => deductions.push({ label, points });

  // --- Sharpness ---
  if (img.sharpness < SHARPNESS_FAIL) {
    deduct(`Sharpness FAIL: measured ${img.sharpness}/100 (threshold ${SHARPNESS_FAIL})`, 45);
    findings.push({
      category: "Sharpness", level: "fail",
      detail: `Measured sharpness ${img.sharpness}/100 is below the ${SHARPNESS_FAIL} threshold — the image looks blurry or out of focus at full size.`,
      suggestion: "Reshoot with faster shutter / tripod, or re-export from the original at full resolution and apply gentle sharpening. Avoid heavy cropping.",
    });
  } else if (img.sharpness < SHARPNESS_SOFT) {
    deduct(`Sharpness soft: measured ${img.sharpness}/100 (soft threshold ${SHARPNESS_SOFT})`, 15);
    findings.push({
      category: "Sharpness", level: "warn",
      detail: `Measured sharpness ${img.sharpness}/100 is acceptable but soft — borderline at 100% view.`,
      suggestion: "Apply mild output sharpening and inspect edges at 100% before uploading.",
    });
  } else {
    findings.push({
      category: "Sharpness", level: "pass",
      detail: `Measured sharpness ${img.sharpness}/100 — focus looks solid.`,
      suggestion: "No action needed.",
    });
  }

  // --- Exposure ---
  const shadowBad = img.shadowClip > SHADOW_CLIP_WARN;
  const highlightBad = img.highlightClip > HIGHLIGHT_CLIP_WARN;
  if (shadowBad) {
    deduct(`Shadow clipping: ${img.shadowClip.toFixed(1)}% of pixels near-black (threshold ${SHADOW_CLIP_WARN}%)`, 10);
  }
  if (highlightBad) {
    deduct(`Highlight clipping: ${img.highlightClip.toFixed(1)}% of pixels near-white (threshold ${HIGHLIGHT_CLIP_WARN}%)`, 10);
  }
  if (shadowBad || highlightBad) {
    findings.push({
      category: "Exposure", level: "warn",
      detail: `Histogram shows ${img.shadowClip.toFixed(1)}% shadow clipping and ${img.highlightClip.toFixed(1)}% highlight clipping (verdict: ${img.exposureVerdict}). Clipped detail cannot be recovered.`,
      suggestion: "Re-process the RAW/original with gentler tone curves; pull back blacks/whites and check the histogram before export.",
    });
  } else {
    findings.push({
      category: "Exposure", level: "pass",
      detail: `Shadow clipping ${img.shadowClip.toFixed(1)}%, highlight clipping ${img.highlightClip.toFixed(1)}% — within limits.`,
      suggestion: "No action needed.",
    });
  }

  // --- Noise ---
  if (img.noise > NOISE_WARN) {
    deduct(`Noise high: estimate ${img.noise}/100 (threshold ${NOISE_WARN})`, 15);
    findings.push({
      category: "Noise", level: "warn",
      detail: `Noise estimate ${img.noise}/100 exceeds ${NOISE_WARN} — visible grain, likely at 100% view.`,
      suggestion: "Apply light luminance noise reduction to the original (not the export), or reshoot at lower ISO / better light.",
    });
  } else if (img.noise > NOISE_SOFT) {
    deduct(`Noise moderate: estimate ${img.noise}/100`, 5);
    findings.push({
      category: "Noise", level: "warn",
      detail: `Noise estimate ${img.noise}/100 is moderate — acceptable, but check smooth areas (skies, shadows) at 100%.`,
      suggestion: "Optional: mild noise reduction on smooth areas only.",
    });
  } else {
    findings.push({
      category: "Noise", level: "pass",
      detail: `Noise estimate ${img.noise}/100 — clean.`,
      suggestion: "No action needed.",
    });
  }

  // --- Guideline self-checks (user-ticked) ---
  for (const g of GUIDELINES) {
    if (!unchecked.has(g.id)) {
      findings.push({ category: "Guideline", level: "pass", detail: `${g.label} — confirmed by you.`, suggestion: "No action needed." });
    } else {
      deduct(`Guideline unchecked: "${g.label}"`, 10);
      findings.push({
        category: "Guideline", level: "warn",
        detail: `"${g.label}" was not confirmed. ${g.detail}`,
        suggestion: "Review the image against this rule and tick the checkbox once it is satisfied.",
      });
    }
  }

  const score = Math.max(0, 100 - deductions.reduce((a, d) => a + d.points, 0));
  return { score, risk: riskLabel(score), deductions, findings };
}

const RISK_META = {
  low: { label: "Low Risk", Icon: ShieldCheck, tone: "success" as const, text: "No major technical issues detected. Still review the checklist before upload." },
  review: { label: "Review Recommended", Icon: ShieldAlert, tone: "amber" as const, text: "One or more issues found — fix the warned items before submitting." },
  high: { label: "High Risk", Icon: ShieldX, tone: "red" as const, text: "Fail-level issues detected. This file is very likely to be rejected — fix and re-check." },
};

const LEVEL_TONE: Record<QcFinding["level"], "success" | "amber" | "red"> = { pass: "success", warn: "amber", fail: "red" };

const ACCEPT_EXTS = ["jpg", "jpeg", "png", "webp"];

export default function RejectionPredictorPage() {
  const { user, signIn } = useAuth();

  const [images, setImages] = useState<AnalyzedImage[]>([]);
  const [unchecked, setUnchecked] = useState<Record<string, Set<GuidelineId>>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<QcReport[]>(() =>
    user ? dbFor(user.id).qcReports.all() : [],
  );
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const runToken = useRef(0);

  const results = useMemo(
    () => images.map((img) => ({ img, risk: evaluate(img, unchecked[img.id] ?? new Set<GuidelineId>()) })),
    [images, unchecked],
  );

  if (!user) {
    return (
      <div className="mx-auto max-w-xl pt-16">
        <EmptyState
          icon={<ShieldCheck size={40} />}
          title="Sign in to use the Rejection Predictor"
          description="Your QC reports and outcomes are stored per user."
          action={<Button onClick={() => signIn("Demo Creator", "demo@sonetstock.ai")}>Continue as demo creator</Button>}
        />
      </div>
    );
  }

  const db = dbFor(user.id);

  const toggleGuideline = (imgId: string, gid: GuidelineId) => {
    setUnchecked((prev) => {
      const next = { ...prev };
      const set = new Set(next[imgId] ?? GUIDELINES.map((g) => g.id));
      if (set.has(gid)) set.delete(gid); else set.add(gid);
      next[imgId] = set;
      return next;
    });
  };

  const handleFiles = async (files: File[]) => {
    const token = ++runToken.current;
    setErrors([]);
    setProcessing(true);
    setProgress(0);
    const valid: File[] = [];
    const errs: string[] = [];
    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const okType = f.type.startsWith("image/") || ACCEPT_EXTS.includes(ext);
      if (!okType) errs.push(`${f.name}: not a supported image (JPG, PNG, WebP only)`);
      else valid.push(f);
    }
    setErrors(errs);

    const job = db.jobs.upsert({
      id: uid(), type: "qc", title: `QC analysis — ${valid.length} image(s)`,
      status: "processing", total: valid.length, done: 0, failed: errs.length,
      createdAt: nowIso(), updatedAt: nowIso(),
    });

    const batch: AnalyzedImage[] = [];
    let done = 0;
    for (const file of valid) {
      if (token !== runToken.current) return;
      try {
        const el = await loadImageFromFile(file);
        const analysis = analyzeImage(el);
        const sharpness = sharpnessScore(el);
        const exposure = exposureReport(el);
        const noise = noiseEstimate(el);
        const id = uid();
        batch.push({
          id, file, previewUrl: URL.createObjectURL(file),
          width: analysis.width, height: analysis.height, orientation: analysis.orientation,
          sharpness,
          shadowClip: exposure.shadowClipPct, highlightClip: exposure.highlightClipPct,
          exposureVerdict: exposure.verdict,
          noise,
          brightnessPct: Math.round(analysis.brightness * 100),
        });
        // default: all guidelines UNCHECKED (user must tick them)
        setUnchecked((prev) => ({ ...prev, [id]: new Set(GUIDELINES.map((g) => g.id)) }));
        done++;
      } catch (e) {
        errs.push(`${file.name}: could not decode (${e instanceof Error ? e.message : "unknown error"})`);
        job.failed++;
      }
      setErrors([...errs]);
      setProgress(Math.round((done / Math.max(1, valid.length)) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }

    // save QC reports
    const saved: Record<string, string> = {};
    for (const img of batch) {
      const r = evaluate(img, new Set(GUIDELINES.map((g) => g.id)));
      const report: QcReport = {
        id: uid(), filename: img.file.name, risk: r.risk, score: r.score,
        findings: r.findings, outcome: null, createdAt: nowIso(),
      };
      db.qcReports.upsert(report);
      saved[img.id] = report.id;
    }
    db.jobs.upsert({ ...job, status: "completed", done, failed: errs.length, updatedAt: nowIso() });
    bumpUsage(db, { imagesProcessed: done });

    setImages((prev) => [...batch, ...prev]);
    setSavedIds((prev) => ({ ...saved, ...prev }));
    setHistory(db.qcReports.all());
    setProcessing(false);
  };

  const clearAll = () => {
    runToken.current++;
    setImages([]);
    setUnchecked({});
    setErrors([]);
    setProgress(0);
    setExpanded(new Set());
  };

  const markOutcome = (reportId: string, outcome: "accepted" | "rejected") => {
    const rep = db.qcReports.get(reportId);
    if (!rep) return;
    db.qcReports.upsert({ ...rep, outcome });
    setHistory(db.qcReports.all());
  };

  const downloadReport = (img: AnalyzedImage, risk: RiskResult) => {
    const lines: string[] = [];
    lines.push("SONET STOCK AI — QC Report (on-device heuristics)");
    lines.push(`File: ${img.file.name}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Dimensions: ${img.width}×${img.height} (${img.orientation}) | Brightness: ${img.brightnessPct}%`);
    lines.push("");
    lines.push("== Measurements (real, computed on-device) ==");
    lines.push(`Sharpness: ${img.sharpness}/100 (Laplacian variance)`);
    lines.push(`Shadow clipping: ${img.shadowClip.toFixed(1)}% | Highlight clipping: ${img.highlightClip.toFixed(1)}% (verdict: ${img.exposureVerdict})`);
    lines.push(`Noise estimate: ${img.noise}/100 (deviation from 3×3 smoothing)`);
    lines.push("");
    lines.push("== How the score was computed ==");
    lines.push("Score starts at 100. Each deduction is subtracted:");
    if (risk.deductions.length === 0) lines.push("- No deductions.");
    else risk.deductions.forEach((d) => lines.push(`- −${d.points}: ${d.label}`));
    lines.push(`Final score: ${risk.score}/100 → ${RISK_META[risk.risk].label}`);
    lines.push("");
    lines.push("== Findings ==");
    risk.findings.forEach((f) => {
      lines.push(`[${f.level.toUpperCase()}] ${f.category}: ${f.detail}`);
      lines.push(`   Suggestion: ${f.suggestion}`);
    });
    lines.push("");
    lines.push("DISCLAIMER: Automated heuristics cannot predict reviewer decisions. This is not an official");
    lines.push("marketplace verdict and does not guarantee acceptance or rejection.");
    const text = lines.join("\n");
    downloadTextFile(`qc-report-${img.file.name.replace(/\.[^.]+$/, "")}.txt`, text);
    db.exports.upsert({
      id: uid(), kind: "txt", filename: `qc-report-${img.file.name}.txt`,
      detail: `QC report for ${img.file.name}`, sizeBytes: new Blob([text]).size, createdAt: nowIso(),
    });
    bumpUsage(db, { bytesExported: new Blob([text]).size });
  };

  return (
    <div>
      <PageHeader
        title="Rejection Predictor"
        description="Real on-device technical checks (sharpness, exposure, noise) plus your own guideline self-check. Scores show exactly how they were computed."
        actions={images.length > 0 ? <Button variant="secondary" size="sm" onClick={clearAll}>Clear all</Button> : undefined}
      />

      <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <p className="flex items-start gap-2 text-sm text-muted">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <span>
            <strong className="text-foreground">Disclaimer:</strong> Automated heuristics cannot predict reviewer
            decisions. This is not an official marketplace verdict and does not guarantee acceptance.
          </span>
        </p>
      </div>

      <Card className="mb-6">
        <FileDropzone
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          maxFiles={12}
          onFiles={handleFiles}
          label="Drag and drop images (PNG, JPG, WebP)"
          hint="Analysis runs fully in your browser."
          batchLimit={12}
          formats={["PNG", "JPG", "WEBP"]}
        />
        {processing && (
          <div className="mt-4">
            <Progress value={progress} />
            <p className="mt-1 text-xs text-muted" aria-live="polite">Analyzing images… {progress}%</p>
          </div>
        )}
        {errors.length > 0 && (
          <ul className="mt-4 space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-danger">
                <XCircle size={16} className="mt-0.5 shrink-0" /> {e}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {results.length === 0 && !processing ? (
        <EmptyState
          icon={<ShieldCheck size={40} />}
          title="No images analyzed yet"
          description="Upload JPG, PNG, or WebP files to get real sharpness, exposure, and noise measurements with a transparent risk score."
        />
      ) : (
        <div className="space-y-4">
          {results.map(({ img, risk }) => {
            const meta = RISK_META[risk.risk];
            const isOpen = expanded.has(img.id);
            const passedGuidelines = GUIDELINES.filter((g) => !(unchecked[img.id] ?? new Set()).has(g.id));
            return (
              <Card key={img.id}>
                <div className="flex flex-col gap-4 md:flex-row">
                  <img
                    src={img.previewUrl}
                    alt={`Preview of ${img.file.name}`}
                    className="h-36 w-full rounded-xl border border-border object-cover md:w-48"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-foreground">{img.file.name}</h3>
                      <Badge tone={meta.tone}><meta.Icon size={14} /> {meta.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {img.width}×{img.height} · {img.orientation} · brightness {img.brightnessPct}%
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={risk.score} tone={risk.score >= 75 ? "success" : risk.score >= 45 ? "blue" : "red"} className="max-w-xs" />
                      <span className="text-lg font-bold text-foreground">{risk.score}<span className="text-sm font-normal text-muted">/100 safer</span></span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{meta.text}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setExpanded((s) => { const n = new Set(s); n.has(img.id) ? n.delete(img.id) : n.add(img.id); return n; })}>
                        <ClipboardCheck size={16} /> {isOpen ? "Hide details" : "Details & QC checklist"} <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => downloadReport(img, risk)}>
                        <Download size={16} /> TXT report
                      </Button>
                      {savedIds[img.id] && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => markOutcome(savedIds[img.id], "accepted")}>
                            <Check size={16} /> Mark accepted
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => markOutcome(savedIds[img.id], "rejected")}>
                            <XCircle size={16} /> Mark rejected
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-5 space-y-5 border-t border-border pt-5">
                    {/* How the score was computed */}
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-foreground">How the score was computed</h4>
                      <div className="rounded-xl border border-border bg-secondary/50 p-3 text-xs">
                        <p className="text-muted">Start: <span className="font-semibold text-foreground">100</span></p>
                        {risk.deductions.length === 0 ? (
                          <p className="mt-1 text-muted">No deductions — all checks passed or were confirmed.</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {risk.deductions.map((d, i) => (
                              <li key={i} className="flex justify-between gap-2 text-muted">
                                <span>{d.label}</span>
                                <span className="font-semibold text-danger">−{d.points}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-2 border-t border-border pt-2 text-muted">
                          Final: <span className="font-bold text-foreground">{risk.score}/100</span> →{" "}
                          <span className="font-semibold">{meta.label}</span>
                          <span className="text-muted"> (Low ≥75 · Review 45–74 · High &lt;45)</span>
                        </p>
                      </div>
                    </div>

                    {/* Measurements */}
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-foreground">Measurements</h4>
                      <div className="grid gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-xl border border-border p-3">
                          <p className="font-medium text-foreground">Sharpness</p>
                          <p className="text-muted">{img.sharpness}/100 (Laplacian variance, fail &lt; {SHARPNESS_FAIL})</p>
                        </div>
                        <div className="rounded-xl border border-border p-3">
                          <p className="font-medium text-foreground">Exposure</p>
                          <p className="text-muted">Shadow clip {img.shadowClip.toFixed(1)}% · Highlight clip {img.highlightClip.toFixed(1)}% · {img.exposureVerdict}</p>
                        </div>
                        <div className="rounded-xl border border-border p-3">
                          <p className="font-medium text-foreground">Noise</p>
                          <p className="text-muted">{img.noise}/100 (smoothing deviation, warn &gt; {NOISE_WARN})</p>
                        </div>
                      </div>
                    </div>

                    {/* Findings */}
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-foreground">Findings</h4>
                      <ul className="space-y-2">
                        {risk.findings.map((f, i) => (
                          <li key={i} className="rounded-xl border border-border bg-secondary/50 p-3 text-xs">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge tone={LEVEL_TONE[f.level]}>{f.level.toUpperCase()}</Badge>
                              <span className="font-semibold text-foreground">{f.category}</span>
                            </div>
                            <p className="text-muted">{f.detail}</p>
                            <p className="mt-1 flex items-start gap-1.5 text-muted">
                              <Wrench size={13} className="mt-0.5 shrink-0 text-primaryBright" />
                              <span><strong className="text-foreground">Fix:</strong> {f.suggestion}</span>
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* QC checklist (guideline self-check) */}
                    <div>
                      <h4 className="mb-1 text-sm font-semibold text-foreground">Guideline self-check</h4>
                      <p className="mb-2 text-xs text-muted flex items-center gap-1.5">
                        <Info size={13} /> Tick each item yourself — unchecked items add risk (−10 each).
                      </p>
                      <div className="space-y-2">
                        {GUIDELINES.map((g) => {
                          const checked = !(unchecked[img.id] ?? new Set()).has(g.id);
                          return (
                            <label key={g.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/50 p-3 hover:border-primary">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleGuideline(img.id, g.id)}
                                aria-label={`QC checklist: ${g.label}`}
                                className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                              />
                              <span>
                                <span className="block text-sm font-medium text-foreground">{g.label}</span>
                                <span className="block text-xs text-muted">{g.detail}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-muted" aria-live="polite">
                        {passedGuidelines.length} of {GUIDELINES.length} confirmed.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Prediction history</h2>
          <p className="mb-3 text-xs text-muted">Compare predicted risk with the actual marketplace outcome you log.</p>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Predicted</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Actual outcome</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Log outcome</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const meta = RISK_META[h.risk];
                  return (
                    <tr key={h.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-foreground">{h.filename}</td>
                      <td className="px-4 py-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="px-4 py-3 text-foreground">{h.score}/100</td>
                      <td className="px-4 py-3">
                        {h.outcome === null ? (
                          <span className="text-muted">Not logged</span>
                        ) : h.outcome === "accepted" ? (
                          <Badge tone="success">Accepted</Badge>
                        ) : (
                          <Badge tone="red">Rejected</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">{formatDateTime(h.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => markOutcome(h.id, "accepted")} aria-label={`Mark ${h.filename} accepted`}>
                            <Check size={14} />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => markOutcome(h.id, "rejected")} aria-label={`Mark ${h.filename} rejected`}>
                            <XCircle size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info size={16} className="text-primaryBright" /> How scoring works (weights)
        </h3>
        <ul className="space-y-1 text-xs text-muted">
          <li>· Score starts at <strong className="text-foreground">100</strong> (safer = higher).</li>
          <li>· Sharpness &lt; {SHARPNESS_FAIL} → <strong className="text-danger">FAIL, −45</strong> · Sharpness {SHARPNESS_FAIL}–{SHARPNESS_SOFT} → warn, −15.</li>
          <li>· Shadow clipping &gt; {SHADOW_CLIP_WARN}% → warn, −10 · Highlight clipping &gt; {HIGHLIGHT_CLIP_WARN}% → warn, −10.</li>
          <li>· Noise &gt; {NOISE_WARN} → warn, −15 · Noise {NOISE_SOFT}–{NOISE_WARN} → warn, −5.</li>
          <li>· Each unchecked guideline self-check → warn, −10.</li>
          <li>· Labels: <strong className="text-foreground">Low Risk ≥ 75 · Review Recommended 45–74 · High Risk &lt; 45.</strong></li>
        </ul>
      </div>
    </div>
  );
}
