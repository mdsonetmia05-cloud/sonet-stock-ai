# SONET STOCK AI — Build Contract (read before writing any route)

This file is the single source of truth for parallel builders. Follow it exactly so independently-written routes integrate cleanly.

## 0. Project location
`~/workspace/sonet-stock-ai`. Next.js 14 (App Router), React 18, TypeScript (strict), Tailwind 3, lucide-react, jszip. No shadcn — use `components/ui/*`.

## 1. Absolute honesty rules (violating these fails the project)
1. NEVER fabricate marketplace download counts, rankings, sales, contributor identities, or revenue. Unavailable data renders as **"n/a — not exposed"**. Sample data is badged **SAMPLE**.
2. Every tool page (`/image-to-prompt`, `/metadata-generator`, `/batch-editor`, `/prompt-generator`, `/stock-analysis`, `/rejection-predictor`, `/background-remover`, `/image-upscaler`, `/event-calendar`, `/dashboard`) must render `<PageHeader demo />` (it includes the DemoBadge: "Demo mode — on-device heuristics & sample data").
3. Upscaler output is canvas resampling — label every result **"Basic browser upscaling (not AI)"**.
4. Background remover uses `removeBackgroundFloodFill` (genuine alpha channel). Label **"Basic background removal (not AI)"**. Preview transparency on the `.checkerboard` CSS class — never ship a fake checkerboard image as the export.
5. Never claim EXIF/IPTC metadata was embedded. Offer CSV export + copy; note embedding as "not performed in demo build".
6. No copy may promise acceptance, downloads, sales, or income anywhere.
7. No API keys anywhere in frontend code, storage, or network calls. Provider abstraction lives in `lib/providers.ts` (DemoProvider only). `/api/ai` is a status stub.
8. Every button must work. No decorative dead controls. Every tool needs real loading / success / empty / error states.

## 2. Routes (all under `app/(app)/<route>/page.tsx`, each a client component)
| route | file |
|---|---|
| /dashboard | app/(app)/dashboard/page.tsx |
| /image-to-prompt | app/(app)/image-to-prompt/page.tsx |
| /metadata-generator | app/(app)/metadata-generator/page.tsx |
| /batch-editor | app/(app)/batch-editor/page.tsx |
| /prompt-generator | app/(app)/prompt-generator/page.tsx |
| /stock-analysis | app/(app)/stock-analysis/page.tsx |
| /rejection-predictor | app/(app)/rejection-predictor/page.tsx |
| /background-remover | app/(app)/background-remover/page.tsx |
| /image-upscaler | app/(app)/image-upscaler/page.tsx |
| /event-calendar | app/(app)/event-calendar/page.tsx |
| /settings | app/(app)/settings/page.tsx |
| /history | app/(app)/history/page.tsx |
| /help | app/(app)/help/page.tsx |
| / (public) | app/page.tsx |

