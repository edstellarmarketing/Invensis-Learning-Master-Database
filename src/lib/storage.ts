// Storage adapter: Upstash Redis when configured (production / Vercel),
// local JSON files otherwise (development).
//
// The two datasets are small, so each is stored whole under one Redis key.
// On first read with an empty key, the bundled JSON seed ships inside the
// build and is used as the initial value.
import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

const KEY_PREFIX = "invensis-master-db:";

let redis: Redis | null | undefined;

export function kvConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  redis = kvConfigured() ? Redis.fromEnv() : null;
  return redis;
}

function dataFile(name: string): string {
  return path.join(process.cwd(), "src", "data", `${name}.json`);
}

async function readSeedFile<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(dataFile(name), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

// Read a dataset ("companies" | "industries"). KV first, seed file as initial value.
export async function readDataset<T>(name: string, fallback: T): Promise<T> {
  const r = getRedis();
  if (r) {
    const value = await r.get<T>(KEY_PREFIX + name);
    if (value !== null && value !== undefined) return value;
    // First run against an empty database: seed from the bundled JSON.
    const seed = await readSeedFile(name, fallback);
    try {
      await r.set(KEY_PREFIX + name, seed);
    } catch {
      // Seeding is best-effort; reads still work from the bundle.
    }
    return seed;
  }
  return readSeedFile(name, fallback);
}

// Write a dataset. KV when configured; local file otherwise.
export async function writeDataset<T>(name: string, value: T): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(KEY_PREFIX + name, value);
    return;
  }
  try {
    await fs.writeFile(dataFile(name), JSON.stringify(value, null, 2) + "\n", "utf-8");
  } catch (err) {
    throw friendlyWriteError(err);
  }
}

// Read-only serverless filesystems: surface clearly instead of a 500.
export function friendlyWriteError(err: unknown): Error {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
    return new Error(
      "This deployment has a read-only filesystem and no database is connected. " +
        "Add the Upstash Redis integration (Vercel > Storage) and redeploy to enable saving.",
    );
  }
  return err instanceof Error ? err : new Error("Write failed");
}
