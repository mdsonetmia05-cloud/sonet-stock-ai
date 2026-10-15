"use client";
import { useEffect, useMemo, useState } from "react";
import { User, Palette, SlidersHorizontal, Cpu, Database, Trash2, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useAuth, useTheme } from "@/components/providers";
import { dbFor, DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/db";
import { fetchServerProviderStatus, type ServerProviderStatus } from "@/lib/providers";
import { formatBytes, formatDateTime } from "@/lib/utils";

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

const KNOWN_SERVER_PROVIDERS = ["gemini", "openai", "anthropic"];

export default function SettingsPage() {
  const { user, signIn, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [tick, setTick] = useState(0);
  const [name, setName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES });
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ServerProviderStatus | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetchServerProviderStatus()
      .then((s) => { if (!cancelled) setProviderStatus(s); })
      .finally(() => { if (!cancelled) setProviderLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const data = useMemo(() => {
    if (!user) return null;
    const db = dbFor(user.id);
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
  }, [user, tick]);

  useEffect(() => {
    if (user) setPrefs(dbFor(user.id).preferences.get());
  }, [user, tick]);

  if (!user || !data) return null;

  const totalBytes = data.usage.reduce((n, u) => n + (u.bytesExported ?? 0), 0);
  const totalRecords = Object.values(data.counts).reduce((n, c) => n + c, 0);

  const handleSaveName = () => {
    signIn(name.trim() || "Demo Creator", user.email);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

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

  const handleDeleteAccount = () => {
    data.db.wipe();
    signOut();
    setConfirmAccount(false);
  };

  const serverList = providerStatus?.providers?.length
    ? providerStatus.providers
    : KNOWN_SERVER_PROVIDERS.map((id) => ({ id, hasKey: false }));

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Profile, appearance, metadata defaults, AI providers and your local data."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <User size={16} className="text-muted" />
          </CardHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="profile-name">Display name</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <div>
              <Label htmlFor="profile-email">Email (demo account)</Label>
              <Input id="profile-email" value={user.email} disabled aria-label="Email cannot be changed" />
              <p className="mt-1 text-xs text-muted">Email identifies your local workspace and cannot be changed.</p>
            </div>
            <div>
              <Button size="sm" onClick={handleSaveName}>
                <Save size={14} /> Save name
              </Button>
              {nameSaved && <span className="ml-2 text-xs text-primaryBright">Saved</span>}
            </div>
          </div>
        </Card>

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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Metadata defaults</CardTitle>
            <SlidersHorizontal size={16} className="text-muted" />
          </CardHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                className="h-4 w-4 accent-[#159447]"
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
            <CardTitle>AI provider</CardTitle>
            <Cpu size={16} className="text-muted" />
          </CardHeader>
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Demo Provider (on-device heuristics)</div>
              <div className="text-xs text-muted">Active — text assembled locally from templates and image measurements.</div>
            </div>
            <Badge tone="green">active</Badge>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {providerLoading ? (
              <p className="text-sm text-muted">Checking server providers…</p>
            ) : (
              serverList.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-2.5">
                  <span className="text-sm capitalize text-foreground">{p.id} (server)</span>
                  <Badge tone={p.hasKey ? "green" : "neutral"}>{p.hasKey ? "configured" : "not configured"}</Badge>
                </div>
              ))
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            No API keys are stored or sent from this build. Server providers are enabled in the production setup.
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
            <Button variant="secondary" onClick={() => setConfirmWipe(true)}>
              <Trash2 size={14} /> Delete all data
            </Button>
            <Button variant="danger" onClick={() => setConfirmAccount(true)}>
              Delete account
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Deleting all data keeps you signed in with an empty workspace. Deleting the account also signs you out of this device.
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
      <ConfirmDialog
        open={confirmAccount}
        onClose={() => setConfirmAccount(false)}
        onConfirm={handleDeleteAccount}
        title="Delete account?"
        message="This wipes all your local workspace data and signs you out of this device. This cannot be undone."
        confirmLabel="Delete account"
      />
    </div>
  );
}
