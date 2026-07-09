// Invensis Learning course catalog. Persistence: Upstash Redis when configured, local
// src/data/courses.json otherwise (same storage adapter as companies/industries).
// 6 categories, 59 courses seeded; catalog is runtime-editable via /api/courses +
// /api/categories. Slugs are the final path segment of each course URL.
import { readDataset, writeDataset } from "./storage";
import { slugify } from "./slug";

export type Course = { name: string; slug: string; featured?: boolean };
export type Category = { name: string; slug: string; courses: Course[] };

export async function readCategories(): Promise<Category[]> {
  return readDataset<Category[]>("courses", []);
}

export async function writeCategories(categories: Category[]): Promise<void> {
  await writeDataset("courses", categories);
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
  const cats = await readCategories();
  const slug = slugify(name);
  const trimmedName = name.trim();
  // Seeded categories can carry legacy slugs (e.g. "devops-certification-courses")
  // that a freshly-typed name won't reproduce via slugify - so also check by name,
  // case-insensitively, or a duplicate silently gets a second, differently-slugged entry.
  if (
    cats.some((c) => c.slug === slug || c.name.toLowerCase() === trimmedName.toLowerCase())
  )
    throw new Error(`Category "${name}" already exists`);
  const cat: Category = { name: trimmedName, slug, courses: [] };
  cats.push(cat);
  await writeCategories(cats);
  return cat;
}

export async function updateCategory(slug: string, name: string): Promise<Category> {
  const cats = await readCategories();
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) throw new Error("Category not found");
  const trimmedName = name.trim();
  if (cats.some((c) => c.slug !== slug && c.name.toLowerCase() === trimmedName.toLowerCase()))
    throw new Error(`Category "${name}" already exists`);
  cat.name = trimmedName;
  await writeCategories(cats);
  return cat;
}

export async function deleteCategory(slug: string): Promise<void> {
  const cats = await readCategories();
  const next = cats.filter((c) => c.slug !== slug);
  if (next.length === cats.length) throw new Error("Category not found");
  await writeCategories(next);
}

// ----- Course CRUD -----

export async function addCourse(
  categorySlug: string,
  name: string,
  slug?: string,
  featured?: boolean,
): Promise<Course> {
  const cats = await readCategories();
  const cat = cats.find((c) => c.slug === categorySlug);
  if (!cat) throw new Error("Category not found");
  const courseSlug = (slug || slugify(name)).trim();
  const trimmedName = name.trim();
  // Seeded courses can carry legacy slugs (e.g. "pmp-certification-training") that a
  // freshly-typed name won't reproduce via slugify - also check by name, case-insensitively.
  const allCourses = cats.flatMap((c) => c.courses);
  if (
    allCourses.some(
      (co) => co.slug === courseSlug || co.name.toLowerCase() === trimmedName.toLowerCase(),
    )
  )
    throw new Error(`A course named "${name}" already exists`);
  const course: Course = { name: trimmedName, slug: courseSlug, ...(featured ? { featured: true } : {}) };
  cat.courses.push(course);
  await writeCategories(cats);
  return course;
}

export async function updateCourse(
  slug: string,
  patch: { name?: string; featured?: boolean; categorySlug?: string },
): Promise<Course> {
  const cats = await readCategories();
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

  if (patch.name !== undefined) {
    const trimmedName = patch.name.trim();
    const allCourses = cats.flatMap((c) => c.courses);
    if (allCourses.some((co) => co !== found && co.name.toLowerCase() === trimmedName.toLowerCase()))
      throw new Error(`A course named "${patch.name}" already exists`);
    found.name = trimmedName;
  }
  if (patch.featured !== undefined) {
    if (patch.featured) found.featured = true;
    else delete found.featured;
  }
  // Move to a different category if requested.
  if (patch.categorySlug && patch.categorySlug !== currentCat.slug) {
    const target = cats.find((c) => c.slug === patch.categorySlug);
    if (!target) throw new Error("Target category not found");
    currentCat.courses = currentCat.courses.filter((c) => c.slug !== slug);
    target.courses.push(found);
  }
  await writeCategories(cats);
  return found;
}

export async function deleteCourse(slug: string): Promise<void> {
  const cats = await readCategories();
  let removed = false;
  for (const cat of cats) {
    const before = cat.courses.length;
    cat.courses = cat.courses.filter((c) => c.slug !== slug);
    if (cat.courses.length !== before) removed = true;
  }
  if (!removed) throw new Error("Course not found");
  await writeCategories(cats);
}
