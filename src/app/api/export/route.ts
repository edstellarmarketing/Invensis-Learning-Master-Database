import { readCompanies } from "@/lib/companies";
import { readAllIndustries } from "@/lib/industries";

export const runtime = "nodejs";

// Full-database JSON export, served as a download.
export async function GET() {
  const [companies, industries] = await Promise.all([readCompanies(), readAllIndustries()]);
  const payload = {
    format: "invensis-master-db",
    version: 1,
    exportedAt: new Date().toISOString(),
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
