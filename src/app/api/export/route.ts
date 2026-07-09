import { readCompanies } from "@/lib/companies";
import { readAllIndustries } from "@/lib/industries";
import { readCategories } from "@/lib/courses";

export const runtime = "nodejs";

// Full-database JSON export, served as a download.
export async function GET() {
  const [companies, industries, categories] = await Promise.all([
    readCompanies(),
    readAllIndustries(),
    readCategories(),
  ]);
  const payload = {
    format: "invensis-master-db",
    version: 2,
    exportedAt: new Date().toISOString(),
    categories,
    industries,
    companies,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="invensis-master-db-export.json"`,
    },
  });
}
