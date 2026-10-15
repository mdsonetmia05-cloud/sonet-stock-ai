# SONET STOCK AI — Implementation Plan

**Status:** Demo build complete. All 14 routes render, `npm run build` passes.

## 1. What was built (per phase)

| Phase | Scope | Status |
|---|---|---|
| 0 | Scaffold (Next.js 14 + TS + Tailwind), design tokens, CSS-variable theming, app shell (sidebar/topbar/breadcrumbs/mobile drawer), demo auth, UI component library, lib (db/csv/image/zip/providers/events), `/api/ai` stub, CONTRACT.md | ✅ |
| 1 | Homepage, dashboard, settings, history, help | ✅ |
| 2 | Image-to-Prompt, Prompt Generator, Metadata Generator (core, `lib/metadata.ts`) | ✅ |
| 3 | Batch Editor (bounded concurrency 3, pause/cancel/retry/resume, ZIP + manifest CSV) | ✅ |
| 4 | Stock Analysis (sample dataset), Rejection Predictor (real measurements), Event Calendar (computed dates) | ✅ |
| 5 | Background Remover (real flood-fill alpha), Image Upscaler (honest canvas resampling) | ✅ |
| 6 | Build verification, smoke test, docs | ✅ |

## 2. Architecture

- **Frontend:** Next.js 14 App Router. Public `/` landing; protected `app/(app)/*` routes behind `AppShell` (local demo sign-in screen when logged out).
- **State/data:** `lib/db.ts` — typed localStorage repositories namespaced `ssa:v1:<userId>:<collection>`. No server DB in this build.
- **Image engine:** `lib/image.ts` — canvas-based measurement (histogram, quantization, Sobel edges, Laplacian sharpness, clipping, noise) + flood-fill background removal (genuine alpha) + honest canvas upscaling.
- **Providers:** `lib/providers.ts` — `AIProvider` interface; `DemoProvider` (on-device heuristics) is the only active provider. `/api/ai` reports key presence (never keys) and 501s on POST until wired.
- **Honesty layer:** `DemoBadge` on every tool page; sample data badged SAMPLE; unavailable marketplace metrics render "n/a — not exposed"; upscaler/bg-remover carry "not AI" labels; no acceptance/download/income promises in copy.

## 3. Data model (intended Postgres schema for production)

Same entity names as `lib/db.ts`. Every user-owned table has `user_id` FK + RLS policy `auth.uid() = user_id`.

```sql
users(id uuid pk, email text unique, name text, created_at timestamptz)
preferences(user_id uuid pk fk, theme text, default_marketplace text,
  min_title_words int, max_title_words int, min_keywords int, max_keywords int,
  description_words int, single_word_keywords bool, prohibited_words text)
jobs(id uuid pk, user_id uuid fk, type text, title text, status text,
  total int, done int, failed int, note text, created_at timestamptz, updated_at timestamptz)
assets(id uuid pk, user_id uuid fk, job_id uuid fk, filename text, mime text,
  bytes int, width int, height int, storage_path text, created_at timestamptz)
metadata_records(id uuid pk, user_id uuid fk, job_id uuid fk, filename text,
  title text, description text, keywords text[], category text, style text,
  commercial_concept text, platform text, created_at timestamptz)
prompts(id uuid pk, user_id uuid fk, text text, negative text, category text,
  mode text, favorite bool, source text, created_at timestamptz)
research_projects(id uuid pk, user_id uuid fk, query text, platform text,
  asset_type text, category text, result_count int, created_at timestamptz)
research_results(id uuid pk, project_id uuid fk, title text, platform text,
  asset_type text, category text, keywords text[], note text, sample bool)
calendar_events(id text pk, name text, date date, date_type text, region text,
  categories text[], production_window text, suggestions text[], keywords text[],
  commercial_uses text[], priority text)  -- curated, global (not per-user)
favorites(id uuid pk, user_id uuid fk, kind text, ref_id text, label text, created_at timestamptz)
exports(id uuid pk, user_id uuid fk, kind text, filename text, detail text,
  size_bytes bigint, created_at timestamptz)
usage_records(user_id uuid, date date, images_processed int, metadata_generated int,
  prompts_created int, bytes_exported bigint, pk(user_id, date))
qc_reports(id uuid pk, user_id uuid fk, filename text, risk text, score int,
  findings jsonb, outcome text, created_at timestamptz)
```

Indexes: `jobs(user_id, created_at desc)`, `metadata_records(user_id, job_id)`, `prompts(user_id, favorite)`, `qc_reports(user_id)`.

## 4. Environment variables (production)

| Var | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-side Gemini vision/text (never exposed to client) |
| `OPENAI_API_KEY` | Server-side OpenAI vision/text |
| `ANTHROPIC_API_KEY` | Server-side Anthropic text |
| `NEXT_PUBLIC_APP_URL` | Canonical URL |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Auth + Postgres (service key server-only) |
| `STORAGE_BUCKET` | Private object storage for uploads |

No secrets are committed. `.env.example` documents the vars (values empty).

## 5. Demo vs production notes

- **Demo:** all "AI" is on-device heuristics; research data is an illustrative sample; auth is local; files never leave the browser; EXIF/IPTC embedding not performed.
- **Production path:** implement real provider calls in `/api/ai` (server-only, keys from env), replace `dbFor` with Supabase + RLS, move uploads to private storage, add a background queue (e.g. BullMQ) for large batches, wire licensed/authorized research data sources, add rate limiting + audit logging.

## 6. Known limitations

- Background removal is flood-fill from edges: best on solid/near-solid backgrounds; complex scenes need manual masking.
- Upscaling is bicubic canvas resampling + optional denoise/sharpen — no detail synthesis.
- Event dates for lunar/lunisolar observances (Eid, Diwali, Holi, Chinese New Year) are approximate — users must confirm locally.
- Research "downloads" are never shown (marketplaces don't expose them); the dataset is illustrative.
- Client-side processing caps: upscaler caps long side at 8000px; very large batches should move to a server queue in production.
