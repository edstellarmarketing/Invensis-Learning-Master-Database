"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Star, Trash2, X } from "lucide-react";
import type { Category } from "@/lib/courses";
import { useDialogA11y } from "@/lib/useDialogA11y";

// Full course + category CRUD. Persists via /api/categories and /api/courses, then
// refreshes the server tree so the sidebar and pages reflect changes.
export default function CoursesManager({
  categories,
  onClose,
}: {
  categories: Category[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [addCourseFor, setAddCourseFor] = useState<string | null>(null);
  const [courseName, setCourseName] = useState("");
  const [courseFeatured, setCourseFeatured] = useState(false);
  const courseNameRef = useRef<HTMLInputElement>(null);

  useDialogA11y(true, onClose);

  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    if (await call("/api/categories", "POST", { name: newCat.trim() })) setNewCat("");
  };
  const renameCategory = async (slug: string, current: string) => {
    const name = window.prompt("Rename category", current);
    if (name && name.trim() && name !== current) await call("/api/categories", "PUT", { slug, name });
  };
  const removeCategory = async (slug: string, name: string, n: number) => {
    if (window.confirm(`Delete category "${name}" and its ${n} course(s)?`))
      await call(`/api/categories?slug=${encodeURIComponent(slug)}`, "DELETE");
  };
  const startAddCourse = (categorySlug: string) => {
    setAddCourseFor(categorySlug);
    setCourseName("");
    setCourseFeatured(false);
    // Focus without letting the browser auto-scroll the list away from where it is.
    requestAnimationFrame(() => courseNameRef.current?.focus({ preventScroll: true }));
  };
  const addCourseSubmit = async (categorySlug: string) => {
    if (!courseName.trim()) return;
    if (
      await call("/api/courses", "POST", {
        categorySlug,
        name: courseName.trim(),
        featured: courseFeatured,
      })
    ) {
      setCourseName("");
      setCourseFeatured(false);
      setAddCourseFor(null);
    }
  };
  const renameCourse = async (slug: string, current: string) => {
    const name = window.prompt("Rename course", current);
    if (name && name.trim() && name !== current) await call("/api/courses", "PUT", { slug, name });
  };
  const toggleFeatured = async (slug: string, featured: boolean) =>
    call("/api/courses", "PUT", { slug, featured: !featured });
  const removeCourse = async (slug: string, name: string) => {
    if (window.confirm(`Delete course "${name}"? Its industries and companies are not deleted but become unreachable.`))
      await call(`/api/courses?slug=${encodeURIComponent(slug)}`, "DELETE");
  };

  const field =
    "rounded-md border bg-bg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";
  const iconBtn =
    "rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 disabled:opacity-50";
  const iconBtnDanger =
    "rounded-md p-1.5 text-danger/70 transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] hover:text-danger disabled:opacity-50";

  return createPortal(
    <div
      style={{ overflowAnchor: "none" }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="courses-manager-title"
      >
        <div className="band-gradient-soft flex shrink-0 items-center justify-between rounded-t-2xl border-b px-6 py-4">
          <h2 id="courses-manager-title" className="text-lg font-bold">
            Manage courses &amp; categories
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text">
            <X size={18} />
          </button>
        </div>

        {/* Card is height-capped (max-h-[85vh] above) with this as its only scroll
            region, so header+content can never together exceed the viewport. */}
        <div
          style={{ overflowAnchor: "none" }}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
        >
          {error && (
            <p className="mb-3 rounded-md bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="mb-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-text-muted">New category</label>
              <input className={`${field} w-full`} value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Cybersecurity" />
            </div>
            <button
              onClick={addCategory}
              disabled={busy || !newCat.trim()}
              className="btn-solid inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
            >
              <Plus size={14} /> Add category
            </button>
          </div>

          {categories.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-text-muted">
              No categories yet. Add one above to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {categories.map((cat) => (
                <div key={cat.slug} className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b bg-surface-2/40 px-3 py-2">
                    <span className="flex-1 text-sm font-semibold">{cat.name}</span>
                    <span className="text-xs text-text-muted">{cat.courses.length}</span>
                    <button onClick={() => renameCategory(cat.slug, cat.name)} disabled={busy} aria-label="Rename category" className={`${iconBtn} hover:text-primary`}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => removeCategory(cat.slug, cat.name, cat.courses.length)} disabled={busy} aria-label="Delete category" className={iconBtnDanger}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {cat.courses.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-text-muted">No courses in this category yet.</p>
                  ) : (
                    <ul className="divide-y">
                      {cat.courses.map((co) => (
                        <li key={co.slug} className="flex items-center gap-2 px-3 py-1.5">
                          <button
                            onClick={() => toggleFeatured(co.slug, Boolean(co.featured))}
                            disabled={busy}
                            aria-label={co.featured ? "Unfeature" : "Feature"}
                            title={co.featured ? "Featured (click to unfeature)" : "Not featured (click to feature)"}
                            className={`rounded-md p-1 transition-colors ${co.featured ? "text-warning" : "text-text-muted hover:text-warning"}`}
                          >
                            <Star size={14} fill={co.featured ? "currentColor" : "none"} />
                          </button>
                          <span className="flex-1 text-sm">{co.name}</span>
                          <button onClick={() => renameCourse(co.slug, co.name)} disabled={busy} aria-label="Rename course" className={`${iconBtn} hover:text-primary`}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => removeCourse(co.slug, co.name)} disabled={busy} aria-label="Delete course" className={iconBtnDanger}>
                            <Trash2 size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="border-t px-3 py-2">
                    {addCourseFor === cat.slug ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <input
                          ref={courseNameRef}
                          className={`${field} min-w-[160px] flex-1`}
                          value={courseName}
                          onChange={(e) => setCourseName(e.target.value)}
                          placeholder="Course name"
                        />
                        <label className="inline-flex items-center gap-1.5 text-sm text-text-muted">
                          <input type="checkbox" checked={courseFeatured} onChange={(e) => setCourseFeatured(e.target.checked)} className="size-3.5 accent-[var(--primary)]" /> Featured
                        </label>
                        <button onClick={() => addCourseSubmit(cat.slug)} disabled={busy || !courseName.trim()} className="btn-solid rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60">
                          Add
                        </button>
                        <button onClick={() => setAddCourseFor(null)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-surface-2">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startAddCourse(cat.slug)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <Plus size={13} /> Add course
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
