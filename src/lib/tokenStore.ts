import { getEnv } from "./env";

export interface TokenRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface TokenStore {
  get(userId: string): Promise<TokenRecord | null>;
  set(userId: string, record: TokenRecord): Promise<void>;
  delete(userId: string): Promise<void>;
}

const memory = new Map<string, TokenRecord>();

class MemoryStore implements TokenStore {
  async get(userId: string) {
    return memory.get(userId) ?? null;
  }
  async set(userId: string, record: TokenRecord) {
    memory.set(userId, record);
  }
  async delete(userId: string) {
    memory.delete(userId);
  }
}

class VercelKvStore implements TokenStore {
  async get(userId: string) {
    const { kv } = await import("@vercel/kv");
    return (await kv.get<TokenRecord>(`onshape:token:${userId}`)) ?? null;
  }
  async set(userId: string, record: TokenRecord) {
    const { kv } = await import("@vercel/kv");
    await kv.set(`onshape:token:${userId}`, record);
  }
  async delete(userId: string) {
    const { kv } = await import("@vercel/kv");
    await kv.del(`onshape:token:${userId}`);
  }
}

let cached: TokenStore | null = null;

export function getTokenStore(): TokenStore {
  if (cached) return cached;
  const env = getEnv();
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    cached = new VercelKvStore();
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[tokenStore] Falling back to in-memory store in production — tokens will be lost on restart. Configure Vercel KV.",
      );
    }
    cached = new MemoryStore();
  }
  return cached;
}
