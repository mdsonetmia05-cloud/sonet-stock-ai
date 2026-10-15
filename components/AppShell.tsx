"use client";
import { useState, ReactNode, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Search, CalendarDays, ShieldCheck, Sparkles, ScanEye, Tags,
  Layers, Eraser, ArrowUpFromLine, History, Settings, LifeBuoy, Menu, X,
  Sun, Moon, ChevronRight, ChevronDown, LogOut, FlaskConical, Home, MessageSquareText,
} from "lucide-react";
import { useAuth, useTheme } from "./providers";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

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
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-base font-black text-white">
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

function SignInScreen() {
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow)]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-xl font-black text-white">S</span>
          <div>
            <h1 className="text-lg font-bold text-foreground">SONET STOCK AI</h1>
            <p className="text-xs text-muted">Demo workspace — sign in locally</p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) signIn(name, email);
          }}
          className="flex flex-col gap-3"
        >
          <div>
            <label htmlFor="signin-name" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Name</label>
            <Input id="signin-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
          </div>
          <div>
            <label htmlFor="signin-email" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Email</label>
            <Input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <Button type="submit" size="lg" className="mt-2">Enter Workspace</Button>
        </form>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted">
          <FlaskConical size={14} className="mt-0.5 shrink-0 text-amber-400" />
          Demo mode: credentials stay in this browser only. No real account is created.
        </p>
      </div>
    </div>
  );
}

function UpgradeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Upgrade">
      <p className="text-sm leading-relaxed text-muted">
        This demo build runs fully on-device with heuristics and sample data — there is nothing
        to upgrade yet. When a production build with server-side AI providers ships, provider
        plans and pricing will be published here first.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Link href="/settings" onClick={onClose}>
          <Button>Open Settings</Button>
        </Link>
      </div>
    </Dialog>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const crumbs = useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    return segs.map((s, i) => ({
      label: s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      href: "/" + segs.slice(0, i + 1).join("/"),
      last: i === segs.length - 1,
    }));
  }, [pathname]);

  if (!user) return <SignInScreen />;

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
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-[#0a0a10] transition-all md:flex",
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
          <aside className="absolute left-0 top-0 flex h-full w-72 animate-fade-in flex-col border-r border-border bg-[#0a0a10]">
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
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-[#0a0a0f] px-4">
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
            <span className="hidden items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 lg:inline-flex" title="Demo mode: this build uses on-device heuristics and sample data.">
              <FlaskConical size={13} /> Demo
            </span>
            <button
              onClick={() => setUpgradeOpen(true)}
              className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-all hover:brightness-110"
            >
              Upgrade
            </button>
            <button onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="rounded-xl border border-border p-2.5 text-muted hover:bg-white/5 hover:text-foreground">
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link href="/" aria-label="Homepage" className="rounded-xl border border-border p-2.5 text-muted hover:bg-white/5 hover:text-foreground">
              <Home size={17} />
            </Link>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white" aria-hidden>
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground xl:block">{user.name}</span>
              <button onClick={signOut} aria-label="Sign out" title="Sign out" className="rounded-lg p-1.5 text-muted hover:bg-secondary hover:text-foreground">
                <LogOut size={15} />
              </button>
            </div>
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
          SONET STOCK AI — demo build. Adobe Stock, Shutterstock, Freepik, Vecteezy, Dreamstime, Depositphotos and 123RF are independent services; this tool is not affiliated with or endorsed by them.
        </footer>
      </div>

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
