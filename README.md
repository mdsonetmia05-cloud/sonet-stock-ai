# SONET STOCK AI

**Research Smarter. Create Faster. Earn Strategically.**

An all-in-one AI workspace for stock contributors, digital artists, and AI-powered creators — research ideas, generate prompts, create metadata, process images in bulk, analyze submission risk, and prepare files for Adobe Stock, Shutterstock, Freepik, Vecteezy, Dreamstime, Depositphotos, 123RF and more.

> **Demo build.** Every AI-ish feature runs on real on-device heuristics and clearly-labeled sample data. No real AI provider or marketplace data is connected. See "Demo honesty" below.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Sign in on the demo screen (name + email — stored in your browser only), then explore the workspace.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (must pass before shipping) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

## Routes

| Route | Tool |
|---|---|
| `/` | Landing page |
| `/dashboard` | Stats, jobs, downloads, favorites, events |
| `/image-to-prompt` | Real on-device image analysis → detailed prompts (10 modes) |
| `/metadata-generator` | Bulk SEO metadata, 8 marketplace profiles, CSV export |
| `/batch-editor` | Queued batch processing (3 workers), rename, ZIP export |
| `/prompt-generator` | 13-category prompt engineering workspace |
| `/stock-analysis` | Research UI over a labeled sample dataset |
| `/rejection-predictor` | Measured QC checks (sharpness/exposure/noise) + risk labels |
| `/background-remover` | Flood-fill background removal → genuine transparent PNG |
| `/image-upscaler` | 2x/4x canvas upscaling with denoise/sharpen |
| `/event-calendar` | 2026–2027 contributor calendar (verified/computed/approximate dates) |
| `/history` | Jobs, exports, QC reports — search/filter/export/delete |
| `/settings` | Profile, theme, marketplace + metadata defaults, data deletion |
| `/help` | Docs, FAQ, marketplace compliance notes |

## Demo honesty (please read)

- **No fabricated metrics.** Marketplace download counts, rankings, sales, and revenue are never invented. Unavailable data shows "n/a — not exposed"; sample data is badged SAMPLE.
- **No fake AI.** Image analysis, QC checks, and background removal are real algorithms running in your browser; prompt/metadata text is template-assembled from those measurements. Everything carries a "Demo mode" badge.
- **Upscaler** is high-quality canvas resampling — labeled "Basic browser upscaling (not AI)" on every result. **Background remover** is flood-fill → real alpha-channel PNG — labeled "Basic background removal (not AI)".
- **No guarantees.** Nothing promises marketplace acceptance, downloads, or income.
- **Your data stays local.** All jobs, prompts, and metadata live in your browser's localStorage. Delete anytime in Settings.

## Going to production

1. Copy `.env.example` to `.env.local` and add provider keys (server-side only — see `PLAN.md`).
2. Implement real provider calls in `app/api/ai/route.ts` (Gemini/OpenAI/Anthropic).
3. Replace `lib/db.ts` with Supabase (schema in `PLAN.md`) + Row Level Security.
4. Move uploads to private object storage; add a background queue for large batches.
5. Connect authorized research data sources; keep the "measured vs hypothesis" separation.

## Tech

Next.js 14 · React 18 · TypeScript · Tailwind CSS · lucide-react · jszip

## Disclaimer

Adobe Stock, Shutterstock, Freepik, Vecteezy, Dreamstime, Depositphotos, and 123RF are independent services. SONET STOCK AI is not affiliated with or endorsed by them.
