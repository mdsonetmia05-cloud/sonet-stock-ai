"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { History, Download, Trash2, ExternalLink, Search, FileDown, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/dialog";
import { localDb, bumpUsage, type JobStatus, type JobType } from "@/lib/db";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatDateTime, formatBytes, truncate, nowIso, uid } from "@/lib/utils";
import { JOB_ROUTE, JOB_TYPE_LABEL } from "@/lib/jobs";

function statusTone(s: JobStatus): "success" | "red" | "amber" | "neutral" | "info" {
  switch (s) {
    case "completed":
      return "success";
    case "failed":
    case "cancelled":
      return "red";
    case "processing":
      return "amber";
    case "queued":
      return "info";
    default:
      return "neutral";
  }
}

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All types" },
  ...(["image-to-prompt", "metadata", "prompt", "batch", "bg-remove", "upscale", "qc", "research"] as JobType[]).map(
    (t) => ({ value: t, label: JOB_TYPE_LABEL[t] }),
  ),
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

function qcRiskTone(r: "low" | "review" | "high"): "success" | "amber" | "red" {
  return r === "low" ? "success" : r === "review" ? "amber" : "red";
}

function HistoryBody() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState("jobs");
  const [search, setSearch] = useState(initialQ);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("date-desc");
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [deleteExportId, setDeleteExportId] = useState<string | null>(null);
  const [deleteQcId, setDeleteQcId] = useState<string | null>(null);

  const data = useMemo(() => {
    const db = localDb();
    return {
      db,
      jobs: db.jobs.all(),
      exports: db.exports.all(),
      qc: db.qcReports.all(),
    };
  }, [tick]);

  if (!data) return null;

  const filteredJobs = data.jobs
    .filter((j) =>
      (typeFilter === "all" || j.type === typeFilter) &&
      (statusFilter === "all" || j.status === statusFilter) &&
      (search.trim() === "" ||
        `${j.title} ${j.note ?? ""} ${JOB_TYPE_LABEL[j.type]}`.toLowerCase().includes(search.trim().toLowerCase())),
    )
    .sort((a, b) => {
      switch (sort) {
        case "date-asc":
          return a.createdAt.localeCompare(b.createdAt);
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });

  const handleExportCsv = () => {
    const rows = filteredJobs.map((j) => ({
      id: j.id,
      type: JOB_TYPE_LABEL[j.type] ?? j.type,
      title: j.title,
      status: j.status,
      total: j.total,
      done: j.done,
      failed: j.failed,
      note: j.note ?? "",
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }));
    const size = downloadCsv("history-jobs.csv", ["id", "type", "title", "status", "total", "done", "failed", "note", "createdAt", "updatedAt"], rows);
    data.db.exports.upsert({
      id: uid(),
      kind: "csv",
      filename: "history-jobs.csv",
      detail: `${rows.length} job record(s) exported from history`,
      sizeBytes: size,
      createdAt: nowIso(),
    });
    bumpUsage(data.db, { bytesExported: size });
    setTick((t) => t + 1);
  };

  const handleDeleteJob = () => {
    if (deleteJobId) {
      data.db.jobs.remove(deleteJobId);
      setDeleteJobId(null);
      setTick((t) => t + 1);
    }
  };
  const handleDeleteExport = () => {
    if (deleteExportId) {
      data.db.exports.remove(deleteExportId);
      setDeleteExportId(null);
      setTick((t) => t + 1);
    }
  };
  const handleDeleteQc = () => {
    if (deleteQcId) {
      data.db.qcReports.remove(deleteQcId);
      setDeleteQcId(null);
      setTick((t) => t + 1);
    }
  };

  const tabs = [
    { id: "jobs", label: `Jobs (${filteredJobs.length})`, icon: <History size={14} /> },
    { id: "exports", label: `Exports (${data.exports.length})`, icon: <FileDown size={14} /> },
    { id: "qc", label: `QC reports (${data.qc.length})`, icon: <ClipboardCheck size={14} /> },
  ];

  return (
    <div>
      <PageHeader
        title="History"
        description="Every job, export and QC report saved on this device."
        actions={
          <Button size="sm" variant="secondary" onClick={handleExportCsv} disabled={filteredJobs.length === 0}>
            <Download size={14} /> Export filtered CSV
          </Button>
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-5" />

      {tab === "jobs" && (
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
          </CardHeader>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input aria-label="Search jobs" placeholder="Search by title, note or type…" value={search}
                onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={TYPE_OPTIONS} />
            <Select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={STATUS_OPTIONS} />
            <Select aria-label="Sort jobs" value={sort} onChange={(e) => setSort(e.target.value)} options={[
              { value: "date-desc", label: "Newest first" },
              { value: "date-asc", label: "Oldest first" },
              { value: "title-asc", label: "Title A–Z" },
              { value: "title-desc", label: "Title Z–A" },
            ]} />
          </div>
          {filteredJobs.length === 0 ? (
            <EmptyState
              icon={<History size={28} />}
              title="No jobs match"
              description={data.jobs.length === 0 ? "Run any tool to create your first job record." : "Try clearing the search or filters."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 pr-3 font-medium">Title</th>
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Progress</th>
                    <th className="pb-2 pr-3 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((j) => (
                    <tr key={j.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-foreground">{truncate(j.title, 42)}</div>
                        {j.note && <div className="text-xs text-muted">{truncate(j.note, 60)}</div>}
                      </td>
                      <td className="py-2.5 pr-3 text-muted">{JOB_TYPE_LABEL[j.type] ?? j.type}</td>
                      <td className="py-2.5 pr-3"><Badge tone={statusTone(j.status)}>{j.status}</Badge></td>
                      <td className="py-2.5 pr-3 text-muted">
                        {j.total > 0 ? `${j.done}/${j.total}` : "—"}
                        {j.failed > 0 && <span className="ml-1 text-danger">({j.failed} failed)</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-muted">{formatDateTime(j.createdAt)}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <Link href={JOB_ROUTE[j.type]} aria-label={`Reopen ${j.title} in ${JOB_TYPE_LABEL[j.type]}`}>
                            <Button size="sm" variant="ghost" title="Reopen in tool">
                              <ExternalLink size={14} />
                            </Button>
                          </Link>
                          <Button size="sm" variant="ghost" title="Delete job" aria-label={`Delete ${j.title}`}
                            onClick={() => setDeleteJobId(j.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "exports" && (
        <Card>
          <CardHeader>
            <CardTitle>Exports history</CardTitle>
          </CardHeader>
          <p className="mb-4 text-xs text-muted">
            Read-only record of files you downloaded. The files themselves live on your device; this list tracks what was generated.
          </p>
          {data.exports.length === 0 ? (
            <EmptyState icon={<FileDown size={28} />} title="No exports yet" description="Downloaded CSV, text, ZIP or report files will be listed here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 pr-3 font-medium">Filename</th>
                    <th className="pb-2 pr-3 font-medium">Kind</th>
                    <th className="pb-2 pr-3 font-medium">Detail</th>
                    <th className="pb-2 pr-3 font-medium">Size</th>
                    <th className="pb-2 pr-3 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.exports.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-foreground">{e.filename}</td>
                      <td className="py-2.5 pr-3"><Badge tone="neutral">{e.kind}</Badge></td>
                      <td className="py-2.5 pr-3 text-muted">{truncate(e.detail, 50)}</td>
                      <td className="py-2.5 pr-3 text-muted">{e.sizeBytes != null ? formatBytes(e.sizeBytes) : "—"}</td>
                      <td className="py-2.5 pr-3 text-muted">{formatDateTime(e.createdAt)}</td>
                      <td className="py-2.5">
                        <Button size="sm" variant="ghost" title="Delete record" aria-label={`Delete record ${e.filename}`}
                          onClick={() => setDeleteExportId(e.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "qc" && (
        <Card>
          <CardHeader>
            <CardTitle>QC reports history</CardTitle>
          </CardHeader>
          <p className="mb-4 text-xs text-muted">
            Read-only list of heuristic rejection-risk checks. Scores reflect on-device measurements, not marketplace outcomes.
          </p>
          {data.qc.length === 0 ? (
            <EmptyState icon={<ClipboardCheck size={28} />} title="No QC reports yet" description="Run a rejection-risk check on an image to record a report here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 pr-3 font-medium">Filename</th>
                    <th className="pb-2 pr-3 font-medium">Risk</th>
                    <th className="pb-2 pr-3 font-medium">Score</th>
                    <th className="pb-2 pr-3 font-medium">Findings</th>
                    <th className="pb-2 pr-3 font-medium">Logged outcome</th>
                    <th className="pb-2 pr-3 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.qc.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-foreground">{truncate(r.filename, 40)}</td>
                      <td className="py-2.5 pr-3"><Badge tone={qcRiskTone(r.risk)}>{r.risk}</Badge></td>
                      <td className="py-2.5 pr-3 text-muted">{r.score}/100</td>
                      <td className="py-2.5 pr-3 text-muted">
                        {r.findings.filter((f) => f.level !== "pass").length} issue(s) of {r.findings.length}
                      </td>
                      <td className="py-2.5 pr-3 text-muted">{r.outcome ?? "not logged"}</td>
                      <td className="py-2.5 pr-3 text-muted">{formatDate(r.createdAt)}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <Link href="/rejection-predictor">
                            <Button size="sm" variant="ghost" title="Open rejection predictor">
                              <ExternalLink size={14} />
                            </Button>
                          </Link>
                          <Button size="sm" variant="ghost" title="Delete report" aria-label={`Delete report ${r.filename}`}
                            onClick={() => setDeleteQcId(r.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={deleteJobId !== null}
        onClose={() => setDeleteJobId(null)}
        onConfirm={handleDeleteJob}
        title="Delete job?"
        message="This removes the job record from your local workspace. Generated files and exports are not affected."
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={deleteExportId !== null}
        onClose={() => setDeleteExportId(null)}
        onConfirm={handleDeleteExport}
        title="Delete export record?"
        message="This removes the record from your exports history. Already-downloaded files on your device are not affected."
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={deleteQcId !== null}
        onClose={() => setDeleteQcId(null)}
        onConfirm={handleDeleteQc}
        title="Delete QC report?"
        message="This removes the QC report from your local workspace."
        confirmLabel="Delete"
      />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading history…</div>}>
      <HistoryBody />
    </Suspense>
  );
}
