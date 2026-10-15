"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Images,
  FileText,
  Wand2,
  Compass,
  Download,
  Star,
  CalendarDays,
  Lightbulb,
  Search,
  ArrowUpDown,
  ExternalLink,
  Trash2,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useAuth } from "@/components/providers";
import { dbFor, bumpUsage, type Job, type JobStatus, type JobType } from "@/lib/db";
import { downloadCsv } from "@/lib/csv";
import { getEventsForYear } from "@/lib/events";
import { formatDate, formatDateTime, truncate, nowIso, uid } from "@/lib/utils";
import { JOB_ROUTE, JOB_TYPE_LABEL } from "@/lib/jobs";

function statusTone(s: JobStatus): "success" | "red" | "amber" | "neutral" | "blue" {
  switch (s) {
    case "completed":
      return "success";
    case "failed":
    case "cancelled":
      return "red";
    case "processing":
      return "amber";
    case "queued":
      return "blue";
    default:
      return "neutral";
  }
}

const SUGGESTED_TOPICS = [
  "Minimal workspace flat-lays for remote-work collections",
  "Authentic South Asian family lifestyle moments",
  "Eco-friendly packaging and reusable products",
  "Candid street food preparation scenes",
  "Diverse hands using modern technology",
  "Seasonal festival decorations and lights",
];

const SAMPLE_BARS = [34, 52, 44, 66, 58, 76, 62, 84, 70, 90, 78, 56];

