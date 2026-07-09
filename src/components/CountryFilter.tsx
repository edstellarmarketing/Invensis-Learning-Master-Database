"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";

// Searchable multi-select country filter. Offers the full 50-country master list plus
// any country strings already present in this table's data (so ad-hoc/typed values are
// still selectable), with a search box to narrow a long list quickly.
export default function CountryFilter({
  selected,
  onChange,
  dataCountries,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  dataCountries: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Lightweight popover behavior: Escape closes and returns focus to the trigger.
  // (Deliberately no body-scroll lock - unlike full dialogs, this is a small filter
  // popover and the table behind it should stay scrollable.)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const allCountries = useMemo(() => {
    const merged = new Set([...COUNTRIES, ...dataCountries]);
    return [...merged].sort();
  }, [dataCountries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allCountries.filter((c) => c.toLowerCase().includes(q)) : allCountries;
  }, [allCountries, query]);

  const toggle = (country: string) => {
    const next = new Set(selected);
    if (next.has(country)) next.delete(country);
    else next.add(country);
    onChange(next);
  };

  const label =
    selected.size === 0
      ? "All countries"
      : selected.size === 1
        ? [...selected][0]
        : `${selected.size} countries`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setQuery("");
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex items-center gap-1.5 rounded-lg border bg-surface px-2.5 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--ring)] ${
          selected.size > 0 ? "border-[var(--primary)] text-primary" : "text-text-muted hover:border-[var(--primary)]"
        }`}
      >
        <span className="max-w-[140px] truncate">{label}</span>
        {selected.size > 0 && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear country filter"
            onClick={(e) => {
              e.stopPropagation();
              onChange(new Set());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onChange(new Set());
              }
            }}
            className="rounded-full p-0.5 hover:bg-surface-2"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            aria-label="Select countries"
            style={{ overflowAnchor: "none" }}
            className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-lg border bg-surface p-2 shadow-lg"
          >
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search countries..."
                className="w-full rounded-md border bg-bg py-1.5 pl-7 pr-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            {selected.size > 0 && (
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="text-xs text-text-muted">{selected.size} selected</span>
                <button
                  type="button"
                  onClick={() => onChange(new Set())}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto">
              {visible.length === 0 ? (
                <p className="px-1 py-3 text-center text-sm text-text-muted">
                  No countries match &ldquo;{query}&rdquo;.
                </p>
              ) : (
                visible.map((c) => (
                  <label
                    key={c}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c)}
                      onChange={() => toggle(c)}
                      className="size-3.5 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="truncate">{c}</span>
                    {dataCountries.includes(c) && (
                      <span className="ml-auto shrink-0 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        in table
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
