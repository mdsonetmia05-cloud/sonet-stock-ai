"use client";
import { useEffect, useMemo, useState } from "react";
import { Palette, SlidersHorizontal, Cpu, Database, Trash2, Save, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useTheme } from "@/components/providers";
import { localDb, DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/db";
import { listProviders, getActiveProvider, setActiveProvider, clearProvider } from "@/lib/ai-providers";
import { formatBytes, cn } from "@/lib/utils";

type Provider = ReturnType<typeof listProviders>[number];
type ActiveProvider = { id: string; apiKey: string; model: string } | null;

const MARKETPLACES = [
  { value: "adobe-stock", label: "Adobe Stock" },
  { value: "shutterstock", label: "Shutterstock" },
  { value: "freepik", label: "Freepik" },
  { value: "vecteezy", label: "Vecteezy" },
  { value: "dreamstime", label: "Dreamstime" },
  { value: "depositphotos", label: "Depositphotos" },
  { value: "123rf", label: "123RF" },
  { value: "generic", label: "Generic CSV" },
];

function ProviderCard({
  provider,
  active,
  onActiveChange,
}: {
  provider: Provider;
  active: ActiveProvider;
  onActiveChange: () => void;
}) {
  const [key, setKey] = useState("");
  const [model, setModel] = useState(provider.defaultModel);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const isActive = active?.id === provider.id;
  const anotherActive = active !== null && !isActive;

  useEffect(() => {
    if (isActive && active?.model && provider.models.includes(active.model)) {
      setModel(active.model);
    }
  }, [isActive, active?.model, provider.models]);

  const doSave = () => {
    setActiveProvider(provider.id, key.trim(), model);
    setConfirmOverwrite(false);
    setTestResult(null);
    onActiveChange();
  };

  const handleSave = () => {
    if (!key.trim()) {
      setTestResult({ ok: false, message: "Enter an API key first." });
      return;
    }
    if (anotherActive) {
      setConfirmOverwrite(true);
      return;
    }
    doSave();
  };

  const handleTest = async () => {
    if (!key.trim()) {
      setTestResult({ ok: false, message: "Enter an API key first." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, apiKey: key.trim(), model, prompt: "Reply with: OK" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = typeof data?.text === "string" ? data.text : JSON.stringify(data);
        setTestResult({
          ok: true,
          message: /OK/i.test(text) ? `Connected — ${model} replied OK` : `Connected — ${model} responded`,
        });
      } else {
        const err = data?.error || data?.detail || `Request failed (HTTP ${res.status})`;
        setTestResult({ ok: false, message: String(err) });
      }
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Network error" });
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = () => {
    clearProvider();
    setKey("");
    setTestResult(null);
    onActiveChange();
  };

  return (
    <div className={cn("rounded-xl border px-4 py-3", isActive ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/40")}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-foreground">{provider.name}</div>
          <div className="text-xs text-muted">{provider.freeNote}</div>
        </div>
        {isActive && <Badge tone="success">Active</Badge>}
      </div>
      <a
        href={provider.keyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primaryBright hover:underline"
      >
        Get free key <ExternalLink size={12} />
      </a>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`model-${provider.id}`}>Model</Label>
          <Select
            id={`model-${provider.id}`}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            options={provider.models}
          />
        </div>
        <div>
          <Label htmlFor={`key-${provider.id}`}>API key</Label>
          <Input
            id={`key-${provider.id}`}
            type="password"
            autoComplete="off"
            placeholder={isActive ? "Saved — enter a new key to replace" : "Paste your free API key"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>
      </div>
      {testResult && (
        <p className={cn("mt-2 text-xs", testResult.ok ? "text-primaryBright" : "text-danger")}>
          {testResult.message}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={handleSave}>
          <Save size={14} /> Save
        </Button>
        <Button size="sm" variant="secondary" loading={testing} onClick={handleTest}>
          Test
        </Button>
        {isActive && (
          <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={handleRemove}>
            Remove
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmOverwrite}
        onClose={() => setConfirmOverwrite(false)}
        onConfirm={doSave}
        title="Replace active provider?"
        message={`This will remove the saved key for the currently active provider and activate ${provider.name} instead.`}
        confirmLabel="Replace"
      />
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [tick, setTick] = useState(0);
  const [prefs, setPrefs] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES });
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [active, setActive] = useState<ActiveProvider>(null);

  const providers = useMemo(() => listProviders(), []);

  const refreshActive = () => setActive(getActiveProvider());
  useEffect(() => { refreshActive(); }, []);

  const data = useMemo(() => {
    const db = localDb();
    return {
      db,
      usage: db.usage.all(),
      counts: {
        jobs: db.jobs.count(),
        prompts: db.prompts.count(),
        metadata: db.metadata.count(),
        research: db.research.count(),
        favorites: db.favorites.count(),
        exports: db.exports.count(),
        qcReports: db.qcReports.count(),
      },
    };
  }, [tick]);

  useEffect(() => {
    setPrefs(localDb().preferences.get());
  }, [tick]);

  const totalBytes = data.usage.reduce((n, u) => n + (u.bytesExported ?? 0), 0);
  const totalRecords = Object.values(data.counts).reduce((n, c) => n + c, 0);

  const handleSavePrefs = () => {
    data.db.preferences.save({ ...prefs, theme });
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  const handleTheme = (t: "dark" | "light") => {
    setTheme(t);
    data.db.preferences.save({ ...data.db.preferences.get(), theme: t });
  };

  const num = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const handleWipe = () => {
    data.db.wipe();
    setConfirmWipe(false);
    setTick((t) => t + 1);
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Appearance, metadata defaults, AI providers and your local data."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* theme */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <Palette size={16} className="text-muted" />
          </CardHeader>
          <Label htmlFor="theme-select">Theme</Label>
          <Select
            id="theme-select"
            value={theme}
            onChange={(e) => handleTheme(e.target.value as "dark" | "light")}
            options={[
              { value: "dark", label: "Dark (default)" },
              { value: "light", label: "Light" },
            ]}
          />
          <p className="mt-2 text-xs text-muted">Saved to this browser immediately.</p>
        </Card>

        {/* metadata defaults */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata defaults</CardTitle>
            <SlidersHorizontal size={16} className="text-muted" />
          </CardHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="default-marketplace">Default marketplace</Label>
              <Select
                id="default-marketplace"
                value={prefs.defaultMarketplace}
                onChange={(e) => setPrefs({ ...prefs, defaultMarketplace: e.target.value })}
                options={MARKETPLACES}
              />
            </div>
            <div>
              <Label htmlFor="min-title">Min title words</Label>
              <Input id="min-title" type="number" min={1} max={50} value={prefs.minTitleWords}
                onChange={(e) => setPrefs({ ...prefs, minTitleWords: Math.max(1, num(e.target.value, prefs.minTitleWords)) })} />
            </div>
            <div>
              <Label htmlFor="max-title">Max title words</Label>
              <Input id="max-title" type="number" min={1} max={100} value={prefs.maxTitleWords}
                onChange={(e) => setPrefs({ ...prefs, maxTitleWords: Math.max(prefs.minTitleWords, num(e.target.value, prefs.maxTitleWords)) })} />
            </div>
            <div>
              <Label htmlFor="min-kw">Min keywords</Label>
              <Input id="min-kw" type="number" min={1} max={50} value={prefs.minKeywords}
                onChange={(e) => setPrefs({ ...prefs, minKeywords: Math.max(1, num(e.target.value, prefs.minKeywords)) })} />
            </div>
            <div>
              <Label htmlFor="max-kw">Max keywords</Label>
              <Input id="max-kw" type="number" min={1} max={50} value={prefs.maxKeywords}
                onChange={(e) => setPrefs({ ...prefs, maxKeywords: Math.max(prefs.minKeywords, num(e.target.value, prefs.maxKeywords)) })} />
            </div>
            <div>
              <Label htmlFor="desc-words">Description words</Label>
              <Input id="desc-words" type="number" min={1} max={200} value={prefs.descriptionWords}
                onChange={(e) => setPrefs({ ...prefs, descriptionWords: Math.max(1, num(e.target.value, prefs.descriptionWords)) })} />
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
              <input
                type="checkbox"
                checked={prefs.singleWordKeywords}
                onChange={(e) => setPrefs({ ...prefs, singleWordKeywords: e.target.checked })}
                className="h-4 w-4 accent-[#C9A86A]"
                aria-label="Use single-word keywords"
              />
              <span className="text-sm text-foreground">
                Single-word keywords
                <span className="block text-xs text-muted">Split phrases into single words for platforms that require it.</span>
              </span>
            </label>
            <div>
              <Label htmlFor="prohibited">Prohibited words (comma separated)</Label>
              <Textarea
                id="prohibited"
                value={prefs.prohibitedWords}
                onChange={(e) => setPrefs({ ...prefs, prohibitedWords: e.target.value })}
                placeholder="e.g. beautiful, nice, stunning"
                className="min-h-[52px]"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button size="sm" onClick={handleSavePrefs}>
              <Save size={14} /> Save defaults
            </Button>
            {prefsSaved && <span className="ml-2 text-xs text-primaryBright">Saved</span>}
          </div>
        </Card>

        {/* AI provider */}
        <Card>
          <CardHeader>
            <CardTitle>AI providers</CardTitle>
            <Cpu size={16} className="text-muted" />
          </CardHeader>
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-foreground">On-device engine</div>
              <div className="text-xs text-muted">Built in — image analysis, metadata and prompt tools run locally in your browser. No API key needed.</div>
            </div>
            <Badge tone="success">active</Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} active={active} onActiveChange={refreshActive} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Keys are stored only in this browser (localStorage). They are sent to this app&apos;s
            server only to forward your request to the provider — never stored or logged.
          </p>
        </Card>

        {/* usage */}
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <Database size={16} className="text-muted" />
          </CardHeader>
          {data.usage.length === 0 ? (
            <p className="text-sm text-muted">No usage recorded yet — activity appears here as you work.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 pr-2 font-medium">Date</th>
                    <th className="pb-2 pr-2 font-medium">Images</th>
                    <th className="pb-2 pr-2 font-medium">Metadata</th>
                    <th className="pb-2 pr-2 font-medium">Prompts</th>
                    <th className="pb-2 font-medium">Exported</th>
                  </tr>
                </thead>
                <tbody>
                  {data.usage.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-2 text-foreground">{u.date}</td>
                      <td className="py-2 pr-2 text-muted">{u.imagesProcessed}</td>
                      <td className="py-2 pr-2 text-muted">{u.metadataGenerated}</td>
                      <td className="py-2 pr-2 text-muted">{u.promptsCreated}</td>
                      <td className="py-2 text-muted">{formatBytes(u.bytesExported)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* data */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your data</CardTitle>
            <Trash2 size={16} className="text-muted" />
          </CardHeader>
          <p className="text-sm text-muted">
            Everything is stored only in this browser: {totalRecords} record(s) across jobs, prompts,
            metadata, research, favorites, exports and QC reports. {formatBytes(totalBytes)} exported in total.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => setConfirmWipe(true)}>
              <Trash2 size={14} /> Delete all data
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            This permanently removes your local workspace data from this browser. It cannot be undone.
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        onConfirm={handleWipe}
        title="Delete all data?"
        message="This permanently removes all jobs, prompts, metadata, research, favorites, exports and QC reports from this browser. This cannot be undone."
        confirmLabel="Delete everything"
      />
    </div>
  );
}