export default function DashboardPage() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("date-desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!user) return null;
    const db = dbFor(user.id);
    const jobs = db.jobs.all();
    const exports_ = db.exports.all();
    const favPrompts = db.prompts.all().filter((p) => p.favorite);
    const favItems = db.favorites.all().filter((f) => f.kind === "prompt");
    const usage = db.usage.all();
    const imagesProcessed = usage.reduce((n, u) => n + (u.imagesProcessed ?? 0), 0);
    const stats = {
      imagesProcessed,
      metadata: db.metadata.count(),
      prompts: db.prompts.count(),
      research: db.research.count(),
    };
    const statusCounts = jobs.reduce<Record<string, number>>((acc, j) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    }, {});
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const upcoming = getEventsForYear(today.getFullYear())
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
    return { db, jobs, exports_, favPrompts, favItems, usage, stats, statusCounts, upcoming };
  }, [user, tick]);

  if (!user || !data) return null;

  const allZero = Object.values(data.stats).every((v) => v === 0);

  const filteredJobs = data.jobs
    .filter((j) =>
      (statusFilter === "all" || j.status === statusFilter) &&
      (search.trim() === "" || `${j.title} ${j.note ?? ""} ${JOB_TYPE_LABEL[j.type]}`.toLowerCase().includes(search.trim().toLowerCase())),
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

  const recentJobs = filteredJobs.slice(0, 6);

  const handleExportJobs = () => {
    const rows = filteredJobs.map((j) => ({
      id: j.id,
      type: JOB_TYPE_LABEL[j.type] ?? j.type,
      title: j.title,
      status: j.status,
      total: j.total,
      done: j.done,
      failed: j.failed,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }));
    const size = downloadCsv("jobs-export.csv", ["id", "type", "title", "status", "total", "done", "failed", "createdAt", "updatedAt"], rows);
    data.db.exports.upsert({
      id: uid(),
      kind: "csv",
      filename: "jobs-export.csv",
      detail: `${rows.length} job record(s) exported`,
      sizeBytes: size,
      createdAt: nowIso(),
    });
    bumpUsage(data.db, { bytesExported: size });
    setTick((t) => t + 1);
  };

  const handleDeleteJob = () => {
    if (deleteId) {
      data.db.jobs.remove(deleteId);
      setDeleteId(null);
      setTick((t) => t + 1);
    }
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your local workspace at a glance. All counts come from activity recorded on this device."
        actions={
          <Link href="/batch-editor">
            <Button size="sm">
              <Activity size={14} /> New batch job
            </Button>
          </Link>
        }
      />

      {/* stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Images processed" value={data.stats.imagesProcessed} icon={<Images size={18} />} hint="Local device processing only" />
        <StatCard label="Metadata records" value={data.stats.metadata} icon={<FileText size={18} />} hint="Saved to local workspace" />
        <StatCard label="Prompts created" value={data.stats.prompts} icon={<Wand2 size={18} />} hint="Saved prompt records" />
        <StatCard label="Research projects" value={data.stats.research} icon={<Compass size={18} />} hint="Your research notes" />
      </div>

      {allZero && (
        <EmptyState
          icon={<Activity size={32} />}
          title="Your workspace is empty — and that's expected"
          description="These counters only grow when you use the tools. Nothing is pre-filled or estimated. Start with the metadata generator or prompt generator."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/metadata-generator"><Button size="sm">Metadata Generator</Button></Link>
              <Link href="/prompt-generator"><Button size="sm" variant="secondary">Prompt Generator</Button></Link>
            </div>
          }
          className="mb-6"
        />
      )}

      {/* sample analytics illustration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>What analytics will look like</CardTitle>
          <Badge tone="neutral">SAMPLE</Badge>
        </CardHeader>
        <p className="mb-3 text-xs text-muted">
          Illustration only — your real charts will be built from your on-device usage once you start working.
        </p>
        <div className="flex h-24 items-end gap-1.5" aria-hidden>
          {SAMPLE_BARS.map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-primary/50" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>12 weeks of activity (illustrative)</span>
          <span>No marketplace metrics</span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* recent jobs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleExportJobs} disabled={filteredJobs.length === 0}>
                <Download size={14} /> Export CSV
              </Button>
              <Link href="/history"><Button size="sm" variant="ghost">View all history</Button></Link>
            </div>
          </CardHeader>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                aria-label="Search jobs"
                placeholder="Search jobs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              aria-label="Filter by status"
              className="sm:w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "All statuses" },
                { value: "queued", label: "Queued" },
                { value: "processing", label: "Processing" },
                { value: "paused", label: "Paused" },
                { value: "completed", label: "Completed" },
                { value: "failed", label: "Failed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
            <Select
              aria-label="Sort jobs"
              className="sm:w-40"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              options={[
                { value: "date-desc", label: "Newest first" },
                { value: "date-asc", label: "Oldest first" },
                { value: "title-asc", label: "Title A–Z" },
                { value: "title-desc", label: "Title Z–A" },
              ]}
            />
          </div>
          {recentJobs.length === 0 ? (
            <EmptyState
              icon={<Activity size={28} />}
              title="No jobs yet"
              description="Run any tool — bulk upscaling, metadata generation, research — and it will appear here."
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
                    <th className="pb-2 pr-3 font-medium">Updated</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((j) => (
                    <tr key={j.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-foreground">{truncate(j.title, 40)}</td>
                      <td className="py-2.5 pr-3 text-muted">{JOB_TYPE_LABEL[j.type] ?? j.type}</td>
                      <td className="py-2.5 pr-3"><Badge tone={statusTone(j.status)}>{j.status}</Badge></td>
                      <td className="py-2.5 pr-3 text-muted">
                        {j.total > 0 ? `${j.done}/${j.total}` : "—"}
                        {j.failed > 0 && <span className="ml-1 text-danger">({j.failed} failed)</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-muted">{formatDateTime(j.updatedAt)}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <Link href={JOB_ROUTE[j.type]} aria-label={`Reopen ${j.title} in ${JOB_TYPE_LABEL[j.type]}`}>
                            <Button size="sm" variant="ghost" title="Reopen in tool">
                              <ExternalLink size={14} />
                            </Button>
                          </Link>
                          <Button size="sm" variant="ghost" title="Delete job" aria-label={`Delete ${j.title}`} onClick={() => setDeleteId(j.id)}>
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

        {/* job status summary */}
        <Card>
          <CardHeader>
            <CardTitle>Job status summary</CardTitle>
          </CardHeader>
          {data.jobs.length === 0 ? (
            <p className="text-sm text-muted">No jobs recorded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(["completed", "processing", "queued", "paused", "failed", "cancelled"] as JobStatus[]).map((s) => (
                data.statusCounts[s] ? (
                  <Badge key={s} tone={statusTone(s)}>
                    {s}: {data.statusCounts[s]}
                  </Badge>
                ) : null
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            {data.statusCounts.failed ? (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <AlertTriangle size={12} /> {data.statusCounts.failed} failed job(s) — see History to review and retry.
              </span>
            ) : (
              "Counts are computed from jobs on this device."
            )}
          </p>
        </Card>

        {/* recent downloads */}
        <Card>
          <CardHeader>
            <CardTitle>Recent downloads</CardTitle>
            <Link href="/history"><Button size="sm" variant="ghost">All</Button></Link>
          </CardHeader>
          {data.exports_.slice(0, 5).length === 0 ? (
            <p className="text-sm text-muted">No downloads yet. Exports you make will be listed here.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.exports_.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{e.filename}</div>
                    <div className="text-xs text-muted">{truncate(e.detail, 50)} · {formatDate(e.createdAt)}</div>
                  </div>
                  <Badge tone="neutral">{e.kind}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* favorite prompts */}
        <Card>
          <CardHeader>
            <CardTitle>Favorite prompts</CardTitle>
            <Link href="/prompt-generator"><Button size="sm" variant="ghost">Generate</Button></Link>
          </CardHeader>
          {data.favPrompts.length === 0 && data.favItems.length === 0 ? (
            <p className="text-sm text-muted">No favorites yet. Star a prompt in the prompt generator to pin it here.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.favPrompts.slice(0, 4).map((p) => (
                <li key={p.id} className="rounded-xl bg-secondary/60 px-3 py-2">
                  <div className="flex items-start gap-2">
                    <Star size={13} className="mt-0.5 shrink-0 text-amber-400" fill="currentColor" />
                    <p className="text-sm text-foreground">{truncate(p.text, 110)}</p>
                  </div>
                </li>
              ))}
              {data.favItems.slice(0, Math.max(0, 4 - data.favPrompts.length)).map((f) => (
                <li key={f.id} className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-foreground">
                  {truncate(f.label, 110)}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* upcoming events */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming events</CardTitle>
            <Link href="/event-calendar"><Button size="sm" variant="ghost">Calendar</Button></Link>
          </CardHeader>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted">No upcoming events in the curated calendar for this year.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2">
                  <CalendarDays size={15} className="shrink-0 text-primaryBright" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{e.name}</div>
                    <div className="text-xs text-muted">{formatDate(e.date)} · {e.region}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* suggested topics */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Suggested topics to explore</CardTitle>
            <Badge tone="blue">Suggestions</Badge>
          </CardHeader>
          <p className="mb-3 text-xs text-muted">
            Generic creative ideas, not market data — verify demand on each marketplace yourself before investing production time.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SUGGESTED_TOPICS.map((t) => (
              <div key={t} className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                <Lightbulb size={14} className="mt-0.5 shrink-0 text-primaryBright" />
                <span className="text-sm text-foreground">{t}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteJob}
        title="Delete job?"
        message="This removes the job record from your local workspace. Generated files and exports are not affected."
        confirmLabel="Delete"
      />
    </div>
  );
}
