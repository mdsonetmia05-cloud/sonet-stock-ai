"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Anton, Caveat } from "next/font/google";
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
  Plus,
  Minus,
  Menu,
  X,
  Camera,
  Code2,
  Clapperboard,
  Megaphone,
} from "lucide-react";

const anton = Anton({ subsets: ["latin"], weight: "400", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], weight: ["700"], display: "swap" });

const FEATURES = [
  { href: "/metadata-generator", icon: FileText, title: "AI Metadata Generator", desc: "Build titles, descriptions and keywords from on-device image analysis, adapted to each marketplace profile." },
  { href: "/image-to-prompt", icon: ImagePlus, title: "Image to Prompt", desc: "Turn a reference photo into a structured generation prompt from measured colors, lighting and composition." },
  { href: "/stock-analysis", icon: Compass, title: "Stock Market Research", desc: "Analyze your own portfolio CSV — real breakdowns by platform, category and keyword. Nothing estimated." },
  { href: "/prompt-generator", icon: Wand2, title: "AI Prompt Generator", desc: "Assemble detailed, disclosure-ready prompts from subject, style, lighting and composition controls." },
  { href: "/rejection-predictor", icon: ShieldAlert, title: "Rejection Risk Analysis", desc: "Heuristic quality checks for exposure, sharpness, noise and common rejection reasons before you upload." },
  { href: "/image-upscaler", icon: ZoomIn, title: "Bulk Image Upscaler", desc: "Basic browser-based canvas resampling at 2x or 4x. Honestly labeled — not AI super-resolution." },
  { href: "/background-remover", icon: Eraser, title: "Background Remover", desc: "Flood-fill background removal with a real alpha channel and live transparency preview. Not AI matting." },
  { href: "/event-calendar", icon: CalendarDays, title: "Stock Event Calendar", desc: "Plan seasonal content around a curated 2026–2027 event calendar with production windows and keywords." },
  { href: "/batch-editor", icon: Package, title: "Bulk Export & Workflow", desc: "Queue bulk jobs, track progress, and export metadata, prompts and reports as CSV, text or ZIP." },
];

const STEPS = [
  { icon: Search, title: "Research an opportunity", desc: "Check the event calendar and plan a shoot or generation topic with structured research notes." },
  { icon: PencilLine, title: "Create and optimize assets", desc: "Generate prompts, prepare files, and write marketplace-ready metadata — all on-device." },
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
    q: "How does it work?",
    a: "Everything runs in your browser: image analysis, metadata assembly, prompt tools and file processing all happen on-device. Nothing is uploaded to a server. Optional server-side AI providers (Gemini, OpenAI, Anthropic) can be enabled with an API key — see Settings for provider status.",
  },
  {
    q: "Where is my data stored?",
    a: "Locally, in your browser's localStorage. SONET STOCK AI never sends your images, prompts or metadata to any server. You can wipe all data from Settings at any time.",
  },
  {
    q: "Is SONET STOCK AI affiliated with Adobe Stock, Shutterstock, or the other platforms?",
    a: "No. Adobe Stock, Shutterstock, Freepik, Vecteezy, Dreamstime, Depositphotos and 123RF are independent services. SONET STOCK AI is not affiliated with or endorsed by any of them. Marketplace names appear only as export profiles and compatibility labels.",
  },
  {
    q: "Do I need to disclose AI-generated content?",
    a: "Most major marketplaces require AI-generated or AI-assisted content to be disclosed and labeled at submission. SONET STOCK AI helps you keep your prompts and workflow notes organized, but disclosure happens on each marketplace's own submission form — read their current contributor guidelines.",
  },
  {
    q: "Does SONET STOCK AI guarantee acceptance, downloads or income?",
    a: "Never. No tool in this workspace can promise acceptance, downloads, sales or income. Review decisions are made by each marketplace. The rejection-risk tool is a heuristic pre-check, not a prediction of marketplace outcomes.",
  },
  {
    q: "How much does it cost?",
    a: "SONET STOCK AI is free and unlimited — everything runs on your device. If a version with paid server-side AI features is ever released, pricing will be published before any charge.",
  },
  {
    q: "Can I use the upscaler and background remover for final files?",
    a: "They are honest browser utilities, not AI tools: the upscaler does canvas resampling and the background remover uses flood-fill alpha. They're useful for quick drafts and workflow experiments — for production-quality enlargement or matting, use a dedicated AI service.",
  },
];

