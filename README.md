# SONET STOCK AI

**Research Smarter. Create Faster. Earn Strategically.**

An all-in-one workspace for stock contributors, digital artists, and AI-powered creators — research ideas, generate prompts, create metadata, process images in bulk, analyze submission risk, and prepare files for Adobe Stock, Shutterstock, Freepik, Vecteezy, Dreamstime, Depositphotos, 123RF and more.

Everything runs on-device in your browser. No account, no API key, no signup — open it and start working. Your data never leaves your device.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

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
| `/stock-analysis` | Portfolio CSV analyzer — real breakdowns of your own data |
| `/rejection-predictor` | Measured QC checks (sharpness/exposure/noise) + risk labels |
| `/background-remover` | Flood-fill background removal → genuine transparent PNG |
| `/image-upscaler` | 2x/4x canvas upscaling with denoise/sharpen |
| `/event-calendar` | 2026–2027 contributor calendar (verified/computed/approximate dates) |
| `/history` | Jobs, exports, QC reports — search/filter/export/delete |
| `/settings` | Theme, marketplace + metadata defaults, AI providers, data deletion |
| `/help` | Docs, FAQ, marketplace compliance notes |

## How it works (please read)

- **On-device first.** Image analysis, QC checks, background removal, upscaling and file processing are real algorithms running in your browser. Prompt and metadata text is assembled from templates and measured image attributes — no API key needed.
- **No fabricated metrics.** Download counts, rankings, sales, and revenue are never invented. The Portfolio Analysis page only reports numbers computed from the CSV you upload.
- **Upscaler** is canvas resampling — labeled "Basic browser upscaling (not AI)" on every result. **Background remover** is flood-fill → real alpha-channel PNG — labeled "Basic background removal (not AI)".
- **No guarantees.** Nothing promises marketplace acceptance, downloads, or income. The rejection-risk tool is a heuristic pre-check; agencies make the final decision.
- **Your data stays local.** All jobs, prompts, and metadata live in your browser's localStorage. Delete anytime in Settings.
- **Optional server AI.** Set `GEMINI_API_KEY`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` as server environment variables to enable server-side providers; `/api/ai` reports their status (never the keys).

## Going further

1. Copy `.env.example` to `.env.local` and add provider keys (server-side only — see `PLAN.md`).
2. Implement real provider calls in `app/api/ai/route.ts` (Gemini/OpenAI/Anthropic).
3. Replace `lib/db.ts` with Supabase (schema in `PLAN.md`) + Row Level Security.
4. Move uploads to private object storage; add a background queue for large batches.
5. Connect authorized research data sources.

## Tech

Next.js 14 · React 18 · TypeScript · Tailwind CSS · lucide-react · jszip

## Design system

Dark-first visual system: deep green-black page background (`#101310`), dark surfaces (`#181D19`), cards (`#1C231E`) with subtle borders (`#303A32`). Primary accent is green (`#159447`, bright `#25C96A`, deep `#0E6E34`) — solid-green feature/step cards with white text. Red (`#E63946`) is reserved for destructive actions and warnings only. Body text `#F4F7F4`, muted `#A7B2A9`. Rounded-2xl/3xl cards, Inter typeface, green focus rings. A light theme is available via the theme toggle; dark is the default.

## Disclaimer

Adobe Stock, Shutterstock, Freepik, Vecteezy, Dreamstime, Depositphotos, and 123RF are independent services. SONET STOCK AI is not affiliated with or endorsed by them.
