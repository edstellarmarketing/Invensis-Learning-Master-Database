import { Database, KeyRound, Palette, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AdminTokenSettings from "@/components/AdminTokenSettings";
import DataTools from "@/components/DataTools";
import { kvConfigured } from "@/lib/storage";

export const metadata = {
  title: "Settings - Invensis Learning Master Database",
};

const PROVIDERS = [
  { key: "ANTHROPIC_API_KEY", label: "Claude (Anthropic)" },
  { key: "OPENROUTER_API_KEY", label: "OpenRouter" },
  { key: "GROQ_API_KEY", label: "Groq" },
] as const;

function StatusPill({ ok, onLabel, offLabel }: { ok: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok
          ? "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success"
          : "bg-surface-2 text-text-muted"
      }`}
    >
      <span className={`size-1.5 rounded-full ${ok ? "bg-success" : "bg-text-muted"}`} />
      {ok ? onLabel : offLabel}
    </span>
  );
}

export default function SettingsPage() {
  const redis = kvConfigured();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-text-muted">
        Appearance, AI provider status, admin access, and data backup/restore in one place.
      </p>

      <div className="mt-6 space-y-4">
        <section className="rounded-xl border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-primary" />
            <h2 className="font-semibold">Appearance</h2>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <ThemeToggle />
            <p className="text-sm text-text-muted">Light / dark theme, saved to this browser.</p>
          </div>
        </section>

        <section className="rounded-xl border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h2 className="font-semibold">AI Search providers</h2>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Set via environment variables on the server - this just shows what&apos;s
            configured. See <code>.env.example</code> for setup instructions.
          </p>
          <ul className="mt-3 space-y-2">
            {PROVIDERS.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <span>
                  {p.label} <code className="text-xs text-text-muted">{p.key}</code>
                </span>
                <StatusPill ok={Boolean(process.env[p.key])} onLabel="Configured" offLabel="Not set" />
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-primary" />
            <h2 className="font-semibold">Storage</h2>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <span>
              Upstash Redis <code className="text-xs text-text-muted">UPSTASH_REDIS_REST_URL</code>
            </span>
            <StatusPill ok={redis} onLabel="Connected" offLabel="Local JSON files" />
          </div>
          {!redis && (
            <p className="mt-2 text-xs text-text-muted">
              Writes are saved to local files, which don&apos;t persist on serverless
              deployments (e.g. Vercel). Add the Upstash Redis integration for durable
              writes in production.
            </p>
          )}
        </section>

        <section className="rounded-xl border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-primary" />
            <h2 className="font-semibold">Admin access</h2>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            This app has no login (single shared deployment). An optional{" "}
            <code>ADMIN_API_TOKEN</code> guards the two truly destructive actions -
            replace-import and bulk-delete.
          </p>
          <div className="mt-3">
            <AdminTokenSettings />
          </div>
        </section>

        <DataTools />
      </div>
    </div>
  );
}