const NAV_LINKS: Array<[string, string]> = [
  ["/dashboard", "Tools"],
  ["/image-upscaler", "Image Studio"],
  ["/stock-analysis", "Stock Intelligence"],
  ["/event-calendar", "Event Calendar"],
  ["/help", "Pricing"],
];

const HERO_PILLS: Array<{
  href: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  primary?: boolean;
}> = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Open Dashboard", primary: true },
  { href: "#tools", icon: Wand2, label: "Explore All Tools" },
  { href: "/metadata-generator", icon: FileText, label: "Metadata" },
  { href: "/prompt-generator", icon: PencilLine, label: "Prompts" },
  { href: "/image-upscaler", icon: ZoomIn, label: "Image Studio" },
  { href: "/stock-analysis", icon: Compass, label: "Stock Intelligence" },
];

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

function GreenCard({
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
    "rounded-3xl bg-gradient-to-br from-[#0e6e34] to-[#159447] p-7 text-left transition-transform hover:-translate-y-0.5";
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
      {/* ===== CINEMATIC HERO ===== */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-black">
        <Image
          src="/hero-cinematic.jpg"
          alt="Samurai silhouette on a grassy hilltop overlooking a foggy city skyline"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* legibility overlays */}
        <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/60 to-transparent" aria-hidden="true" />

        {/* nav */}
        <header className="relative z-10">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-zinc-900 text-white shadow-lg shadow-black/40">
                <Sparkles size={19} />
              </span>
              <span className="leading-tight">
                <span className="block text-base font-extrabold tracking-tight text-white">
                  SONET STOCK AI
                </span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-white/60">
                  Creative Production Lab
                </span>
              </span>
            </Link>
            <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
              {NAV_LINKS.map(([href, label]) => (
                <Link
                  key={label}
                  href={href}
                  className="text-sm font-medium text-white/75 transition-colors hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="hidden lg:block">
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-black px-6 text-sm font-bold text-white shadow-lg shadow-black/30 transition-all hover:bg-zinc-900"
              >
                Get Started <ArrowRight size={16} />
              </Link>
            </div>
            <button
              className="rounded-lg p-2 text-white lg:hidden"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
          {menuOpen && (
            <nav className="mx-4 rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur-md lg:hidden" aria-label="Mobile">
              <div className="flex flex-col gap-1">
                {NAV_LINKS.map(([href, label]) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    {label}
                  </Link>
                ))}
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-black px-4 text-sm font-bold text-white"
                >
                  Get Started <ArrowRight size={16} />
                </Link>
              </div>
            </nav>
          )}
        </header>

        {/* headline */}
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-14 text-center sm:px-6">
          <h1 className="relative inline-block select-none">
            <span
              className={`${anton.className} block text-[clamp(4rem,14vw,11rem)] leading-[0.9] tracking-tight text-white drop-shadow-[0_6px_30px_rgba(0,0,0,0.85)]`}
            >
              CREATE BIG
            </span>
            <span
              className={`${caveat.className} absolute -bottom-[0.42em] right-[0.02em] -rotate-3 text-[clamp(2.75rem,8vw,6rem)] font-bold leading-none text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.85)]`}
            >
              ger!
            </span>
          </h1>
          <p className="mt-10 max-w-xl text-base font-medium text-white/85 md:text-lg">
            Research Smarter. Create Faster. Earn Strategically.
          </p>
        </div>

        {/* CTA pills */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {HERO_PILLS.map((p) => {
              const cls = p.primary
                ? "inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-black px-6 text-sm font-bold text-white shadow-lg shadow-black/30 transition-all hover:bg-zinc-900"
                : "inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-white/[0.06] px-5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/[0.12]";
              const inner = (
                <>
                  <p.icon size={16} />
                  {p.label}
                  {p.primary && <ArrowRight size={16} />}
                </>
              );
              return p.href.startsWith("#") ? (
                <a key={p.label} href={p.href} className={cls}>
                  {inner}
                </a>
              ) : (
                <Link key={p.label} href={p.href} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* features */}
      <section id="tools" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Nine tools, one workflow</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted">
              Every tool runs on-device and saves its results to your local workspace.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <GreenCard key={f.href} href={f.href} icon={f.icon} title={f.title} desc={f.desc} />
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
              <GreenCard key={s.title} step={String(i + 1)} icon={s.icon} title={s.title} desc={s.desc} />
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
              <GreenCard key={c.title} icon={c.icon} title={c.title} desc={c.desc} />
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
      <footer className="border-t border-border bg-[#0c0f0d]">
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
