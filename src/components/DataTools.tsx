"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { fetchAdminGated } from "@/lib/adminTokenClient";

export default function DataTools() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const MAX_IMPORT_BYTES = 20 * 1024 * 1024; // 20MB - this dataset is small JSON; a bigger file is almost certainly the wrong file.

  const onImportFile = async (file: File) => {
    setMessage(null);
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError(
        `File is ${(file.size / (1024 * 1024)).toFixed(1)}MB, larger than the ${MAX_IMPORT_BYTES / (1024 * 1024)}MB expected for this database's exports. Check you picked the right file.`,
      );
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Not a valid JSON file");
      }
      if (mode === "replace" && !window.confirm("Replace ALL current data with this file?")) {
        return;
      }
      const res = await fetchAdminGated("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Import failed (${res.status})`);
      setMessage(
        `Imported (${data.mode}): ${data.companies} companies, ${data.courseIndustrySets} course industry sets.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border bg-surface p-5 shadow-sm">
      <p className="font-semibold">Data tools</p>
      <p className="mt-0.5 text-sm text-text-muted">
        Back up the full database as JSON, or restore/merge from a previous export.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href="/api/export"
          download
          className="inline-flex items-center gap-1.5 rounded-lg border bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:border-[var(--primary)] hover:text-primary"
        >
          <Download size={15} /> Export JSON
        </a>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:border-[var(--primary)] hover:text-primary disabled:opacity-60"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          Import JSON
        </button>
        <label className="ml-1 inline-flex items-center gap-1.5 text-sm text-text-muted">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "merge" | "replace")}
            className="rounded-md border bg-bg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="merge">Merge into current data</option>
            <option value="replace">Replace all data</option>
          </select>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
          }}
        />
      </div>
      {message && (
        <p role="status" aria-live="polite" className="mt-2 text-sm text-accent">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" aria-live="assertive" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