## 3. Importable building blocks
- UI: `@/components/ui/button` (Button), `card` (Card, CardHeader, CardTitle, StatCard), `input` (Input, Textarea, Label), `select` (Select), `badge` (Badge tone: green|red|neutral|amber|blue), `progress` (Progress value 0-100), `dialog` (Dialog, ConfirmDialog), `tabs` (Tabs), `skeleton` (Skeleton, SkeletonCard), `empty-state` (EmptyState), `file-dropzone` (FileDropzone props: accept, multiple, maxFiles, onFiles, label, hint, compact), `demo-badge` (DemoBadge), `page-header` (PageHeader {title, description, actions, demo}).
- Auth/theme: `@/components/providers` → `useAuth()` {user:{id,name,email}, signIn, signOut}, `useTheme()` {theme, toggle, setTheme}.
- DB: `@/lib/db` → `dbFor(userId)` returns `{ jobs, prompts, metadata, research, favorites, exports, qcReports, usage, preferences, wipe() }`. Each repo: `all() get(id) upsert(item) remove(id) clear() count()`. Types: Job {id,type,title,status,total,done,failed,note?,createdAt,updatedAt}, PromptRecord {id,text,negative?,category,mode?,favorite,source,createdAt}, MetadataRecord {id,jobId?,filename,title,description,keywords[],category,style?,commercialConcept?,platform,createdAt}, ResearchProject {id,query,platform,assetType,category,resultCount,createdAt}, FavoriteItem {id,kind:"prompt"|"event"|"topic"|"result",refId,label,createdAt}, ExportRecord {id,kind:"csv"|"txt"|"zip"|"report",filename,detail,sizeBytes?,createdAt}, QcReport {id,filename,risk:"low"|"review"|"high",score,findings:QcFinding[],outcome:"accepted"|"rejected"|null,createdAt}, QcFinding {category,level:"pass"|"warn"|"fail",detail,suggestion}. Helpers: `bumpUsage(db, {imagesProcessed?, metadataGenerated?, promptsCreated?, bytesExported?})`, `DEFAULT_PREFERENCES`.
- CSV: `@/lib/csv` → `downloadCsv(filename, columns, rows)`, `downloadTextFile(filename, text, mime?)`, `downloadBlob(blob, filename)`, `toCsv`, `escapeCsvField`.
- ZIP: `@/lib/zip` → `downloadZip(filename, [{name, blob}])`.
- Image: `@/lib/image` → `loadImageFromFile(file)`, `analyzeImage(img)` → ImageAnalysis {width,height,orientation,brightness,contrast,saturation,warmth,edgeDensity,dominantColors[{hex,pct}],isMostlyDark,isMostlyBright}, `sharpnessScore(img)` 0-100, `exposureReport(img)` {shadowClipPct,highlightClipPct,verdict}, `noiseEstimate(img)` 0-100, `removeBackgroundFloodFill(img, tolerance 0-100, maxDim?)` → {canvas,removedPct,width,height}, `upscaleCanvas(img, 2|4, {denoise,sharpen})`, `canvasToBlob(canvas, type, quality?)`, `describeAnalysis(a)` string[], `nearestColorName(hex)`, `drawToCanvas(img, maxDim)`.
- Providers: `@/lib/providers` → `getActiveProvider()` (always demo in this build), `fetchServerProviderStatus()`.
- Events: `@/lib/events` → `getEventsForYear(year)`, `filterEvents(events, {country,category,query,favoritesOnly,favoriteIds})`, `EVENT_CATEGORIES`, `COUNTRIES`, `DATE_TYPE_LABEL`, StockEvent {id,name,date,dateType:"verified"|"computed"|"approximate",dateNote?,region,categories[],productionWindow,contentSuggestions[],keywords[],commercialUses[],priority}.
- Utils: `@/lib/utils` → `cn, uid, nowIso, formatDate, formatDateTime, formatBytes, truncate`.

## 4. Conventions
- `"use client"` at top of every page. Guard `window`/`document` usage (components render client-side only anyway).
- Brand tokens via Tailwind: `bg-background bg-secondary bg-card text-foreground text-muted border-border bg-primary text-primaryBright bg-danger`. Rounded `rounded-2xl`, borders `border-border`.
- Page structure: `<PageHeader title="…" description="…" actions={…} />` then content. DemoBadge included automatically.
- Persist user work: create Job records for bulk operations; save prompts to `db.prompts`; metadata to `db.metadata`; QC to `db.qcReports`; research to `db.research`; every download to `db.exports`; call `bumpUsage` appropriately.
- Favorites: prompt-generator + event-calendar + stock-analysis write to `db.favorites` (kind: prompt|event|topic).
- Long loops: process files sequentially with `await` + small yields (`await new Promise(r=>setTimeout(r,0))`) so the UI stays responsive; show Progress.
- Accessible labels on all form controls. Keyboard-operable dialogs (Escape closes — already handled).
- Copy-to-clipboard: `navigator.clipboard.writeText` with try/catch fallback + "Copied" feedback.
- NEVER invent marketplace metrics. The stock-analysis page uses a clearly-labeled SAMPLE dataset only.
- File validation: check `file.type` and extension; show per-file errors; never process a file you cannot decode.

## 5. Marketplace profiles (metadata-generator)
Adobe Stock, Shutterstock, Freepik, Vecteezy, Dreamstime, Depositphotos, 123RF, Generic CSV. Each profile: {id, label, maxTitleWords, maxKeywords, keywordStyle: "single"|"phrases", notes}. Adapt generated metadata to the profile (word counts, keyword count caps, single-word splitting). CSV columns: Filename, Title, Description, Keywords (semicolon-joined), Category.

## 6. What NOT to do
- Do not edit files outside your assigned route(s) and (if needed) small additions to `lib/` with a NEW filename (never modify existing lib APIs).
- Do not run `npm install` or `npm run build` (the coordinator runs builds). You MAY run `npx tsc --noEmit` in the repo to self-check, but do not leave lockfiles modified.
- Do not add new npm dependencies.
- Do not copy PixcraftAI branding. Original "SONET STOCK AI" identity only.
