/**
 * lib/db.ts — client-side data layer (demo build).
 *
 * All user data is stored in localStorage under a per-user namespace:
 *   ssa:v1:<userId>:<collection>
 * No data leaves the browser. In production this maps to Postgres tables
 * documented in PLAN.md (same entity names).
 */
import { uid } from "./utils";

export type JobStatus =
  | "queued"
  | "processing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type JobType =
  | "image-to-prompt"
  | "metadata"
  | "prompt"
  | "batch"
  | "bg-remove"
  | "upscale"
  | "qc"
  | "research";

export interface Job {
  id: string;
  type: JobType;
  title: string;
  status: JobStatus;
  total: number;
  done: number;
  failed: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptRecord {
  id: string;
  text: string;
  negative?: string;
  category: string;
  mode?: string;
  favorite: boolean;
  source: string; // e.g. "prompt-generator", "image-to-prompt", "event-calendar"
  createdAt: string;
}

export interface MetadataRecord {
  id: string;
  jobId?: string;
  filename: string;
  title: string;
  description: string;
  keywords: string[];
  category: string;
  style?: string;
  commercialConcept?: string;
  platform: string;
  createdAt: string;
}

export interface ResearchProject {
  id: string;
  query: string;
  platform: string;
  assetType: string;
  category: string;
  resultCount: number;
  createdAt: string;
}

export interface FavoriteItem {
  id: string;
  kind: "prompt" | "event" | "topic" | "result";
  refId: string;
  label: string;
  createdAt: string;
}

export interface ExportRecord {
  id: string;
  kind: "csv" | "txt" | "zip" | "report";
  filename: string;
  detail: string;
  sizeBytes?: number;
  createdAt: string;
}

export interface QcFinding {
  category: string;
  level: "pass" | "warn" | "fail";
  detail: string;
  suggestion: string;
}

export interface QcReport {
  id: string;
  filename: string;
  risk: "low" | "review" | "high";
  score: number; // 0-100, higher = safer
  findings: QcFinding[];
  outcome: "accepted" | "rejected" | null; // actual marketplace outcome, user-logged
  createdAt: string;
}

export interface UsageRecord {
  date: string; // YYYY-MM-DD
  imagesProcessed: number;
  metadataGenerated: number;
  promptsCreated: number;
  bytesExported: number;
}

export interface UserPreferences {
  theme: "dark" | "light";
  defaultMarketplace: string;
  minTitleWords: number;
  maxTitleWords: number;
  minKeywords: number;
  maxKeywords: number;
  descriptionWords: number;
  singleWordKeywords: boolean;
  prohibitedWords: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  defaultMarketplace: "adobe-stock",
  minTitleWords: 7,
  maxTitleWords: 15,
  minKeywords: 25,
  maxKeywords: 35,
  descriptionWords: 20,
  singleWordKeywords: true,
  prohibitedWords: "",
};

const PREFIX = "ssa:v1";

function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function collKey(userId: string, coll: string): string {
  return `${PREFIX}:${userId}:${coll}`;
}

function readAll<T>(userId: string, coll: string): T[] {
  if (!storageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(collKey(userId, coll));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeAll<T>(userId: string, coll: string, items: T[]): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(collKey(userId, coll), JSON.stringify(items));
  } catch {
    // quota exceeded — keep app usable, surface via console only
    console.warn(`[db] could not persist ${coll} (storage quota?)`);
  }
}

export interface Repository<T extends { id: string }> {
  all(): T[];
  get(id: string): T | undefined;
  upsert(item: T): T;
  remove(id: string): void;
  clear(): void;
  count(): number;
}

function makeRepo<T extends { id: string }>(userId: string, coll: string): Repository<T> {
  return {
    all: () => readAll<T>(userId, coll).sort((a: any, b: any) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
    ),
    get: (id) => readAll<T>(userId, coll).find((x) => x.id === id),
    upsert: (item) => {
      const items = readAll<T>(userId, coll);
      const i = items.findIndex((x) => x.id === item.id);
      const next = i >= 0 ? item : { ...item, id: item.id || uid() };
      if (i >= 0) items[i] = next;
      else items.push(next);
      writeAll(userId, coll, items);
      return next;
    },
    remove: (id) => writeAll(userId, coll, readAll<T>(userId, coll).filter((x) => x.id !== id)),
    clear: () => writeAll(userId, coll, []),
    count: () => readAll<T>(userId, coll).length,
  };
}

/** Typed database facade for one user. */
export function dbFor(userId: string) {
  return {
    jobs: makeRepo<Job>(userId, "jobs"),
    prompts: makeRepo<PromptRecord>(userId, "prompts"),
    metadata: makeRepo<MetadataRecord>(userId, "metadata"),
    research: makeRepo<ResearchProject>(userId, "research"),
    favorites: makeRepo<FavoriteItem>(userId, "favorites"),
    exports: makeRepo<ExportRecord>(userId, "exports"),
    qcReports: makeRepo<QcReport>(userId, "qc"),
    usage: makeRepo<UsageRecord & { id: string }>(userId, "usage"),
    preferences: {
      get(): UserPreferences {
        if (!storageAvailable()) return { ...DEFAULT_PREFERENCES };
        try {
          const raw = window.localStorage.getItem(collKey(userId, "preferences"));
          return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : { ...DEFAULT_PREFERENCES };
        } catch {
          return { ...DEFAULT_PREFERENCES };
        }
      },
      save(p: UserPreferences): void {
        if (!storageAvailable()) return;
        window.localStorage.setItem(collKey(userId, "preferences"), JSON.stringify(p));
      },
    },
    /** Delete ALL data for this user (account deletion / data wipe). */
    wipe(): void {
      if (!storageAvailable()) return;
      const prefix = `${PREFIX}:${userId}:`;
      const doomed: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) doomed.push(k);
      }
      doomed.forEach((k) => window.localStorage.removeItem(k));
    },
  };
}

export type DB = ReturnType<typeof dbFor>;

/** Bump a daily usage counter. */
export function bumpUsage(db: DB, patch: Partial<Omit<UsageRecord, "date">>): void {
  const date = new Date().toISOString().slice(0, 10);
  const existing = db.usage.get(date) as (UsageRecord & { id: string }) | undefined;
  const base: UsageRecord & { id: string } = existing ?? {
    id: date,
    date,
    imagesProcessed: 0,
    metadataGenerated: 0,
    promptsCreated: 0,
    bytesExported: 0,
  };
  db.usage.upsert({
    ...base,
    imagesProcessed: base.imagesProcessed + (patch.imagesProcessed ?? 0),
    metadataGenerated: base.metadataGenerated + (patch.metadataGenerated ?? 0),
    promptsCreated: base.promptsCreated + (patch.promptsCreated ?? 0),
    bytesExported: base.bytesExported + (patch.bytesExported ?? 0),
  });
}
