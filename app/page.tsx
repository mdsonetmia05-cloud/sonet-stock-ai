"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Sparkles,
  LayoutDashboard,
  ImagePlus,
  FileText,
  Wand2,
  Compass,
  ShieldAlert,
  ZoomIn,
  Eraser,
  CalendarDays,
  Package,
  Search,
  PencilLine,
  ClipboardCheck,
  ArrowRight,
  Check,
  Plus,
  Minus,
  Menu,
  X,
  Camera,
  Code2,
  Clapperboard,
  Megaphone,
} from "lucide-react";

const FEATURES = [
  { href: "/metadata-generator", icon: FileText, title: "AI Metadata Generator", desc: "Build titles, descriptions and keywords from on-device image analysis, adapted to each marketplace profile." },
  { href: "/image-to-prompt", icon: ImagePlus, title: "Image to Prompt", desc: "Turn a reference photo into a structured generation prompt from measured colors, lighting and composition." },
  { href: "/stock-analysis", icon: Compass, title: "Stock Market Research", desc: "Plan shoots and topics with structured research notes — clearly labeled sample context, never fabricated sales data." },
  { href: "/prompt-generator", icon: Wand2, title: "AI Prompt Generator", desc: "Assemble detailed, disclosure-ready prompts from subject, style, lighting and composition controls." },
  { href: "/rejection-predictor", icon: ShieldAlert, title: "Rejection Risk Analysis", desc: "Heuristic quality checks for exposure, sharpness, noise and common rejection reasons before you upload." },
  { href: "/image-upscaler", icon: ZoomIn, title: "Bulk Image Upscaler", desc: "Basic browser-based canvas resampling at 2x or 4x. Honestly labeled — not AI super-resolution." },
  { href: "/background-remover", icon: Eraser, title: "Background Remover", desc: "Flood-fill background removal with a real alpha channel and live transparency preview. Not AI matting." },
  { href: "/event-calendar", icon: CalendarDays, title: "Stock Event Calendar", desc: "Plan seasonal content around a curated 2026–2027 event calendar with production windows and keywords." },
  { href: "/batch-editor", icon: Package, title: "Bulk Export & Workflow", desc: "Queue bulk jobs, track progress, and export metadata, prompts and reports as CSV, text or ZIP." },
];

const STEPS = [
  { icon: Search, title: "Research an opportunity", desc: "Check the event calendar and plan a shoot or generation topic with structured research notes." },
  { icon: PencilLine, title: "Create and optimize assets", desc: "Generate prompts, prepare files, and write marketplace-ready metadata — all on-device in demo mode." },
  { icon: ClipboardCheck, title: "Review and prepare for submission", desc: "Run rejection-risk checks, export your files and metadata, then submit directly to each marketplace." },
];

const CREATORS = [
  { icon: Camera, title: "Stock Contributors", desc: "Generate platform-optimized prompts for Adobe Stock, Shutterstock & Freepik with correct style targeting." },
  { icon: Code2, title: "Developers", desc: "Create detailed coding prompts, debugging instructions and technical docs for ChatGPT, Claude and Copilot." },
  { icon: Clapperboard, title: "Video Creators", desc: "Script cinematic multi-scene prompts with character control, camera angles and mood direction for AI video." },
  { icon: Megaphone, title: "Marketers", desc: "Draft marketing emails, ad copy, SWOT analyses and campaign strategies with AI-optimized prompt structure." },
];

const PLATFORMS = ["Adobe Stock", "Shutterstock", "Freepik", "Vecteezy", "Dreamstime", "Depositphotos", "123RF"];

