"use client";

import { useState } from "react";
import { Check, KeyRound } from "lucide-react";
import {
  getStoredAdminToken,
  setStoredAdminToken,
  clearStoredAdminToken,
} from "@/lib/adminTokenClient";

// Lets an operator save the admin token ahead of time instead of waiting for the first
// 401 on a replace-import/bulk-delete to prompt for it (see lib/adminAuth.ts). Not
// verified here - there's no "check this token" endpoint, since that would let anyone
// probe for the right value. It's only actually checked server-side on the next
// admin-gated request.
export default function AdminTokenSettings() {
  // Lazy-initialised from sessionStorage (client-only, like ThemeToggle's theme read) so
  // there's no state-syncing effect; suppressHydrationWarning below covers the mismatch
  // when a token was already saved in this tab (server always renders "not saved").
  const [saved, setSaved] = useState(() =>
    typeof window !== "undefined" ? Boolean(getStoredAdminToken()) : false,
  );
  const [input, setInput] = useState("");

  const save = () => {
    if (!input.trim()) return;
    setStoredAdminToken(input.trim());
    setInput("");
    setSaved(true);
  };

  const clear = () => {
    clearStoredAdminToken();
    setSaved(false);
  };

  return (
    <div suppressHydrationWarning>
      {saved ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--success)_15%,transparent)] px-2.5 py-1 text-xs font-medium text-success">
            <Check size={13} /> Token saved for this tab
          </span>
          <button
            onClick={clear}
            className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface-2"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <KeyRound size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Admin token"
              className="w-full rounded-md border bg-bg py-1.5 pl-8 pr-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <button
            onClick={save}
            disabled={!input.trim()}
            className="btn-solid rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
          >
            Save
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-text-muted">
        Only needed if <code>ADMIN_API_TOKEN</code> is set on the server. Saved to this
        browser tab&apos;s session storage (cleared when the tab closes) and sent
        automatically for replace-import and bulk-delete - the two admin-protected
        actions. Not validated here; a wrong token still fails on the next request.
      </p>
    </div>
  );
}
