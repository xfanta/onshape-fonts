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

interface ResolvedFsRef {
  fsElementId: string;
  microversionId: string;
}

const fsRefCache = new Map<string, ResolvedFsRef>();

/**
 * Resolve the internal element-id and microversion-id of our published
 * FeatureScript element. The values in ONSHAPE_FS_ELEMENT_ID/VERSION_ID
 * are the *URL* ids; Onshape's `namespace` field for BTMFeature-134
 * needs the internal FS element id plus the microversion that the
 * version points to.
 *
 * Format empirically discovered to be: `e<fsElementId>::m<microversionId>`.
 */
export async function resolvePublishedFsRef(userId: string): Promise<ResolvedFsRef> {
  const env = getEnv();
  const cacheKey = `${env.ONSHAPE_FS_DOCUMENT_ID}/${env.ONSHAPE_FS_VERSION_ID}`;
  const cached = fsRefCache.get(cacheKey);
  if (cached) return cached;

  // Elements at this version — find the Feature Studio (or by id match).
  const elements = await onshapeFetch<
    {
      id: string;
      name: string;
      elementType: string;
      microversionId: string;
    }[]
  >(
    userId,
    `/api/v9/documents/d/${env.ONSHAPE_FS_DOCUMENT_ID}/v/${env.ONSHAPE_FS_VERSION_ID}/elements`,
  );

  const isFs = (e: { elementType: string }) =>
    e.elementType === "FEATURESTUDIO" || e.elementType === "FeatureStudio";

  // Prefer the env-hinted element only if it's actually a Feature Studio;
  // otherwise fall back to the first FEATURESTUDIO in the document. This
  // protects against the common mistake of pasting the Part Studio's URL
  // elementId into ONSHAPE_FS_ELEMENT_ID.
  let chosen = elements.find(
    (e) => e.id === env.ONSHAPE_FS_ELEMENT_ID && isFs(e),
  );
  if (!chosen) chosen = elements.find(isFs);
  if (!chosen) {
    throw new Error(
      `Could not find Feature Studio element in document ${env.ONSHAPE_FS_DOCUMENT_ID} v${env.ONSHAPE_FS_VERSION_ID}. Elements: ${JSON.stringify(elements.map((e) => ({ id: e.id, name: e.name, elementType: e.elementType })))}`,
    );
  }

  const resolved: ResolvedFsRef = {
    fsElementId: chosen.id,
    microversionId: chosen.microversionId,
  };
  fsRefCache.set(cacheKey, resolved);
  return resolved;
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
    scaleExpression?: string;
    rotationExpression?: string;
    name?: string;
    sketchPlaneQueries?: unknown[];
    originQueries?: unknown[];
  },
): Promise<{ result: unknown; namespace: string; debugBody: unknown }> {
  const env = getEnv();
  const { fsElementId, microversionId } = await resolvePublishedFsRef(userId);
  const namespace = `e${fsElementId}::m${microversionId}`;

  const body = {
    btType: "BTFeatureDefinitionCall-1406",
    feature: {
      btType: "BTMFeature-134",
      featureType: env.ONSHAPE_FS_FEATURE_NAME,
      namespace,
      name: options.name ?? "Google Fonts to Sketch",
      suppressed: false,
      parameters: [
        {
          btType: "BTMParameterQueryList-148",
          parameterId: "sketchPlane",
          queries: options.sketchPlaneQueries ?? [],
        },
        {
          btType: "BTMParameterQueryList-148",
          parameterId: "origin",
          queries: options.originQueries ?? [],
        },
        {
          btType: "BTMParameterQuantity-147",
          parameterId: "scale",
          expression: options.scaleExpression ?? "10 mm",
        },
        {
          btType: "BTMParameterQuantity-147",
          parameterId: "offsetX",
          expression: "0 mm",
        },
        {
          btType: "BTMParameterQuantity-147",
          parameterId: "offsetY",
          expression: "0 mm",
        },
        {
          btType: "BTMParameterQuantity-147",
          parameterId: "rotation",
          expression: options.rotationExpression ?? "0 deg",
        },
        {
          btType: "BTMParameterString-149",
          parameterId: "curveData",
          value: options.curveJson,
        },
      ],
    },
  };

  try {
    const result = await onshapeFetch(
      userId,
      `/api/v9/partstudios/d/${ref.documentId}/w/${ref.workspaceId}/e/${ref.elementId}/features`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    return { result, namespace, debugBody: body };
  } catch (e) {
    if (e instanceof OnshapeApiError) {
      // Re-wrap so the calling route can show the body that was sent.
      throw new OnshapeApiError(e.status, {
        onshapeError: e.body,
        debugSentBody: body,
        debugNamespace: namespace,
      });
    }
    throw e;
  }
}
