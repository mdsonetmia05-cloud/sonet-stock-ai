"use client";

import { useMemo, useState } from "react";
import {
  Search, Copy, Download, FileText, Save, BarChart3,
  Lightbulb, Check, Upload, FileDown, Trash2, Table2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { localDb, bumpUsage } from "@/lib/db";
import { downloadCsv, downloadTextFile, parseCsv } from "@/lib/csv";
import { uid, nowIso, cn, formatDateTime } from "@/lib/utils";

interface PortfolioItem {
  id: string;
  title: string;
  platform: string;
  assetType: string;
  category: string;
  keywords: string[];
  downloads: number | null;
  uploadDate: string;
}

/** Flexible header matching: "Asset Type", "asset_type", "type" all work. */
function pick(row: Record<string, string>, ...names: string[]): string {
  const keys = Object.keys(row);
  for (const n of names) {
    const hit = keys.find((k) => k.trim().toLowerCase().replace(/[_\s]+/g, "") === n);
    if (hit && row[hit]) return row[hit];
  }
  return "";
}

function normalize(rows: Array<Record<string, string>>): PortfolioItem[] {
  return rows.map((r, i) => {
    const dlRaw = pick(r, "downloads", "sales", "downloadcount").replace(/[^0-9.\-]/g, "");
    const dl = dlRaw === "" ? null : Number(dlRaw);
    const kwRaw = pick(r, "keywords", "tags");
    const keywords = kwRaw.split(/[;|]/).map((k) => k.trim()).filter(Boolean)
      .flatMap((k) => k.includes(",") && !k.includes(" ") ? [k] : k.split(",").map((x) => x.trim()))
      .filter(Boolean);
    return {
      id: `row-${i}`,
      title: pick(r, "title", "name", "filename") || `Asset ${i + 1}`,
      platform: pick(r, "platform", "site", "marketplace") || "Unknown",
      assetType: pick(r, "assettype", "type", "asset") || "Unknown",
      category: pick(r, "category", "categories") || "Uncategorized",
      keywords,
      downloads: dl !== null && Number.isFinite(dl) ? dl : null,
      uploadDate: pick(r, "uploaddate", "date", "created", "uploaddedat"),
    };
  });
}

const TEMPLATE_COLUMNS = ["title", "platform", "assetType", "category", "keywords", "downloads", "uploadDate"];
const TEMPLATE_ROWS = [
  { title: "Sunset over rice fields", platform: "Adobe Stock", assetType: "photo", category: "Nature", keywords: "sunset;rice field;rural", downloads: "12", uploadDate: "2026-03-14" },
  { title: "Business team meeting", platform: "Shutterstock", assetType: "photo", category: "Business", keywords: "business;team;office", downloads: "4", uploadDate: "2026-05-02" },
];

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
  const { copied, copy } = useClipboard();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("All");
  const [assetType, setAssetType] = useState("All");
  const [category, setCategory] = useState("All");
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState(() => localDb().research.all());

  const db = useMemo(() => localDb(), []);

  const handleFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setParseError(null);
    try {
      const text = await f.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setParseError("No data rows found in this CSV. Check the file and try again.");
        return;
      }
      const norm = normalize(rows);
      const hasTitle = norm.some((n) => n.title && !n.title.startsWith("Asset "));
      if (!hasTitle && rows.length > 0) {
        setParseError("Could not find a title column. Expected headers like: title, platform, assetType, category, keywords, downloads, uploadDate.");
        return;
      }
      setItems(norm);
      setFileName(f.name);
      setQuery(""); setPlatform("All"); setAssetType("All"); setCategory("All");
    } catch {
      setParseError("Could not read this file. Please upload a valid .csv file.");
    }
  };

  const downloadTemplate = () => {
    downloadCsv("portfolio-template.csv", TEMPLATE_COLUMNS, TEMPLATE_ROWS);
  };

  const clearData = () => {
    setItems([]);
    setFileName(null);
    setParseError(null);
  };

  const platforms = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.platform))).sort()], [items]);
  const assetTypes = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.assetType))).sort()], [items]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.category))).sort()], [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (platform !== "All" && item.platform !== platform) return false;
      if (assetType !== "All" && item.assetType !== assetType) return false;
      if (category !== "All" && item.category !== category) return false;
      if (q) {
        const hay = `${item.title} ${item.keywords.join(" ")} ${item.category} ${item.platform}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, platform, assetType, category]);

  const stats = useMemo(() => {
    const withDl = filtered.filter((i) => i.downloads !== null) as Array<PortfolioItem & { downloads: number }>;
    const totalDownloads = withDl.reduce((n, i) => n + i.downloads, 0);
    const countBy = (get: (i: PortfolioItem) => string) => {
      const m = new Map<string, number>();
      for (const i of filtered) m.set(get(i), (m.get(get(i)) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const kwCount = new Map<string, number>();
    for (const i of filtered) for (const k of i.keywords) kwCount.set(k.toLowerCase(), (kwCount.get(k.toLowerCase()) ?? 0) + 1);
    const topKeywords = [...kwCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    return {
      total: filtered.length,
      totalDownloads: withDl.length ? totalDownloads : null,
      avgDownloads: withDl.length ? totalDownloads / withDl.length : null,
      downloadsCoverage: withDl.length,
      byPlatform: countBy((i) => i.platform),
      byCategory: countBy((i) => i.category),
      byAssetType: countBy((i) => i.assetType),
      topKeywords,
    };
  }, [filtered]);

  const observations = useMemo(() => {
    const notes: string[] = [];
    if (!filtered.length) return notes;
    const [topCat, topCatN] = stats.byCategory[0] ?? [];
    if (topCat && topCatN) {
      const pct = Math.round((topCatN / filtered.length) * 100);
      notes.push(`${pct}% of the analyzed assets (${topCatN} of ${filtered.length}) are in "${topCat}".`);
    }
    const [topPlat, topPlatN] = stats.byPlatform[0] ?? [];
    if (topPlat && topPlatN && stats.byPlatform.length > 1) {
      const pct = Math.round((topPlatN / filtered.length) * 100);
      notes.push(`${topPlat} holds ${pct}% of the analyzed assets — the rest is spread across ${stats.byPlatform.length - 1} other platform(s).`);
    }
    if (stats.topKeywords.length) {
      notes.push(`Most reused keywords: ${stats.topKeywords.slice(0, 5).map(([k, n]) => `${k} (${n})`).join(", ")}.`);
    }
    if (stats.avgDownloads !== null) {
      notes.push(`Average downloads per asset (from your downloads column): ${stats.avgDownloads.toFixed(1)} across ${stats.downloadsCoverage} assets with download data.`);
    } else {
      notes.push("No downloads column found — add one to analyze per-asset performance.");
    }
    return notes;
  }, [filtered, stats]);

  const saveProject = () => {
    const project = {
      id: uid(),
      query: fileName ?? "portfolio analysis",
      platform, assetType, category,
      resultCount: filtered.length,
      createdAt: nowIso(),
    };
    db.research.upsert(project);
    setSavedProjects(db.research.all());
    setSavedNote("Analysis saved to research projects.");
    setTimeout(() => setSavedNote(null), 2000);
  };

  const exportTxt = () => {
    const lines: string[] = [];
    lines.push("SONET STOCK AI — Portfolio Analysis Report");
    lines.push(`Source file: ${fileName ?? "(unknown)"}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Filters — query: "${query.trim() || "(none)"}", platform: ${platform}, asset type: ${assetType}, category: ${category}`);
    lines.push(`Assets analyzed: ${filtered.length}`);
    if (stats.totalDownloads !== null) lines.push(`Total downloads: ${stats.totalDownloads}`);
    lines.push("");
    lines.push("== By platform ==");
    stats.byPlatform.forEach(([p, n]) => lines.push(`${p}: ${n}`));
    lines.push("");
    lines.push("== By category ==");
    stats.byCategory.forEach(([c, n]) => lines.push(`${c}: ${n}`));
    lines.push("");
    lines.push("== By asset type ==");
    stats.byAssetType.forEach(([t, n]) => lines.push(`${t}: ${n}`));
    lines.push("");
    lines.push("== Top keywords ==");
    stats.topKeywords.forEach(([k, n]) => lines.push(`${k}: ${n}`));
    lines.push("");
    lines.push("== Observations (computed from your uploaded data) ==");
    observations.forEach((o, i) => lines.push(`${i + 1}. ${o}`));
    const text = lines.join("\n");
    downloadTextFile(`portfolio-analysis-${Date.now()}.txt`, text);
    const size = new Blob([text]).size;
    db.exports.upsert({
      id: uid(), kind: "txt", filename: "portfolio-analysis-report.txt",
      detail: `${filtered.length} assets analyzed, TXT report`, sizeBytes: size, createdAt: nowIso(),
    });
    bumpUsage(db, { bytesExported: size });
  };

  const exportCsv = () => {
    const columns = ["Title", "Platform", "AssetType", "Category", "Keywords", "Downloads", "UploadDate"];
    const rows = filtered.map((item) => ({
      Title: item.title,
      Platform: item.platform,
      AssetType: item.assetType,
      Category: item.category,
      Keywords: item.keywords.join("; "),
      Downloads: item.downloads ?? "",
      UploadDate: item.uploadDate,
    }));
    const size = downloadCsv(`portfolio-analysis-${Date.now()}.csv`, columns, rows);
    db.exports.upsert({
      id: uid(), kind: "csv", filename: "portfolio-analysis.csv",
      detail: `${filtered.length} assets analyzed, CSV export`, sizeBytes: size, createdAt: nowIso(),
    });
    bumpUsage(db, { bytesExported: size });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolio Analysis"
        description="Upload a portfolio CSV — every number below comes from your file."
        actions={
          items.length > 0 && (
            <>
              <Button variant="secondary" size="sm" onClick={exportTxt}>
                <FileText size={16} /> Export TXT
              </Button>
              <Button variant="secondary" size="sm" onClick={exportCsv}>
                <Download size={16} /> Export CSV
              </Button>
              <Button size="sm" onClick={saveProject}>
                <Save size={16} /> Save analysis
              </Button>
            </>
          )
        }
      />

      {savedNote && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primaryBright">
          <Check size={16} /> {savedNote}
        </div>
      )}

      {items.length === 0 ? (
        <div className="mx-auto max-w-2xl">
          <Card className="p-6">
            <FileDropzone
              accept=".csv,text/csv"
              multiple={false}
              onFiles={handleFiles}
              label="Upload your portfolio CSV"
              hint="Drag and drop your CSV here, or click to browse"
              formats={["CSV"]}
            />
            {parseError && (
              <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger" role="alert">
                {parseError}
              </p>
            )}
            <div className="mt-5 rounded-xl bg-secondary/60 p-4 text-sm text-muted">
              <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <Table2 size={15} /> Expected CSV format
              </p>
              <p className="mb-3 text-xs leading-relaxed">
                Flexible headers: <code className="text-foreground">title, platform, assetType, category, keywords, downloads, uploadDate</code>.
                Separate keywords with <code className="text-foreground">;</code> or <code className="text-foreground">,</code>.
                The <code className="text-foreground">downloads</code> column is optional — add it for per-asset performance.
              </p>
              <Button size="sm" variant="secondary" onClick={downloadTemplate}>
                <FileDown size={14} /> Download CSV template
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
            <Upload size={16} className="text-primaryBright" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{fileName}</span>
              <span className="text-muted"> — {items.length} assets</span>
            </p>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={downloadTemplate}>
                <FileDown size={14} /> Template
              </Button>
              <Button size="sm" variant="ghost" onClick={clearData}>
                <Trash2 size={14} /> Clear
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Assets analyzed" value={stats.total} icon={<BarChart3 size={18} />} hint="Rows after filters" />
            <StatCard
              label="Total downloads"
              value={stats.totalDownloads !== null ? stats.totalDownloads.toLocaleString() : "—"}
              icon={<Download size={18} />}
              hint={stats.totalDownloads !== null ? `From ${stats.downloadsCoverage} assets` : "Add a downloads column"}
            />
            <StatCard
              label="Avg downloads / asset"
              value={stats.avgDownloads !== null ? stats.avgDownloads.toFixed(1) : "—"}
              icon={<BarChart3 size={18} />}
              hint="From your downloads column"
            />
            <StatCard label="Platforms" value={stats.byPlatform.length} icon={<Table2 size={18} />} hint="In your file" />
          </div>

          {/* Filters */}
          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Label htmlFor="sa-query">Search your assets</Label>
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
                <Select id="sa-platform" options={platforms} value={platform} onChange={(e) => setPlatform(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="sa-asset">Asset type</Label>
                <Select id="sa-asset" options={assetTypes} value={assetType} onChange={(e) => setAssetType(e.target.value)} />
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor="sa-category">Category</Label>
                <Select id="sa-category" options={categories} value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="flex items-end">
                <p className="text-sm text-muted" aria-live="polite">
                  <span className="font-semibold text-foreground">{filtered.length}</span> assets match
                </p>
              </div>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search size={40} />}
              title="No assets match"
              description="Broaden the keyword or clear a filter."
              action={<Button variant="secondary" onClick={() => { setQuery(""); setPlatform("All"); setAssetType("All"); setCategory("All"); }}>Clear filters</Button>}
            />
          ) : (
            <>
              {/* Breakdowns */}
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { title: "By platform", rows: stats.byPlatform },
                  { title: "By category", rows: stats.byCategory },
                  { title: "By asset type", rows: stats.byAssetType },
                ].map((panel) => (
                  <Card key={panel.title}>
                    <CardHeader><p className="text-sm font-semibold text-foreground">{panel.title}</p></CardHeader>
                    <div className="space-y-2">
                      {panel.rows.map(([label, n]) => {
                        const pct = filtered.length ? Math.round((n / filtered.length) * 100) : 0;
                        return (
                          <div key={label}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-medium text-foreground">{label}</span>
                              <span className="text-muted">{n} · {pct}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                              <div className="h-full rounded-full bg-primaryBright" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Observations + keywords */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-6">
                  <CardHeader><p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Lightbulb size={15} className="text-primaryBright" /> Observations</p></CardHeader>
                  <p className="mb-3 text-xs text-muted">Computed from your file.</p>
                  <ul className="space-y-2">
                    {observations.map((o, i) => (
                      <li key={i} className="rounded-xl border border-border bg-secondary/50 p-3 text-xs leading-relaxed text-muted">{o}</li>
                    ))}
                  </ul>
                </Card>
                <Card className="p-6">
                  <CardHeader><p className="text-sm font-semibold text-foreground">Top keywords in your portfolio</p></CardHeader>
                  {stats.topKeywords.length === 0 ? (
                    <p className="text-sm text-muted">Add a keywords column to see this.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {stats.topKeywords.map(([k, n]) => (
                        <button
                          key={k}
                          onClick={() => copy(k, k)}
                          title="Click to copy"
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-foreground hover:border-primary hover:text-primaryBright"
                        >
                          {copied === k ? <Check size={12} /> : <Copy size={12} />}
                          {k} <span className="text-muted">({n})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Asset table */}
              <Card className="p-6">
                <CardHeader><p className="text-sm font-semibold text-foreground">Assets</p></CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-muted">
                        <th className="pb-2.5 pr-3 font-medium">Title</th>
                        <th className="pb-2.5 pr-3 font-medium">Platform</th>
                        <th className="pb-2.5 pr-3 font-medium">Type</th>
                        <th className="pb-2.5 pr-3 font-medium">Category</th>
                        <th className="pb-2.5 font-medium">Downloads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 100).map((item) => (
                        <tr key={item.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-secondary/40">
                          <td className="py-3 pr-3 font-medium text-foreground">{item.title}</td>
                          <td className="py-3 pr-3"><Badge tone="info">{item.platform}</Badge></td>
                          <td className="py-3 pr-3 text-muted">{item.assetType}</td>
                          <td className="py-3 pr-3 text-muted">{item.category}</td>
                          <td className="py-3 text-muted">{item.downloads !== null ? item.downloads.toLocaleString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length > 100 && (
                    <p className="mt-2 text-xs text-muted">100 of {filtered.length} shown — export for the full list.</p>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* Saved analyses */}
          {savedProjects.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Saved analyses</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {savedProjects.map((p) => (
                  <Card key={p.id} className="p-4 transition-colors hover:border-primary/40">
                    <p className="font-medium text-foreground">{p.query}</p>
                    <p className="mt-1 text-xs text-muted">
                      {p.platform} · {p.assetType} · {p.category} · {p.resultCount} assets
                    </p>
                    <p className="mt-1 text-xs text-muted">{formatDateTime(p.createdAt)}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
