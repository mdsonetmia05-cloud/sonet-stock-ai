"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Rocket,
  FileText,
  ImagePlus,
  Compass,
  Wand2,
  ShieldAlert,
  ZoomIn,
  Eraser,
  CalendarDays,
  Package,
  MonitorSmartphone,
  ShieldCheck,
  Plus,
  Minus,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const TOOL_DOCS = [
  {
    icon: FileText,
    title: "AI Metadata Generator",
    route: "/metadata-generator",
    body: "Upload one or more images to get titles, descriptions and keywords built from on-device image analysis (colors, lighting, orientation, edge density). Choose a marketplace profile to match word and keyword limits. Export as CSV or copy — metadata is not embedded into files.",
  },
  {
    icon: ImagePlus,
    title: "Image to Prompt",
    route: "/image-to-prompt",
    body: "Upload a reference photo and receive a structured generation prompt describing subject, style, lighting and composition. Prompt records are saved to your workspace and can be favorited.",
  },
  {
    icon: Compass,
    title: "Stock Market Research",
    route: "/stock-analysis",
    body: "Upload a CSV of your own portfolio and get real breakdowns by platform, category, asset type and keyword. Every number comes from your file — nothing is estimated or sampled.",
  },
  {
    icon: Wand2,
    title: "AI Prompt Generator",
    route: "/prompt-generator",
    body: "Assemble detailed prompts from subject, style, lighting, camera and mood controls. Save, favorite and export prompts; negative prompts are supported.",
  },
  {
    icon: ShieldAlert,
    title: "Rejection Risk Analysis",
    route: "/rejection-predictor",
    body: "Heuristic pre-upload checks for exposure clipping, sharpness, noise and common rejection reasons, with pass/warn/fail findings. This is not a prediction of marketplace acceptance — agencies make the final decision.",
  },
  {
    icon: ZoomIn,
    title: "Bulk Image Upscaler",
    route: "/image-upscaler",
    body: "Enlarges images to 2x or 4x using basic browser canvas resampling, with optional denoise and sharpen passes. Every result is labeled 'Basic browser upscaling (not AI)'.",
  },
  {
    icon: Eraser,
    title: "Background Remover",
    route: "/background-remover",
    body: "Removes backgrounds with flood-fill alpha, shown on a live transparency preview. Labeled 'Basic background removal (not AI)' — it is not AI matting.",
  },
  {
    icon: CalendarDays,
    title: "Stock Event Calendar",
    route: "/event-calendar",
    body: "A curated 2026–2027 event calendar with production windows, content suggestions and keywords. Fixed dates are verified, rule-computed dates are labeled computed, and lunar dates are labeled approximate — confirm locally.",
  },
  {
    icon: Package,
    title: "Bulk Export & Workflow",
    route: "/batch-editor",
    body: "Track bulk jobs across tools and export your workspace data as CSV, text or ZIP. Every export is recorded in your download history with its byte size.",
  },
];

const HELP_FAQS = [
  {
    q: "Do I need an account or API key?",
    a: "No. Everything runs in your browser — no signup, no key. Optional server-side AI providers (Gemini, OpenAI, Anthropic) can be enabled with an API key; Settings shows their status.",
  },
  {
    q: "Is my work uploaded anywhere?",
    a: "No. Images, prompts and metadata are processed and stored in your browser's localStorage. Nothing leaves your device. Use Settings to wipe it all.",
  },
  {
    q: "Can I edit metadata after generating it?",
    a: "Yes — generated records are saved to your local database and can be reviewed, edited (in the metadata generator) and re-exported.",
  },
  {
    q: "What file formats can I export?",
    a: "CSV for metadata and history, plain text for prompts, and ZIP bundles from the batch workflow. Downloads are recorded in your exports history.",
  },
  {
    q: "Does the workspace submit files to marketplaces?",
    a: "No. You prepare and export everything here, then upload and submit on each marketplace's own site, where review and AI-content disclosure happen.",
  },
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

export default function HelpPage() {
  return (
    <div>
      <PageHeader
        title="Help & Documentation"
        description="How the workspace works, what each tool does, and the rules that keep your contributor accounts safe."
      />

      {/* getting started */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <Rocket size={16} className="text-primaryBright" />
        </CardHeader>
        <ol className="flex list-none flex-col gap-3">
          {[
            "Open the event calendar and pick an upcoming occasion worth producing for.",
            "Use Stock Market Research to save a project with your topic, platform and notes.",
            "Generate prompts with the Prompt Generator, or derive one from a reference photo.",
            "Create your assets, then run Rejection Risk Analysis before you export.",
            "Generate marketplace metadata, export as CSV, and submit on each platform's site.",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-muted">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-onPrimary">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* each tool explained */}
      <h2 className="mb-3 text-lg font-semibold text-foreground">Each tool, explained</h2>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {TOOL_DOCS.map((t) => (
          <Card key={t.route}>
            <div className="mb-3 flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primaryBright">
                <t.icon size={18} />
              </span>
              <Link href={t.route} className="inline-flex items-center gap-1 text-sm font-medium text-primaryBright hover:underline">
                Open <ArrowRight size={14} />
              </Link>
            </div>
            <h3 className="text-base font-semibold text-foreground">{t.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.body}</p>
          </Card>
        ))}
      </div>

      {/* how the tools work */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>How the tools work</CardTitle>
          <MonitorSmartphone size={16} className="text-primaryBright" />
        </CardHeader>
        <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-muted">
          <li>• Every tool runs on-device in your browser. Text output is assembled from templates and measured image data — no API key or signup needed.</li>
          <li>• Optional server-side AI providers (Gemini, OpenAI, Anthropic) can be enabled with an API key; their status is shown in Settings.</li>
          <li>• Numbers you see always come from your own files and activity — the app never invents download counts, rankings, sales or revenue.</li>
          <li>• Upscaling uses browser canvas resampling and background removal uses flood-fill alpha — both are clearly labeled in their tools.</li>
        </ul>
      </Card>

      {/* marketplace compliance */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Marketplace compliance notes</CardTitle>
          <ShieldCheck size={16} className="text-primaryBright" />
        </CardHeader>
        <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-muted">
          <li>• <strong className="text-foreground">No scraping.</strong> This workspace never scrapes marketplace sites or their data.</li>
          <li>• <strong className="text-foreground">Respect licensing.</strong> Only upload content you own or have the rights to, including model and property releases where required.</li>
          <li>• <strong className="text-foreground">Disclose AI content.</strong> Most marketplaces require AI-generated or AI-assisted content to be disclosed at submission — do it on their submission forms, every time.</li>
          <li>• <strong className="text-foreground">No guarantees.</strong> Never promise yourself — or others — acceptance, downloads, sales or income. Review decisions belong to each marketplace.</li>
          <li>• <strong className="text-foreground">Data retention: local only.</strong> All records live in your browser. Delete them anytime from Settings; there is no server copy to request.</li>
        </ul>
      </Card>

      {/* faq */}
      <h2 className="mb-3 text-lg font-semibold text-foreground">FAQ</h2>
      <div className="flex flex-col gap-3">
        {HELP_FAQS.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </div>
    </div>
  );
}
