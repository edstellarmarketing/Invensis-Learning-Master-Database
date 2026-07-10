export const runtime = "nodejs";

// Lets the AI Search UI know which providers are actually usable before the user picks
// one and hits Search - without this, picking an unconfigured provider only fails after
// a full round-trip, which reads as broken rather than "you need to set a key". Booleans
// only - never echoes back key values or even whether a key "looks" valid.
export async function GET() {
  return Response.json({
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
  });
}
