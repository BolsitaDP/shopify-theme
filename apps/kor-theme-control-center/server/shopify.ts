import { jwtVerify, type JWTPayload } from 'jose';

const SHOPIFY_TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
const SHOPIFY_ID_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:id_token';
const SHOPIFY_ONLINE_ACCESS_TOKEN = 'urn:shopify:params:oauth:token-type:online-access-token';

export interface ShopifyEnv {
  apiKey: string;
  apiSecret: string;
}

export function getShopifyEnv(): ShopifyEnv {
  const apiKey = process.env.SHOPIFY_API_KEY?.trim() ?? '';
  const apiSecret = process.env.SHOPIFY_API_SECRET?.trim() ?? '';

  if (!apiKey || !apiSecret) {
    throw new Error('Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET');
  }

  return { apiKey, apiSecret };
}

export async function verifySessionToken(sessionToken: string, env: ShopifyEnv): Promise<JWTPayload> {
  const secret = new TextEncoder().encode(env.apiSecret);
  const { payload } = await jwtVerify(sessionToken, secret, {
    audience: env.apiKey,
  });

  return payload;
}

export function getShopFromSessionPayload(payload: JWTPayload): string {
  const dest = typeof payload.dest === 'string' ? payload.dest : '';
  if (dest) {
    const hostname = new URL(dest).hostname;
    if (hostname.endsWith('.myshopify.com')) return hostname;
  }

  const iss = typeof payload.iss === 'string' ? payload.iss : '';
  if (iss) {
    const hostname = new URL(iss).hostname;
    if (hostname.endsWith('.myshopify.com')) return hostname;
  }

  throw new Error('Could not resolve shop domain from session token');
}

export async function exchangeForAdminAccessToken(
  shop: string,
  sessionToken: string,
  env: ShopifyEnv
): Promise<string> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.apiKey,
      client_secret: env.apiSecret,
      grant_type: SHOPIFY_TOKEN_EXCHANGE_GRANT,
      subject_token: sessionToken,
      subject_token_type: SHOPIFY_ID_TOKEN_TYPE,
      requested_token_type: SHOPIFY_ONLINE_ACCESS_TOKEN,
    }),
  });

  const payload = (await response.json()) as { access_token?: string; error_description?: string };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? 'Could not exchange session token for access token');
  }

  return payload.access_token;
}

export async function adminGraphql<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (!response.ok) {
    const firstError = payload.errors?.[0]?.message;
    throw new Error(firstError ?? 'Admin GraphQL request failed');
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  if (!payload.data) {
    throw new Error('Admin GraphQL response did not include data');
  }

  return payload.data;
}
