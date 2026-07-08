// Authoritative Invensis Learning course catalog.
// Source: sibling project databases/category_db.py, cross-checked against the live
// sitemap https://www.invensislearning.com/home-sitemap
// 6 categories, 59 courses. Slugs are the final path segment of each course URL.

export type Course = { name: string; slug: string };
export type Category = { name: string; slug: string; courses: Course[] };

export const CATEGORIES: Category[] = [
  {
    name: "Project Management",
    slug: "project-management-certification-courses",
    courses: [
      { name: "PMP Certification", slug: "pmp-certification-training" },
      { name: "CAPM Exam Prep", slug: "capm-certification-training" },
      {
        name: "PRINCE2 Foundation & Practitioner",
        slug: "prince2-foundation-practitioner-certification-training",
      },
      { name: "PRINCE2 Foundation", slug: "prince2-foundation-certification-training" },
      { name: "PRINCE2 Practitioner", slug: "prince2-practitioner-certification-training" },
      {
        name: "Change Management Foundation & Practitioner",
        slug: "change-management-certification",
      },
      { name: "Lean Project Management", slug: "lean-project-management-certification-training" },
      {
        name: "Project Management Fundamentals",
        slug: "project-management-fundamentals-training",
      },
      { name: "Microsoft Project Training", slug: "microsoft-project-training" },
      { name: "Oracle Primavera P6 Training", slug: "oracle-primavera-p6-certification-training" },
      { name: "JIRA Training", slug: "jira-certification-training" },
      {
        name: "Business Analysis Foundation & Practitioner",
        slug: "business-analysis-certification",
      },
      { name: "PgMP (Program Management Professional)", slug: "pgmp-certification-training" },
      { name: "PfMP (Portfolio Management Professional)", slug: "pfmp-certification-training" },
      { name: "PMI-RMP (Risk Management Professional)", slug: "pmi-rmp-certification-training" },
      { name: "PMI-CP (Construction Professional)", slug: "pmi-cp-certification-training" },
    ],
  },
  {
    name: "Agile",
    slug: "agile-certification-courses",
    courses: [
      { name: "PMI-ACP Exam Prep Training", slug: "pmi-acp-certification-training" },
      {
        name: "Agile Scrum Foundation Certification",
        slug: "agile-scrum-foundation-certification-training",
      },
      { name: "Agile Scrum Master (ASM) Certification", slug: "agile-scrum-master" },
      {
        name: "PRINCE2 Agile Foundation & Practitioner",
        slug: "prince2-agile-foundation-practitioner-certification-training",
      },
      { name: "Scrum Fundamentals Training", slug: "scrum-fundamentals-certification-training" },
      { name: "Certified ScrumMaster (CSM)", slug: "csm-certification-training" },
      { name: "Certified Scrum Product Owner (CSPO)", slug: "cspo-certification-training" },
      { name: "Agile PM Foundation & Practitioner", slug: "agile-pm-certification" },
      { name: "Kanban Training", slug: "kanban-training" },
    ],
  },
  {
    name: "IT Service Management (ITSM)",
    slug: "itsm-certification-courses",
    courses: [
      { name: "ITIL V5 Foundation Bridge", slug: "itil-v5-foundation-bridge-training-course" },
      { name: "ITIL V5 Foundation", slug: "itil-v5-foundation-certification-training" },
      { name: "ITIL 4 Foundation", slug: "itil-4-foundation-certification-training" },
      { name: "VeriSM Foundation", slug: "verism-foundation-certification-training" },
      { name: "SIAM Foundation", slug: "siam-foundation-certification-training" },
      { name: "SIAM Professional", slug: "siam-professional-certification-training" },
    ],
  },
  {
    name: "Quality Management",
    slug: "quality-management-certification-courses",
    courses: [
      {
        name: "Lean Six Sigma Yellow Belt",
        slug: "lean-six-sigma-yellow-belt-certification-training",
      },
      {
        name: "Lean Six Sigma Green Belt",
        slug: "lean-six-sigma-green-belt-certification-training",
      },
      {
        name: "Lean Six Sigma Black Belt",
        slug: "lean-six-sigma-black-belt-certification-training",
      },
      { name: "Value Stream Mapping", slug: "value-stream-mapping-training" },
      { name: "Poka Yoke Training", slug: "poka-yoke-training" },
      { name: "Kaizen Training", slug: "kaizen-training" },
      { name: "Business Process Management", slug: "business-process-management-training" },
      { name: "Minitab Essentials", slug: "minitab-essentials-training" },
      { name: "Six Sigma Awareness", slug: "six-sigma-awareness-training" },
      { name: "Design for Six Sigma", slug: "design-for-six-sigma-training" },
      { name: "Lean Fundamentals", slug: "lean-fundamentals-training" },
      { name: "Lean IT Foundation", slug: "lean-it-training" },
      { name: "Quality by Design", slug: "quality-by-design-training" },
      { name: "Quality Function Deployment", slug: "quality-function-deployment-training" },
      { name: "Root Cause Analysis", slug: "root-cause-analysis-training" },
      { name: "7 QC Tools", slug: "7-qc-tools-training" },
      { name: "Lean Manufacturing", slug: "lean-manufacturing-training-course" },
    ],
  },
  {
    name: "DevOps",
    slug: "devops-certification-courses",
    courses: [
      { name: "DevOps Foundation", slug: "devops-foundation-certification-training" },
      { name: "DevOps Master", slug: "devops-master-certification-training" },
      {
        name: "Observability Foundation",
        slug: "observability-foundation-certification-course",
      },
      { name: "AWS DevOps", slug: "aws-devops-training-course" },
      { name: "Azure DevOps", slug: "azure-devops-training-course" },
    ],
  },
  {
    name: "IT Governance",
    slug: "it-governance-certification-courses",
    courses: [
      { name: "CGEIT Certification", slug: "cgeit-certification-training" },
      { name: "CRISC Certification", slug: "crisc-certification-training" },
      { name: "COBIT 5 (Combined)", slug: "cobit-5-certification" },
      { name: "COBIT 5 Foundation", slug: "cobit-5-foundation-certification-training" },
      { name: "COBIT 5 Implementation", slug: "cobit-5-implementation-certification-training" },
      { name: "COBIT 5 Assessor", slug: "cobit-5-assessor-certification-training" },
    ],
  },
];

// Flat lookup helpers.
export const ALL_COURSES: Course[] = CATEGORIES.flatMap((c) => c.courses);

export function findCourse(slug: string): Course | undefined {
  return ALL_COURSES.find((c) => c.slug === slug);
}

export function findCategoryForCourse(slug: string): Category | undefined {
  return CATEGORIES.find((cat) => cat.courses.some((c) => c.slug === slug));
}
