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

// The Vercel Upstash integration may inject either UPSTASH_REDIS_REST_* or KV_REST_API_*.
function kvCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function kvConfigured(): boolean {
  return kvCredentials() !== null;
}

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const creds = kvCredentials();
  redis = creds ? new Redis(creds) : null;
  return redis;
}

function dataFile(name: string): string {
  // Test-only override so lib tests exercise the real read/write/lock path against a
  // throwaway directory instead of the app's actual seed files under src/data.
  const dir = process.env.INVENSIS_TEST_DATA_DIR
    ? path.resolve(process.env.INVENSIS_TEST_DATA_DIR)
    : path.join(process.cwd(), "src", "data");
  return path.join(dir, `${name}.json`);
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

// Every dataset is stored whole under one key, so concurrent read-modify-write calls
// (two admin tabs, or a bulk import racing a manual edit) can silently lose an update -
// the second full-array write clobbers the first. mutateDataset closes that window with
// a lock: Redis SET NX in production (a real lock shared across serverless instances),
// an in-process mutex in local dev (single Node process, no Redis to lock against).
// Best-effort, not a hard guarantee: if a lock can't be acquired within the deadline, the
// mutation still runs rather than failing the request - this shrinks the race window from
// "every write" down to "only under sustained contention," which is the realistic threat
// here (occasional concurrent edits, not high write throughput).
const localMutex = new Map<string, Promise<unknown>>();

async function withLocalLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const prev = localMutex.get(name) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  // Swallow so a failed mutation doesn't wedge the queue for the next caller.
  localMutex.set(
    name,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

async function withRedisLock<T>(r: Redis, name: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = `${KEY_PREFIX}lock:${name}`;
  const token = Math.random().toString(36).slice(2);
  const deadline = Date.now() + 5000;
  let acquired = false;
  while (Date.now() < deadline) {
    acquired = (await r.set(lockKey, token, { nx: true, px: 5000 })) !== null;
    if (acquired) break;
    await new Promise((res) => setTimeout(res, 50 + Math.random() * 100));
  }
  try {
    return await fn();
  } finally {
    if (acquired) {
      try {
        if ((await r.get<string>(lockKey)) === token) await r.del(lockKey);
      } catch {
        // Lock release is best-effort; the TTL reclaims it either way.
      }
    }
  }
}

export async function mutateDataset<T>(
  name: string,
  fallback: T,
  mutator: (current: T) => T | Promise<T>,
): Promise<T> {
  const r = getRedis();
  const run = async () => {
    const current = await readDataset<T>(name, fallback);
    const next = await mutator(current);
    await writeDataset(name, next);
    return next;
  };
  return r ? withRedisLock(r, name, run) : withLocalLock(name, run);
}

// Short-lived cache entries (e.g. AI search results). No-ops without Redis - local dev
// always misses, which is the right behavior for testing live searches.
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return (await r.get<T>(`${KEY_PREFIX}cache:${key}`)) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(`${KEY_PREFIX}cache:${key}`, value, { ex: ttlSeconds });
  } catch {
    // Cache write failures are non-fatal.
  }
}

// Fixed-window counter for rate limiting (e.g. per-IP search requests). Returns null
// when Redis isn't configured - local dev has no shared counter to rate-limit against,
// and a single developer hitting their own dev server isn't the threat this guards.
export async function incrementWithExpiry(key: string, windowSeconds: number): Promise<number | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const fullKey = `${KEY_PREFIX}ratelimit:${key}`;
    const count = await r.incr(fullKey);
    if (count === 1) await r.expire(fullKey, windowSeconds);
    return count;
  } catch {
    return null; // Rate-limit check failures should never block a real request.
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
