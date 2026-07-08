// Visual identity per course category: icon (lucide name) + color pair.
// Colors are inline-styled (Tailwind can't generate dynamic classes).
export type CategoryMeta = {
  icon: string;
  color: string; // strong hue (icon/text on soft bg)
  soft: string; // soft background
  darkColor: string; // strong hue on dark theme
  darkSoft: string; // soft background on dark theme
};

export const CATEGORY_META: Record<string, CategoryMeta> = {
  "project-management-certification-courses": {
    icon: "ClipboardList",
    color: "#4f46e5",
    soft: "#eef2ff",
    darkColor: "#a5b4fc",
    darkSoft: "#272a55",
  },
  "agile-certification-courses": {
    icon: "Rocket",
    color: "#059669",
    soft: "#ecfdf5",
    darkColor: "#6ee7b7",
    darkSoft: "#0d3b2e",
  },
  "itsm-certification-courses": {
    icon: "ServerCog",
    color: "#0284c7",
    soft: "#f0f9ff",
    darkColor: "#7dd3fc",
    darkSoft: "#0c3350",
  },
  "quality-management-certification-courses": {
    icon: "BadgeCheck",
    color: "#d97706",
    soft: "#fffbeb",
    darkColor: "#fcd34d",
    darkSoft: "#42300b",
  },
  "devops-certification-courses": {
    icon: "GitBranch",
    color: "#9333ea",
    soft: "#faf5ff",
    darkColor: "#d8b4fe",
    darkSoft: "#3b2154",
  },
  "it-governance-certification-courses": {
    icon: "ShieldCheck",
    color: "#e11d48",
    soft: "#fff1f2",
    darkColor: "#fda4af",
    darkSoft: "#4c1723",
  },
};

export const DEFAULT_CATEGORY_META: CategoryMeta = {
  icon: "Briefcase",
  color: "#4f46e5",
  soft: "#eef2ff",
  darkColor: "#a5b4fc",
  darkSoft: "#272a55",
};

export function getCategoryMeta(categorySlug: string | undefined): CategoryMeta {
  return (categorySlug && CATEGORY_META[categorySlug]) || DEFAULT_CATEGORY_META;
}
