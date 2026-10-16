"use client";
import { useState, ReactNode, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Search, CalendarDays, ShieldCheck, Sparkles, ScanEye, Tags,
  Layers, Eraser, ArrowUpFromLine, History, Settings, LifeBuoy, Menu, X,
  Sun, Moon, ChevronRight, ChevronDown, Home, MessageSquareText,
} from "lucide-react";
import { useTheme } from "./providers";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> }],
  },
  {
    title: "Research",
    items: [
      { href: "/stock-analysis", label: "Market Research", icon: <Search size={18} /> },
      { href: "/event-calendar", label: "Event Calendar", icon: <CalendarDays size={18} /> },
      { href: "/rejection-predictor", label: "Rejection Predictor", icon: <ShieldCheck size={18} /> },
    ],
  },
  {
    title: "Creation",
    items: [
      { href: "/prompt-generator", label: "Prompt Generator", icon: <Sparkles size={18} /> },
      { href: "/image-to-prompt", label: "Image to Prompt", icon: <ScanEye size={18} /> },
      { href: "/metadata-generator", label: "Metadata Generator", icon: <Tags size={18} /> },
    ],
  },
  {
    title: "Optimization",
    items: [
      { href: "/batch-editor", label: "Batch Editor", icon: <Layers size={18} /> },
      { href: "/background-remover", label: "Background Remover", icon: <Eraser size={18} /> },
      { href: "/image-upscaler", label: "Image Upscaler", icon: <ArrowUpFromLine size={18} /> },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/history", label: "History", icon: <History size={18} /> },
      { href: "/settings", label: "Settings", icon: <Settings size={18} /> },
      { href: "/help", label: "Help", icon: <LifeBuoy size={18} /> },
    ],
  },
];

function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="SONET STOCK AI home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-base font-black text-onPrimary">
        S
      </span>
      {!compact && (
        <span className="text-sm font-extrabold tracking-tight text-foreground">
          SONET <span className="text-primaryBright">STOCK AI</span>
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  const crumbs = useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    return segs.map((s, i) => ({
      label: s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      href: "/" + segs.slice(0, i + 1).join("/"),
      last: i === segs.length - 1,
    }));
  }, [pathname]);

  const navContent = (onNavigate?: () => void) => (
    <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label="Main navigation">
      {NAV.map((g) => (
        <div key={g.title} className="mb-4">
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">{g.title}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/15 text-primaryBright"
                        : "text-muted hover:bg-white/5 hover:text-foreground",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    {item.icon}
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-background transition-all md:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div className="px-4 py-5">
          <Wordmark compact={collapsed} />
        </div>
        {navContent()}
        <div className="border-t border-border p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-muted hover:bg-white/5 hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronDown size={16} className="rotate-90" /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute left-0 top-0 flex h-full w-72 animate-fade-in flex-col border-r border-border bg-background">
            <div className="flex items-center justify-between px-4 py-5">
              <Wordmark />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-muted hover:bg-white/5">
                <X size={18} />
              </button>
            </div>
            {navContent(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background px-4">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-muted hover:bg-white/5 md:hidden">
            <Menu size={20} />
          </button>
          <div className="md:hidden">
            <Wordmark />
          </div>
          <div className="hidden md:block">
            <Wordmark />
          </div>
          <form
            className="ml-4 hidden max-w-sm flex-1 lg:block"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/history?q=${encodeURIComponent(search)}`);
            }}
            role="search"
          >
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, prompts…"
              aria-label="Search your work"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/help"
              className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground sm:inline-flex"
            >
              <MessageSquareText size={16} /> Feedback
            </Link>
            <button onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="rounded-xl border border-border p-2.5 text-muted hover:bg-white/5 hover:text-foreground">
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link href="/" aria-label="Homepage" className="rounded-xl border border-border p-2.5 text-muted hover:bg-white/5 hover:text-foreground">
              <Home size={17} />
            </Link>
          </div>
        </header>

        {/* breadcrumbs */}
        <div className="border-b border-border/60 px-4 py-2.5 md:px-8" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-xs text-muted">
            <li><Link href="/dashboard" className="hover:text-foreground">Workspace</Link></li>
            {crumbs.map((c) => (
              <li key={c.href} className="flex items-center gap-1.5">
                <ChevronRight size={12} aria-hidden />
                {c.last ? (
                  <span className="font-medium text-foreground" aria-current="page">{c.label}</span>
                ) : (
                  <Link href={c.href} className="hover:text-foreground">{c.label}</Link>
                )}
              </li>
            ))}
          </ol>
        </div>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">{children}</main>

        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted md:px-8">
          SONET STOCK AI — your on-device workspace for stock contributors. Adobe Stock, Shutterstock, Freepik, Vecteezy, Dreamstime, Depositphotos and 123RF are independent services; this tool is not affiliated with or endorsed by them.
        </footer>
      </div>
    </div>
  );
}
