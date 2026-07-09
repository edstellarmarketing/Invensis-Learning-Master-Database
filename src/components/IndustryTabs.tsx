"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import type { Industry } from "@/lib/industries";
import { POPULAR_INDUSTRIES } from "@/lib/popularIndustries";
import { slugify } from "@/lib/slug";
import IconByName from "./IconByName";

const ICON_OPTIONS = [
  "Briefcase", "Cpu", "HardHat", "HeartPulse", "Landmark", "Factory", "RadioTower",
  "ShoppingCart", "Clapperboard", "Building2", "Car", "Pill", "Package", "Gamepad2",
  "ShieldCheck", "Zap", "Plane", "GraduationCap", "Truck", "Wheat", "FlaskConical",
  "Hotel", "Banknote", "Globe", "Server", "Ship", "Fuel",
];

type EditState = { mode: "add" } | { mode: "edit"; slug: string } | null;

export default function IndustryTabs({
  courseSlug,
  industries,
  activeIndustrySlug,
}: {
  courseSlug: string;
  industries: Industry[];
  activeIndustrySlug?: string;
}) {
  const router = useRouter();
  const [managing, setManaging] = useState(false);
  const [editState, setEditState] = useState<EditState>(null);
  const [name, setName] = useState("");
  const [rationale, setRationale] = useState("");
  const [icon, setIcon] = useState("Briefcase");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const focusName = () => requestAnimationFrame(() => nameInputRef.current?.focus({ preventScroll: true }));

  const openAdd = () => {
    setEditState({ mode: "add" });
    setName("");
    setRationale("");
    setIcon("Briefcase");
    setError(null);
    focusName();
  };

  const openEdit = (ind: Industry) => {
    setEditState({ mode: "edit", slug: slugify(ind.name) });
    setName(ind.name);
    setRationale(ind.rationale);
    setIcon(ind.icon || "Briefcase");
    setError(null);
    focusName();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !editState) return;
    setBusy(true);
    setError(null);
    try {
      const isAdd = editState.mode === "add";
      const res = await fetch("/api/industries", {
        method: isAdd ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isAdd
            ? { courseSlug, name: name.trim(), icon, rationale }
            : { courseSlug, industrySlug: editState.slug, name: name.trim(), icon, rationale },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setEditState(null);
      // Renamed active industry -> follow the new slug.
      if (!isAdd && editState.slug === activeIndustrySlug) {
        const newSlug = slugify(name.trim());
        if (newSlug !== activeIndustrySlug) {
          router.push(`/${courseSlug}/${newSlug}`);
          return;
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ind: Industry) => {
    const iSlug = slugify(ind.name);
    if (
      !window.confirm(
        `Delete industry "${ind.name}"? Companies under it will also be removed.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/industries?courseSlug=${encodeURIComponent(courseSlug)}&industrySlug=${encodeURIComponent(iSlug)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      if (iSlug === activeIndustrySlug) {
        router.push(`/${courseSlug}`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "rounded-md border bg-bg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {industries.map((ind) => {
          const iSlug = slugify(ind.name);
          const active = iSlug === activeIndustrySlug;
          return (
            <span key={iSlug} className="inline-flex items-center">
              <Link
                href={`/${courseSlug}/${iSlug}`}
                title={ind.rationale}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all duration-150 ${
                  active
                    ? "btn-gradient border-transparent shadow-md"
                    : "bg-surface text-text-muted hover:text-text hover:border-[var(--primary)] hover:shadow-sm"
                } ${managing ? "rounded-r-none" : ""}`}
              >
                <IconByName name={ind.icon} size={15} className={active ? "" : "text-primary"} />
                {ind.name}
              </Link>
              {managing && (
                <span className="flex rounded-r-lg border border-l-0 bg-surface">
                  <button
                    onClick={() => openEdit(ind)}
                    disabled={busy}
                    aria-label={`Edit ${ind.name}`}
                    className="px-1.5 py-2.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-primary"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => remove(ind)}
                    disabled={busy}
                    aria-label={`Delete ${ind.name}`}
                    className="px-1.5 py-2.5 text-danger/70 transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] hover:text-danger"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              )}
            </span>
          );
        })}

        {managing && (
          <button
            onClick={openAdd}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed px-3 py-2 text-sm text-text-muted hover:border-[var(--primary)] hover:text-primary"
          >
            <Plus size={14} /> Add industry
          </button>
        )}

        <button
          onClick={() => {
            setManaging((m) => !m);
            setEditState(null);
            setError(null);
          }}
          aria-label={managing ? "Done managing industries" : "Manage industries"}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
            managing
              ? "border-[var(--primary)] text-primary"
              : "text-text-muted hover:text-text hover:bg-surface-2"
          }`}
        >
          {managing ? <X size={14} /> : <Settings2 size={14} />}
          {managing ? "Done" : "Manage"}
        </button>
      </div>

      {error && !editState && <p className="mt-2 text-sm text-danger">{error}</p>}

      {editState && (
        <form
          onSubmit={save}
          className="mt-3 rounded-lg border bg-surface p-3"
        >
          {editState.mode === "add" && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-medium text-text-muted">Popular industries</p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_INDUSTRIES.map((pi) => (
                  <button
                    key={pi.name}
                    type="button"
                    onClick={() => {
                      setName(pi.name);
                      setIcon(pi.icon);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-[var(--primary)] hover:text-primary"
                  >
                    <IconByName name={pi.icon} size={12} /> {pi.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-text-muted">
              Industry name *
            </label>
            <input
              ref={nameInputRef}
              className={`${field} w-full`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="min-w-[200px] flex-[2]">
            <label className="mb-1 block text-xs font-medium text-text-muted">
              Rationale (why target it)
            </label>
            <input
              className={`${field} w-full`}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-text-muted">Icon</label>
            <select className={`${field} w-full`} value={icon} onChange={(e) => setIcon(e.target.value)}>
              {ICON_OPTIONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="btn-solid rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
          >
            {busy ? "Saving..." : editState.mode === "add" ? "Add" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditState(null)}
            className="rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-surface-2"
          >
            Cancel
          </button>
          {error && <p className="w-full text-sm text-danger">{error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
