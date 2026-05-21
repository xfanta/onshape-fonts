import { getEnv } from "./env";
import { TokenRecord, getTokenStore } from "./tokenStore";

const EXPIRY_SKEW_MS = 30_000;

export class OnshapeApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Onshape API ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
}

export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<TokenRecord> {
  const env = getEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: env.ONSHAPE_CLIENT_ID,
    client_secret: env.ONSHAPE_CLIENT_SECRET,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${env.ONSHAPE_OAUTH_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new OnshapeApiError(res.status, await res.text());
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<TokenRecord> {
  const env = getEnv();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.ONSHAPE_CLIENT_ID,
    client_secret: env.ONSHAPE_CLIENT_SECRET,
  });
  const res = await fetch(`${env.ONSHAPE_OAUTH_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new OnshapeApiError(res.status, await res.text());
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function getValidToken(userId: string): Promise<TokenRecord> {
  const store = getTokenStore();
  const record = await store.get(userId);
  if (!record) throw new Error("No Onshape token for user");
  if (Date.now() < record.expiresAt - EXPIRY_SKEW_MS) return record;
  const refreshed = await refreshAccessToken(record.refreshToken);
  await store.set(userId, refreshed);
  return refreshed;
}

async function rawFetch(
  userId: string,
  path: string,
  init: RequestInit,
  attempt = 0,
): Promise<Response> {
  const env = getEnv();
  const token = await getValidToken(userId);
  const url = path.startsWith("http") ? path : `${env.ONSHAPE_API_URL}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token.accessToken}`);
  headers.set("Accept", "application/json;charset=UTF-8; qs=0.09");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && attempt === 0) {
    const store = getTokenStore();
    const record = await store.get(userId);
    if (record) {
      const refreshed = await refreshAccessToken(record.refreshToken);
      await store.set(userId, refreshed);
      return rawFetch(userId, path, init, attempt + 1);
    }
  }
  return res;
}

export async function onshapeFetch<T = unknown>(
  userId: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await rawFetch(userId, path, init);
  const text = await res.text();
  const json = text ? safeJson(text) : undefined;
  if (!res.ok) {
    throw new OnshapeApiError(res.status, json ?? text);
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function getSessionInfo(
  userId: string,
): Promise<{ id: string; name: string; email?: string }> {
  return await onshapeFetch(userId, "/api/users/sessioninfo");
}

interface PartStudioRef {
  documentId: string;
  workspaceId: string;
  elementId: string;
}

export async function addTextToSketchFeature(
  userId: string,
  ref: PartStudioRef,
  options: {
    curveJson: string;
    scaleExpression: string;
    name?: string;
    sketchPlaneQueries?: unknown[];
  },
): Promise<unknown> {
  const env = getEnv();
  const namespace = `d${env.ONSHAPE_FS_DOCUMENT_ID}::v${env.ONSHAPE_FS_VERSION_ID}::e${env.ONSHAPE_FS_ELEMENT_ID}`;

  const body = {
    btType: "BTFeatureDefinitionCall-1406",
    feature: {
      btType: "BTMFeature-134",
      featureType: env.ONSHAPE_FS_FEATURE_NAME,
      namespace,
      name: options.name ?? "Text to Sketch",
      suppressed: false,
      parameters: [
        {
          btType: "BTMParameterQueryList-148",
          parameterId: "sketchPlane",
          queries: options.sketchPlaneQueries ?? [],
        },
        {
          btType: "BTMParameterQuantity-147",
          parameterId: "scale",
          expression: options.scaleExpression,
        },
        {
          btType: "BTMParameterString-149",
          parameterId: "curveData",
          value: options.curveJson,
        },
      ],
    },
  };

  return await onshapeFetch(
    userId,
    `/api/v9/partstudios/d/${ref.documentId}/w/${ref.workspaceId}/e/${ref.elementId}/features`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