const FAQS = [
  {
    q: "What is demo mode?",
    a: "This build runs entirely in your browser with on-device heuristics and sample data. Nothing is uploaded to a server, no real AI model is called, and every tool result is labeled so you know exactly what produced it. A production build can add server-side AI providers — see Settings for provider status.",
  },
  {
    q: "Where is my data stored?",
    a: "Locally, in your browser's localStorage, namespaced per user. SONET STOCK AI never sends your images, prompts or metadata to our servers — because in this build there are no servers receiving them. You can wipe all data from Settings at any time.",
  },
  {
    q: "Is SONET STOCK AI affiliated with Adobe Stock, Shutterstock, or the other platforms?",
    a: "No. Adobe Stock, Shutterstock, Freepik, Vecteezy, Dreamstime, Depositphotos and 123RF are independent services. SONET STOCK AI is not affiliated with or endorsed by any of them. Marketplace names appear only as export profiles and compatibility labels.",
  },
  {
    q: "Do I need to disclose AI-generated content?",
    a: "Most major marketplaces require AI-generated or AI-assisted content to be disclosed and labeled at submission. This demo build helps you keep your prompts and workflow notes organized, but disclosure happens on each marketplace's own submission form — read their current contributor guidelines.",
  },
  {
    q: "Does SONET STOCK AI guarantee acceptance, downloads or income?",
    a: "Never. No tool in this workspace can promise acceptance, downloads, sales or income. Review decisions are made by each marketplace. The rejection-risk tool is a heuristic pre-check, not a prediction of marketplace outcomes.",
  },
  {
    q: "How much does it cost?",
    a: "This demo build is free and unlimited — everything runs on your device. If a paid production version with server-side AI is released, pricing will be published before any charge.",
  },
  {
    q: "Can I use the upscaler and background remover for final files?",
    a: "They are honest browser utilities, not AI tools: the upscaler does canvas resampling and the background remover uses flood-fill alpha. They're useful for quick drafts and workflow experiments — for production-quality enlargement or matting, use a dedicated AI service.",
  },
];

function PreviewMock() {
  const bars = [42, 68, 55, 80, 62, 90, 74, 58, 84, 66, 78, 52];
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
      {/* browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-secondary px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
        <span className="ml-3 hidden rounded-md bg-background px-3 py-1 text-[11px] text-muted sm:block">
          app.sonetstock.ai/dashboard
        </span>
      </div>
      <div className="grid grid-cols-[56px_1fr] sm:grid-cols-[180px_1fr]">
        {/* sidebar */}
        <div className="hidden flex-col gap-1 border-r border-border bg-secondary/60 p-3 sm:flex">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Sparkles size={14} className="text-primaryBright" />
            <span className="text-xs font-bold text-foreground">SONET STOCK AI</span>
          </div>
          {["Dashboard", "Metadata", "Prompts", "Research", "Calendar", "Batch jobs"].map((l, i) => (
            <div
              key={l}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] ${i === 0 ? "bg-primary/20 text-primaryBright" : "text-muted"}`}
            >
              {l}
            </div>
          ))}
        </div>
        {/* main */}
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Workspace overview</div>
              <div className="text-[11px] text-muted">Demo mode — on-device heuristics & sample data</div>
            </div>
            <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[10px] font-medium text-primaryBright">
              DEMO
            </span>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              ["Images processed", "128"],
              ["Metadata records", "46"],
              ["Prompts saved", "32"],
              ["Research notes", "12"],
            ].map(([label, val]) => (
              <div key={label} className="rounded-2xl border border-border bg-secondary/60 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
                <div className="mt-0.5 text-xl font-bold text-foreground">{val}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-secondary/60 p-3">
              <div className="mb-2 text-[11px] font-medium text-foreground">
                Weekly activity <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted">SAMPLE</span>
              </div>
              <div className="flex h-20 items-end gap-1.5">
                {bars.map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/60 p-3">
              <div className="mb-2 text-[11px] font-medium text-foreground">Recent jobs</div>
              {[
                ["Eid campaign metadata", "completed", "blue"],
                ["Portrait batch upscaling", "processing", "amber"],
                ["Winter keyword research", "completed", "blue"],
              ].map(([t, s, tone]) => (
                <div key={t} className="mb-1.5 flex items-center justify-between rounded-lg bg-background px-2.5 py-1.5">
                  <span className="text-[11px] text-foreground">{t}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] ${tone === "blue" ? "bg-primary/15 text-primaryBright" : "bg-amber-500/15 text-amber-400"}`}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="border-t border-border bg-secondary/40 px-4 py-2 text-center text-[10px] text-muted">
        Illustrative preview — your real workspace starts empty. No marketplace data shown.
      </p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-foreground">{q}</span>
        <span className="shrink-0 rounded-full bg-secondary p-1 text-muted">
          {open ? <Minus size={14} /> : <Plus size={14} />}
        </span>
      </button>
      {open && <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{a}</p>}
    </div>
  );
}

