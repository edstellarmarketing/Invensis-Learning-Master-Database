import Link from "next/link";
import {
  Cpu,
  HardHat,
  HeartPulse,
  Landmark,
  Factory,
  RadioTower,
  ShoppingCart,
  Clapperboard,
  Building2,
  Car,
  Pill,
  Package,
  Gamepad2,
  ShieldCheck,
  Zap,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { getIndustriesForCourse } from "@/lib/industries";
import { slugify } from "@/lib/slug";

const ICONS: Record<string, LucideIcon> = {
  Cpu,
  HardHat,
  HeartPulse,
  Landmark,
  Factory,
  RadioTower,
  ShoppingCart,
  Clapperboard,
  Building2,
  Car,
  Pill,
  Package,
  Gamepad2,
  ShieldCheck,
  Zap,
};

export default function IndustryGrid({
  courseSlug,
  activeIndustrySlug,
}: {
  courseSlug: string;
  activeIndustrySlug?: string;
}) {
  const industries = getIndustriesForCourse(courseSlug);

  if (industries.length === 0) {
    return <p className="text-text-muted">No target industries configured for this course yet.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {industries.map((ind) => {
        const iSlug = slugify(ind.name);
        const active = iSlug === activeIndustrySlug;
        const Icon = ICONS[ind.icon] ?? Briefcase;
        return (
          <Link
            key={iSlug}
            href={`/${courseSlug}/${iSlug}`}
            className={`group rounded-lg border p-4 transition-colors ${
              active
                ? "border-[var(--primary)] bg-surface ring-2 ring-[var(--ring)]"
                : "bg-surface hover:border-[var(--primary)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`grid place-items-center rounded-md p-1.5 ${
                  active ? "bg-primary text-primary-contrast" : "bg-surface-2 text-primary"
                }`}
              >
                <Icon size={18} />
              </span>
              <span className="font-medium">{ind.name}</span>
            </div>
            <p className="mt-2 text-sm text-text-muted">{ind.rationale}</p>
          </Link>
        );
      })}
    </div>
  );
}
