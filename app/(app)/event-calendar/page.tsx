"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Search, Copy, Check, Star, Sparkles, Download,
  ClipboardList, ChevronDown, Info,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { localDb, bumpUsage } from "@/lib/db";
import { downloadCsv } from "@/lib/csv";
import {
  getEventsForYear, filterEvents, EVENT_CATEGORIES, COUNTRIES,
  DATE_TYPE_LABEL, type StockEvent, type EventDateType,
} from "@/lib/events";
import { uid, nowIso, cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CHECKLIST_STEPS = [
  { id: "concept", label: "Concept locked", hint: "Subject, style, composition decided" },
  { id: "produce", label: "Content produced", hint: "Shot or generated" },
  { id: "qc", label: "Quality check passed", hint: "Sharpness, exposure, noise reviewed" },
  { id: "metadata", label: "Metadata written", hint: "Title, description, keywords" },
  { id: "upload", label: "Uploaded in production window", hint: "Before the deadline in the card" },
];

const PRIORITY_TONE: Record<StockEvent["priority"], "red" | "amber" | "neutral"> = {
  high: "red", medium: "amber", low: "neutral",
};

const DATE_TYPE_TONE: Record<EventDateType, "success" | "info" | "amber"> = {
  verified: "success", computed: "info", approximate: "amber",
};

const DRAFT_KEY = "ssa:v1:draft:prompt-idea";
const checklistKey = (eventId: string) => `ssa:v1:checklist:${eventId}`;

function readChecklist(eventId: string): string[] {
  try {
    const raw = window.localStorage.getItem(checklistKey(eventId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

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

function formatEventDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export default function EventCalendarPage() {
  const router = useRouter();
  const { copied, copy } = useClipboard();

  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState<number | null>(null);
  const [country, setCountry] = useState<string>("All");
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedChecklist, setExpandedChecklist] = useState<Set<string>>(new Set());
  const [checklists, setChecklists] = useState<Record<string, string[]>>({});
  const [favIds, setFavIds] = useState<Set<string>>(() =>
    new Set(localDb().favorites.all().filter((f) => f.kind === "event").map((f) => f.refId)),
  );

  const allEvents = useMemo(() => getEventsForYear(Number(year)), [year]);

  const events = useMemo(() => {
    const base = filterEvents(allEvents, {
      country, category, query, favoritesOnly, favoriteIds: favIds,
    });
    if (month === null) return base;
    return base.filter((e) => Number(e.date.slice(5, 7)) === month + 1);
  }, [allEvents, country, category, query, favoritesOnly, favIds, month]);

  const db = localDb();

  const toggleFavorite = (event: StockEvent) => {
    if (favIds.has(event.id)) {
      const existing = db.favorites.all().find((f) => f.kind === "event" && f.refId === event.id);
      if (existing) db.favorites.remove(existing.id);
      setFavIds((s) => { const n = new Set(s); n.delete(event.id); return n; });
    } else {
      db.favorites.upsert({ id: uid(), kind: "event", refId: event.id, label: event.name, createdAt: nowIso() });
      setFavIds((s) => new Set(s).add(event.id));
    }
  };

  const generatePrompt = (event: StockEvent) => {
    const draft = {
      idea: `Stock content for ${event.name}: ${event.contentSuggestions[0] ?? "seasonal concept"}`,
      category: "seasonal",
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // storage unavailable — still navigate
    }
    bumpUsage(db, { promptsCreated: 1 });
    router.push("/prompt-generator");
  };

  const toggleChecklistStep = (eventId: string, stepId: string) => {
    setChecklists((prev) => {
      const current = prev[eventId] ?? readChecklist(eventId);
      const next = current.includes(stepId)
        ? current.filter((s) => s !== stepId)
        : [...current, stepId];
      try {
        window.localStorage.setItem(checklistKey(eventId), JSON.stringify(next));
      } catch { /* ignore */ }
      return { ...prev, [eventId]: next };
    });
  };

  const toggleSelect = (eventId: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(eventId)) n.delete(eventId); else n.add(eventId);
      return n;
    });
  };

  const toggleChecklistExpanded = (eventId: string) => {
    setExpandedChecklist((s) => {
      const n = new Set(s);
      if (n.has(eventId)) n.delete(eventId); else n.add(eventId);
      return n;
    });
  };

  const exportSelected = () => {
    const chosen = events.filter((e) => selected.has(e.id));
    if (!chosen.length) return;
    const columns = ["Name", "Date", "DateType", "Region", "ProductionWindow", "Keywords", "Priority"];
    const rows = chosen.map((e) => ({
      Name: e.name,
      Date: e.date,
      DateType: DATE_TYPE_LABEL[e.dateType],
      Region: e.region,
      ProductionWindow: e.productionWindow,
      Keywords: e.keywords.join("; "),
      Priority: e.priority,
    }));
    const size = downloadCsv(`event-calendar-${year}-selected.csv`, columns, rows);
    db.exports.upsert({
      id: uid(), kind: "csv", filename: `event-calendar-${year}-selected.csv`,
      detail: `${chosen.length} events exported`, sizeBytes: size, createdAt: nowIso(),
    });
    bumpUsage(db, { bytesExported: size });
  };

  const clearFilters = () => {
    setQuery(""); setCountry("All"); setCategory("All");
    setMonth(null); setFavoritesOnly(false);
  };

  return (
    <div>
      <PageHeader
        title="Event Calendar"
        description="Plan seasonal stock content around holidays and campaigns. Dates are computed with lib/events.ts — verify approximate dates locally before producing."
        actions={
          <Button
            variant="secondary" size="sm"
            onClick={exportSelected}
            disabled={selected.size === 0}
          >
            <Download size={16} /> Export selected ({selected.size})
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tabs
            tabs={[{ id: "2026", label: "2026" }, { id: "2027", label: "2027" }]}
            active={year}
            onChange={(id) => { setYear(id); setMonth(null); setSelected(new Set()); }}
          />
          <span className="text-xs text-muted">{allEvents.length} events in {year}</span>
        </div>

        <div className="mb-4" role="group" aria-label="Filter by month">
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => setMonth(month === i ? null : i)}
                aria-pressed={month === i}
                aria-label={`Filter by ${m} ${year}`}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                  month === i
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-secondary text-muted hover:text-foreground hover:border-primary",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Label htmlFor="ec-search">Search events</Label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                id="ec-search"
                placeholder="e.g. diwali, travel, sale…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ec-country">Country / region</Label>
            <Select id="ec-country" options={COUNTRIES as unknown as string[]} value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ec-category">Category</Label>
            <Select id="ec-category" options={["All", ...EVENT_CATEGORIES]} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
              aria-label="Show favorites only"
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <Star size={14} className="text-amber-400" /> Favorites only
          </label>
          <p className="text-sm text-muted" aria-live="polite">
            <span className="font-semibold text-foreground">{events.length}</span> events match
          </p>
        </div>
      </Card>

      {/* Event cards */}
      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="No events match"
          description="Try a different month, country, category, or clear your filters."
          action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map((event) => {
            const isFav = favIds.has(event.id);
            const isSelected = selected.has(event.id);
            const checklistOpen = expandedChecklist.has(event.id);
            const checked = checklists[event.id] ?? readChecklist(event.id);
            return (
              <Card key={event.id} className={cn(isSelected && "border-primary/60")}>
                <CardHeader>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(event.id)}
                      aria-label={`Select ${event.name} for export`}
                      className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <div className="flex-1">
                      <CardTitle>{event.name}</CardTitle>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={DATE_TYPE_TONE[event.dateType]}>{DATE_TYPE_LABEL[event.dateType]}</Badge>
                        <Badge tone={PRIORITY_TONE[event.priority]}>{event.priority} priority</Badge>
                        <Badge tone="neutral">{event.region}</Badge>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFavorite(event)}
                      aria-label={isFav ? `Remove ${event.name} from favorites` : `Favorite ${event.name}`}
                      title={isFav ? "Remove from favorites" : "Add to favorites"}
                      className={cn("rounded-lg p-1.5 transition-colors", isFav ? "text-amber-400" : "text-muted hover:text-foreground")}
                    >
                      <Star size={18} fill={isFav ? "currentColor" : "none"} />
                    </button>
                  </div>
                </CardHeader>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">{formatEventDate(event.date)}</p>
                    <p className="text-xs text-muted">{event.date}</p>
                    {event.dateNote && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-400">
                        <Info size={13} className="mt-0.5 shrink-0" /> {event.dateNote}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-muted">
                    <span className="font-medium text-foreground">Production window: </span>
                    {event.productionWindow}
                  </p>

                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Content suggestions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {event.contentSuggestions.map((s) => (
                        <span key={s} className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-foreground">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Keywords (click to copy)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {event.keywords.map((k) => (
                        <button
                          key={k}
                          onClick={() => copy(k, `${event.id}:${k}`)}
                          aria-label={`Copy keyword ${k}`}
                          title="Click to copy"
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-foreground hover:border-primary hover:text-primaryBright"
                        >
                          {copied === `${event.id}:${k}` ? <Check size={12} /> : <Copy size={12} />}
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Commercial uses</p>
                    <p className="text-xs text-muted">{event.commercialUses.join(" · ")}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => generatePrompt(event)}>
                      <Sparkles size={16} /> Generate prompt
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => toggleChecklistExpanded(event.id)} aria-expanded={checklistOpen}>
                      <ClipboardList size={16} /> Checklist ({checked.length}/{CHECKLIST_STEPS.length})
                      <ChevronDown size={14} className={cn("transition-transform", checklistOpen && "rotate-180")} />
                    </Button>
                  </div>

                  {checklistOpen && (
                    <div className="space-y-2 rounded-xl border border-border bg-secondary/50 p-3" aria-label={`Production checklist for ${event.name}`}>
                      {CHECKLIST_STEPS.map((step) => {
                        const done = checked.includes(step.id);
                        return (
                          <label key={step.id} className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => toggleChecklistStep(event.id, step.id)}
                              aria-label={`${event.name} checklist: ${step.label}`}
                              className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                            />
                            <span>
                              <span className={cn("block text-sm font-medium", done ? "text-muted line-through" : "text-foreground")}>
                                {step.label}
                              </span>
                              <span className="block text-xs text-muted">{step.hint}</span>
                            </span>
                          </label>
                        );
                      })}
                      <p className="pt-1 text-xs text-muted">Checklist is saved on this device automatically.</p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
