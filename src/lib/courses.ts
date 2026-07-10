// Invensis Learning course catalog. Persistence: Upstash Redis when configured, local
// src/data/courses.json otherwise (same storage adapter as companies/industries).
// 6 categories, 59 courses seeded; catalog is runtime-editable via /api/courses +
// /api/categories. Slugs are the final path segment of each course URL.
import { readDataset, writeDataset, mutateDataset } from "./storage.ts";
import { slugify } from "./slug.ts";
import { mutateCompanies } from "./companies.ts";
import { mutateIndustries } from "./industries.ts";

export type Course = { name: string; slug: string; featured?: boolean };
export type Category = { name: string; slug: string; courses: Course[] };

export async function readCategories(): Promise<Category[]> {
  return readDataset<Category[]>("courses", []);
}

export async function writeCategories(categories: Category[]): Promise<void> {
  await writeDataset("courses", categories);
}

// Atomic read-modify-write - see mutateCompanies in lib/companies.ts for why.
export async function mutateCategories(
  fn: (categories: Category[]) => Category[] | Promise<Category[]>,
): Promise<Category[]> {
  return mutateDataset<Category[]>("courses", [], fn);
}

export async function readAllCourses(): Promise<Course[]> {
  return (await readCategories()).flatMap((c) => c.courses);
}

export async function findCourse(slug: string): Promise<Course | undefined> {
  return (await readAllCourses()).find((c) => c.slug === slug);
}

export async function findCategoryForCourse(slug: string): Promise<Category | undefined> {
  return (await readCategories()).find((cat) => cat.courses.some((c) => c.slug === slug));
}

// ----- Category CRUD -----

export async function addCategory(name: string): Promise<Category> {
  const slug = slugify(name);
  const trimmedName = name.trim();
  let cat!: Category;
  await mutateCategories((cats) => {
    // Seeded categories can carry legacy slugs (e.g. "devops-certification-courses")
    // that a freshly-typed name won't reproduce via slugify - so also check by name,
    // case-insensitively, or a duplicate silently gets a second, differently-slugged entry.
    if (cats.some((c) => c.slug === slug || c.name.toLowerCase() === trimmedName.toLowerCase()))
      throw new Error(`Category "${name}" already exists`);
    cat = { name: trimmedName, slug, courses: [] };
    return [...cats, cat];
  });
  return cat;
}

export async function updateCategory(slug: string, name: string): Promise<Category> {
  const trimmedName = name.trim();
  let updated!: Category;
  await mutateCategories((cats) => {
    const cat = cats.find((c) => c.slug === slug);
    if (!cat) throw new Error("Category not found");
    if (cats.some((c) => c.slug !== slug && c.name.toLowerCase() === trimmedName.toLowerCase()))
      throw new Error(`Category "${name}" already exists`);
    updated = { ...cat, name: trimmedName };
    return cats.map((c) => (c.slug === slug ? updated : c));
  });
  return updated;
}

export async function deleteCategory(slug: string): Promise<void> {
  let removedCourseSlugs: string[] = [];
  await mutateCategories((cats) => {
    const cat = cats.find((c) => c.slug === slug);
    if (!cat) throw new Error("Category not found");
    removedCourseSlugs = cat.courses.map((c) => c.slug);
    return cats.filter((c) => c.slug !== slug);
  });
  // Cascade: a deleted category takes its courses with it, so their industries and
  // companies must go too - otherwise they're orphaned and silently resurrected if a
  // course with the same name/slug is ever recreated.
  await cascadeDeleteCourses(removedCourseSlugs);
}

// ----- Course CRUD -----

export async function addCourse(
  categorySlug: string,
  name: string,
  slug?: string,
  featured?: boolean,
): Promise<Course> {
  const courseSlug = (slug || slugify(name)).trim();
  const trimmedName = name.trim();
  let course!: Course;
  await mutateCategories((cats) => {
    const cat = cats.find((c) => c.slug === categorySlug);
    if (!cat) throw new Error("Category not found");
    // Seeded courses can carry legacy slugs (e.g. "pmp-certification-training") that a
    // freshly-typed name won't reproduce via slugify - also check by name, case-insensitively.
    const allCourses = cats.flatMap((c) => c.courses);
    if (
      allCourses.some(
        (co) => co.slug === courseSlug || co.name.toLowerCase() === trimmedName.toLowerCase(),
      )
    )
      throw new Error(`A course named "${name}" already exists`);
    course = { name: trimmedName, slug: courseSlug, ...(featured ? { featured: true } : {}) };
    return cats.map((c) => (c.slug === categorySlug ? { ...c, courses: [...c.courses, course] } : c));
  });
  return course;
}

export async function updateCourse(
  slug: string,
  patch: { name?: string; featured?: boolean; categorySlug?: string },
): Promise<Course> {
  let updated!: Course;
  await mutateCategories((cats) => {
    let found: Course | undefined;
    let currentCat: Category | undefined;
    for (const cat of cats) {
      const co = cat.courses.find((c) => c.slug === slug);
      if (co) {
        found = co;
        currentCat = cat;
        break;
      }
    }
    if (!found || !currentCat) throw new Error("Course not found");

    updated = { ...found };
    if (patch.name !== undefined) {
      const trimmedName = patch.name.trim();
      const allCourses = cats.flatMap((c) => c.courses);
      if (allCourses.some((co) => co !== found && co.name.toLowerCase() === trimmedName.toLowerCase()))
        throw new Error(`A course named "${patch.name}" already exists`);
      updated.name = trimmedName;
    }
    if (patch.featured !== undefined) {
      if (patch.featured) updated.featured = true;
      else delete updated.featured;
    }
    const targetCategorySlug =
      patch.categorySlug && patch.categorySlug !== currentCat.slug ? patch.categorySlug : currentCat.slug;
    if (targetCategorySlug !== currentCat.slug && !cats.some((c) => c.slug === targetCategorySlug))
      throw new Error("Target category not found");

    return cats.map((c) => {
      if (c.slug === currentCat!.slug && c.slug === targetCategorySlug) {
        return { ...c, courses: c.courses.map((co) => (co.slug === slug ? updated : co)) };
      }
      if (c.slug === currentCat!.slug) {
        return { ...c, courses: c.courses.filter((co) => co.slug !== slug) };
      }
      if (c.slug === targetCategorySlug) {
        return { ...c, courses: [...c.courses, updated] };
      }
      return c;
    });
  });
  return updated;
}

export async function deleteCourse(slug: string): Promise<void> {
  await mutateCategories((cats) => {
    let removed = false;
    const next = cats.map((cat) => {
      const before = cat.courses.length;
      const courses = cat.courses.filter((c) => c.slug !== slug);
      if (courses.length !== before) removed = true;
      return { ...cat, courses };
    });
    if (!removed) throw new Error("Course not found");
    return next;
  });
  // Cascade: matches deleteIndustry's behavior - a deleted course's industries and
  // companies are deleted too, not left as orphans a same-named course would resurrect.
  await cascadeDeleteCourses([slug]);
}

async function cascadeDeleteCourses(courseSlugs: string[]): Promise<void> {
  if (courseSlugs.length === 0) return;
  const slugSet = new Set(courseSlugs);
  await mutateIndustries((all) => {
    const next = { ...all };
    for (const cs of courseSlugs) delete next[cs];
    return next;
  });
  await mutateCompanies((companies) => companies.filter((c) => !slugSet.has(c.courseSlug)));
}
