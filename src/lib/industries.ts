// Top target industries per course, for sales targeting.
// Strategy: one curated default set per category (covers all 59 courses), plus an
// optional per-course override map for cases that differ from their category.
// `icon` is a lucide-react icon name resolved in IndustryGrid.

import { findCategoryForCourse } from "./courses";

export type Industry = { name: string; icon: string; rationale: string };

// Category slug -> its default target industries.
const INDUSTRIES_BY_CATEGORY: Record<string, Industry[]> = {
  "project-management-certification-courses": [
    {
      name: "IT/Technology",
      icon: "Cpu",
      rationale: "Large delivery orgs run constant multi-project portfolios needing certified PMs.",
    },
    {
      name: "Construction",
      icon: "HardHat",
      rationale: "Capital projects demand rigorous schedule, cost and risk management.",
    },
    {
      name: "Healthcare",
      icon: "HeartPulse",
      rationale: "Hospital builds, compliance and digital rollouts require structured PM.",
    },
    {
      name: "BFSI",
      icon: "Landmark",
      rationale: "Regulatory and transformation programs need disciplined project governance.",
    },
    {
      name: "Manufacturing",
      icon: "Factory",
      rationale: "Plant expansions and product launches run as tightly managed projects.",
    },
  ],
  "agile-certification-courses": [
    {
      name: "IT/Technology",
      icon: "Cpu",
      rationale: "Software teams adopt Scrum/Kanban at scale across product lines.",
    },
    {
      name: "BFSI",
      icon: "Landmark",
      rationale: "Digital banking pushes agile delivery for faster feature release.",
    },
    {
      name: "Telecom",
      icon: "RadioTower",
      rationale: "Network and OSS/BSS modernization runs on agile squads.",
    },
    {
      name: "E-commerce/Retail",
      icon: "ShoppingCart",
      rationale: "Rapid iteration on storefronts and apps favors agile roles.",
    },
    {
      name: "Media & Entertainment",
      icon: "Clapperboard",
      rationale: "Streaming and content platforms ship continuously with agile teams.",
    },
  ],
  "itsm-certification-courses": [
    {
      name: "IT/Technology",
      icon: "Cpu",
      rationale: "Service desks and ops teams standardize on ITIL practices.",
    },
    {
      name: "BFSI",
      icon: "Landmark",
      rationale: "Uptime and change control are business-critical for financial services.",
    },
    {
      name: "Telecom",
      icon: "RadioTower",
      rationale: "24x7 service assurance depends on mature ITSM processes.",
    },
    {
      name: "Government/Public Sector",
      icon: "Building2",
      rationale: "Citizen services require auditable, standardized IT service management.",
    },
    {
      name: "Healthcare",
      icon: "HeartPulse",
      rationale: "Clinical systems need reliable incident and change management.",
    },
  ],
  "quality-management-certification-courses": [
    {
      name: "Manufacturing",
      icon: "Factory",
      rationale: "Defect reduction and process control are core to plant performance.",
    },
    {
      name: "Automotive",
      icon: "Car",
      rationale: "Six Sigma and lean are standard for supplier quality and throughput.",
    },
    {
      name: "Healthcare",
      icon: "HeartPulse",
      rationale: "Patient-safety and process improvement drive quality programs.",
    },
    {
      name: "Pharmaceuticals",
      icon: "Pill",
      rationale: "Validated processes and CAPA demand strong quality skills.",
    },
    {
      name: "FMCG/Consumer Goods",
      icon: "Package",
      rationale: "High-volume lines rely on lean and variation reduction.",
    },
  ],
  "devops-certification-courses": [
    {
      name: "IT/Technology",
      icon: "Cpu",
      rationale: "CI/CD and platform teams upskill on DevOps toolchains.",
    },
    {
      name: "BFSI",
      icon: "Landmark",
      rationale: "Secure, compliant release automation is a top priority.",
    },
    {
      name: "E-commerce/Retail",
      icon: "ShoppingCart",
      rationale: "Peak-scale reliability needs automated delivery pipelines.",
    },
    {
      name: "Telecom",
      icon: "RadioTower",
      rationale: "Cloud-native network functions push DevOps adoption.",
    },
    {
      name: "SaaS/Gaming",
      icon: "Gamepad2",
      rationale: "Continuous deployment is a competitive requirement.",
    },
  ],
  "it-governance-certification-courses": [
    {
      name: "BFSI",
      icon: "Landmark",
      rationale: "Regulatory scrutiny drives demand for IT risk and control frameworks.",
    },
    {
      name: "IT/Technology",
      icon: "Cpu",
      rationale: "Enterprises formalize governance over sprawling IT estates.",
    },
    {
      name: "Government/Public Sector",
      icon: "Building2",
      rationale: "Public accountability requires COBIT-style governance.",
    },
    {
      name: "Insurance",
      icon: "ShieldCheck",
      rationale: "Data and model governance are compliance-critical.",
    },
    {
      name: "Energy & Utilities",
      icon: "Zap",
      rationale: "Critical infrastructure needs strong IT risk management.",
    },
  ],
};

// Optional per-course overrides (empty for now; category defaults cover all courses).
const INDUSTRIES_BY_COURSE: Record<string, Industry[]> = {};

export function getIndustriesForCourse(courseSlug: string): Industry[] {
  if (INDUSTRIES_BY_COURSE[courseSlug]) return INDUSTRIES_BY_COURSE[courseSlug];
  const category = findCategoryForCourse(courseSlug);
  if (category && INDUSTRIES_BY_CATEGORY[category.slug]) {
    return INDUSTRIES_BY_CATEGORY[category.slug];
  }
  return [];
}
