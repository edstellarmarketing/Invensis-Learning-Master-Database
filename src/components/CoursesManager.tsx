"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import type { Category } from "@/lib/courses";
import { useDialogA11y } from "@/lib/useDialogA11y";

// Full course + category CRUD. Persists via /api/categories and /api/courses, then
// refreshes the server tree so the sidebar and pages reflect changes.
//
// Rename/delete use inline controls (edit-in-place, two-click delete-confirm) instead of
// window.prompt()/window.confirm() - native browser dialogs here felt disconnected from
// the app (no styling, block the whole page, awkward on mobile) and read as broken.
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
  const [filter, setFilter] = useState("");
  const [newCat, setNewCat] = useState("");
  const [addCourseFor, setAddCourseFor] = useState<string | null>(null);
  const [courseName, setCourseName] = useState("");
  const [courseFeatured, setCourseFeatured] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  const [editingCourseName, setEditingCourseName] = useState("");
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<string | null>(null);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState<string | null>(null);
  const courseNameRef = useRef<HTMLInputElement>(null);
  const editCategoryRef = useRef<HTMLInputElement>(null);
  const editCourseRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogA11y(true, onClose, dialogRef);

  // A pending delete-confirm auto-cancels after a few seconds so it can't get stuck in
  // "confirm?" state if the user gets distracted and comes back later.
  useEffect(() => {
    if (!confirmDeleteCategory && !confirmDeleteCourse) return;
    const t = setTimeout(() => {
      setConfirmDeleteCategory(null);
      setConfirmDeleteCourse(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [confirmDeleteCategory, confirmDeleteCourse]);

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

  const startEditCategory = (slug: string, current: string) => {
    setEditingCategory(slug);
    setEditingCategoryName(current);
    requestAnimationFrame(() => editCategoryRef.current?.focus());
  };
  const saveEditCategory = async (slug: string) => {
    const name = editingCategoryName.trim();
    if (!name) return;
    if (await call("/api/categories", "PUT", { slug, name })) setEditingCategory(null);
  };

  const removeCategory = async (slug: string) => {
    if (confirmDeleteCategory !== slug) {
      setConfirmDeleteCategory(slug);
      setConfirmDeleteCourse(null);
      return;
    }
    setConfirmDeleteCategory(null);
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

  const startEditCourse = (slug: string, current: string) => {
    setEditingCourse(slug);
    setEditingCourseName(current);
    requestAnimationFrame(() => editCourseRef.current?.focus());
  };
  const saveEditCourse = async (slug: string) => {
    const name = editingCourseName.trim();
    if (!name) return;
    if (await call("/api/courses", "PUT", { slug, name })) setEditingCourse(null);
  };

  const toggleFeatured = async (slug: string, featured: boolean) =>
    call("/api/courses", "PUT", { slug, featured: !featured });

  const removeCourse = async (slug: string) => {
    if (confirmDeleteCourse !== slug) {
      setConfirmDeleteCourse(slug);
      setConfirmDeleteCategory(null);
      return;
    }
    setConfirmDeleteCourse(null);
    await call(`/api/courses?slug=${encodeURIComponent(slug)}`, "DELETE");
  };

  const field =
    "rounded-md border bg-bg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";
  const iconBtn =
    "rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 disabled:opacity-50";
  const iconBtnDanger =
    "rounded-md p-1.5 text-danger/70 transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] hover:text-danger disabled:opacity-50";

  const q = filter.trim().toLowerCase();
  const visibleCategories = q
    ? categories
        .map((cat) => ({
          ...cat,
          courses: cat.name.toLowerCase().includes(q)
            ? cat.courses
            : cat.courses.filter((co) => co.name.toLowerCase().includes(q)),
        }))
        .filter((cat) => cat.name.toLowerCase().includes(q) || cat.courses.length > 0)
    : categories;

  return createPortal(
    <div
      style={{ overflowAnchor: "none" }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
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

        <div className="shrink-0 border-b px-6 py-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter categories or courses..."
              className={`${field} w-full pl-8`}
              aria-label="Filter categories or courses"
            />
          </div>
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
          ) : visibleCategories.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-text-muted">
              No categories or courses match &quot;{filter}&quot;.
            </p>
          ) : (
            <div className="space-y-4">
              {visibleCategories.map((cat) => (
                <div key={cat.slug} className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b bg-surface-2/40 px-3 py-2">
                    {editingCategory === cat.slug ? (
                      <>
                        <input
                          ref={editCategoryRef}
                          className={`${field} flex-1`}
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditCategory(cat.slug);
                            if (e.key === "Escape") {
                              e.stopPropagation();
                              setEditingCategory(null);
                            }
                          }}
                        />
                        <button onClick={() => saveEditCategory(cat.slug)} disabled={busy || !editingCategoryName.trim()} aria-label="Save category name" className={`${iconBtn} hover:text-success`}>
                          <Check size={15} />
                        </button>
                        <button onClick={() => setEditingCategory(null)} aria-label="Cancel rename" className={iconBtn}>
                          <X size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-semibold">{cat.name}</span>
                        <span className="text-xs text-text-muted">{cat.courses.length}</span>
                        <button onClick={() => startEditCategory(cat.slug, cat.name)} disabled={busy} aria-label="Rename category" className={`${iconBtn} hover:text-primary`}>
                          <Pencil size={13} />
                        </button>
                        {confirmDeleteCategory === cat.slug ? (
                          <button
                            onClick={() => removeCategory(cat.slug)}
                            disabled={busy}
                            className="rounded-md bg-danger px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-danger/90"
                          >
                            Confirm delete?
                          </button>
                        ) : (
                          <button onClick={() => removeCategory(cat.slug)} disabled={busy} aria-label="Delete category" className={iconBtnDanger}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {cat.courses.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-text-muted">No courses in this category yet.</p>
                  ) : (
                    <ul className="divide-y">
                      {cat.courses.map((co) => (
                        <li key={co.slug} className="flex items-center gap-2 px-3 py-1.5">
                          {editingCourse === co.slug ? (
                            <>
                              <input
                                ref={editCourseRef}
                                className={`${field} flex-1`}
                                value={editingCourseName}
                                onChange={(e) => setEditingCourseName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditCourse(co.slug);
                                  if (e.key === "Escape") {
                                    e.stopPropagation();
                                    setEditingCourse(null);
                                  }
                                }}
                              />
                              <button onClick={() => saveEditCourse(co.slug)} disabled={busy || !editingCourseName.trim()} aria-label="Save course name" className={`${iconBtn} hover:text-success`}>
                                <Check size={15} />
                              </button>
                              <button onClick={() => setEditingCourse(null)} aria-label="Cancel rename" className={iconBtn}>
                                <X size={15} />
                              </button>
                            </>
                          ) : (
                            <>
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
                              <button onClick={() => startEditCourse(co.slug, co.name)} disabled={busy} aria-label="Rename course" className={`${iconBtn} hover:text-primary`}>
                                <Pencil size={13} />
                              </button>
                              {confirmDeleteCourse === co.slug ? (
                                <button
                                  onClick={() => removeCourse(co.slug)}
                                  disabled={busy}
                                  className="rounded-md bg-danger px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-danger/90"
                                >
                                  Confirm delete?
                                </button>
                              ) : (
                                <button onClick={() => removeCourse(co.slug)} disabled={busy} aria-label="Delete course" className={iconBtnDanger}>
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </>
                          )}
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