function BlueCard({
  icon: Icon,
  title,
  desc,
  href,
  step,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  desc: string;
  href?: string;
  step?: string;
}) {
  const inner = (
    <>
      {step && (
        <span className="mb-5 block text-sm font-bold tracking-widest text-white/60">0{step}</span>
      )}
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
        <Icon size={22} className="text-white" />
      </span>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/80">{desc}</p>
      {href && (
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
          Open tool <ArrowRight size={15} />
        </span>
      )}
    </>
  );
  const cls =
    "rounded-3xl bg-gradient-to-br from-[#1d4ed8] to-[#2563eb] p-7 text-left transition-transform hover:-translate-y-0.5";
  return href ? (
    <Link href={href} className={`group block ${cls}`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* top nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-[#0a0a0f]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <Sparkles size={18} />
            </span>
            <span className="text-sm font-extrabold tracking-tight">
              SONET <span className="text-primaryBright">STOCK AI</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#tools" className="transition-colors hover:text-foreground">AI Tools</a>
            <a href="#workflow" className="transition-colors hover:text-foreground">Workflow</a>
            <a href="#platforms" className="transition-colors hover:text-foreground">Platforms</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-all hover:brightness-110">
              <LayoutDashboard size={16} /> Open Workspace
            </Link>
          </div>
          <button className="rounded-lg p-2 text-muted md:hidden" aria-label="Toggle menu" onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="border-t border-border px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1 text-sm">
              {[
                ["#tools", "AI Tools"],
                ["#workflow", "Workflow"],
                ["#platforms", "Platforms"],
                ["#faq", "FAQ"],
              ].map(([href, label]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-muted hover:bg-secondary hover:text-foreground">
                  {label}
                </a>
              ))}
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white">
                <LayoutDashboard size={16} /> Open Workspace
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primaryBright">
            <Sparkles size={13} /> On-device demo workspace for stock contributors
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Ideas Become Income.<br />
            Create Smarter with AI.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
            Research stock trends, generate commercial-ready prompts, optimize metadata, and manage your creative workflow from one workspace.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/dashboard" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-7 text-base font-semibold text-white transition-all hover:brightness-110">
              <LayoutDashboard size={18} /> Open Workspace <ArrowRight size={18} />
            </Link>
            <a href="#tools" className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-secondary px-7 text-base font-medium text-foreground transition-all hover:bg-card">
              <Wand2 size={18} /> Explore AI Tools
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
            {["100% on-device demo", "No account or API key needed", "Export anytime"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><Check size={13} className="text-primaryBright" />{t}</span>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-14 max-w-4xl">
          <PreviewMock />
        </div>
      </section>

      {/* features */}
      <section id="tools" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Nine tools, one workflow</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted">
              Every tool runs on-device in this demo build and saves its results to your local workspace.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <BlueCard key={f.href} href={f.href} icon={f.icon} title={f.title} desc={f.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* workflow — 3 steps */}
      <section id="workflow" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Generate AI Prompts in 3 Easy Steps</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted">
              From idea to submission in three steps.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <BlueCard key={s.title} step={String(i + 1)} icon={s.icon} title={s.title} desc={s.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* built for every creator */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Built for Every Creator</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CREATORS.map((c) => (
              <BlueCard key={c.title} icon={c.icon} title={c.title} desc={c.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* platforms */}
      <section id="platforms" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <h2 className="text-xl font-bold md:text-2xl">Prepare files for the marketplaces you sell on</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted">
              Metadata profiles adapt titles and keyword limits to each platform&apos;s conventions.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {PLATFORMS.map((p) => (
                <span key={p} className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Frequently asked questions</h2>
          </div>
          <div className="flex flex-col gap-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-border bg-[#0a0a0f]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <Sparkles size={15} />
              </span>
              <span className="text-sm font-extrabold">SONET <span className="text-primaryBright">STOCK AI</span></span>
            </div>
            <div className="flex gap-5 text-sm text-muted">
              <Link href="/dashboard" className="hover:text-foreground">Workspace</Link>
              <Link href="/help" className="hover:text-foreground">Help</Link>
              <Link href="/settings" className="hover:text-foreground">Settings</Link>
            </div>
          </div>
          <p className="mt-6 border-t border-border pt-6 text-center text-xs leading-relaxed text-muted">
            Adobe Stock, Shutterstock, Freepik, Vecteezy, Dreamstime, Depositphotos and 123RF are independent services.
            SONET STOCK AI is not affiliated with or endorsed by them.
          </p>
        </div>
      </footer>
    </div>
  );
}
