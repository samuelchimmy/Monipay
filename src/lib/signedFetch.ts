/**
 * Signed Fetch Utility
 * 
 * Adds HMAC-SHA256 request signing to edge function calls.
 * This prevents replay attacks and ensures request integrity.
 * 
 * The signing secret is a publishable key (like Stripe's pk_*) — 
 * it adds a barrier against casual abuse but is NOT truly secret.
 */

const SIGNING_SECRET = import.meta.env.VITE_APP_SIGNING_SECRET || '';

async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate request signature headers for an edge function call.
 */
export async function getSignatureHeaders(body: string): Promise<Record<string, string>> {
  if (!SIGNING_SECRET) {
    return {};
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}.${body}`;
  const signature = await hmacSign(message, SIGNING_SECRET);

  return {
    'x-request-timestamp': timestamp,
    'x-request-signature': signature,
  };
}

/**
 * Signed fetch — wraps fetch() with HMAC request signing.
 * Drop-in replacement for raw fetch calls to edge functions.
 */
export async function signedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const body = typeof options.body === 'string' ? options.body : '';
  const sigHeaders = await getSignatureHeaders(body);

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...sigHeaders,
    },
  });
}

/**
 * Helper to invoke supabase edge functions with signing.
 * Use this instead of supabase.functions.invoke() for signed calls.
 */
export async function signedInvoke(
  functionName: string,
  options: { body?: unknown; method?: string } = {}
): Promise<{ data: unknown; error: Error | null }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const bodyStr = options.body ? JSON.stringify(options.body) : '';
  const sigHeaders = await getSignatureHeaders(bodyStr);

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/${functionName}`,
      {
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
          ...sigHeaders,
        },
        body: bodyStr || undefined,
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      return { data: null, error: new Error(data.error || `HTTP ${response.status}`) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
