import { z } from "zod";

const schema = z.object({
  ONSHAPE_CLIENT_ID: z.string().min(1),
  ONSHAPE_CLIENT_SECRET: z.string().min(1),
  ONSHAPE_OAUTH_URL: z.string().url().default("https://oauth.onshape.com"),
  ONSHAPE_API_URL: z.string().url().default("https://cad.onshape.com"),
  ONSHAPE_REDIRECT_URI: z.string().url().optional(),
  ONSHAPE_FS_DOCUMENT_ID: z.string().min(1),
  ONSHAPE_FS_VERSION_ID: z.string().min(1),
  ONSHAPE_FS_ELEMENT_ID: z.string().min(1),
  ONSHAPE_FS_FEATURE_NAME: z.string().default("textToSketch"),
  SESSION_SECRET: z.string().min(32),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
});

let cached: z.infer<typeof schema> | null = null;

export function getEnv() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function redirectUriFromRequest(request: Request): string {
  const env = getEnv();
  if (env.ONSHAPE_REDIRECT_URI) return env.ONSHAPE_REDIRECT_URI;
  const url = new URL(request.url);
  return `${url.origin}/api/oauth/callback`;
}
