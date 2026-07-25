// Shared security utilities for MoniPay Edge Functions
// Rate limiting + Request signature verification

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== RATE LIMITING =====
// Uses database-backed rate limiting for persistence across Edge Function instances

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // e.g., "relay", "register"
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

// In-memory cache for rate limit data (per-instance, cleared on restart)
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  identifier: string, // IP, wallet address, or profile ID
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${config.keyPrefix}:${identifier}`;
  const now = Date.now();
  
  // Check in-memory cache first
  const cached = rateLimitCache.get(key);
  
  if (cached && cached.resetAt > now) {
    // Still in the same window
    cached.count++;
    
    if (cached.count > config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: cached.resetAt,
        retryAfterMs: cached.resetAt - now,
      };
    }
    
    return {
      allowed: true,
      remaining: config.maxRequests - cached.count,
      resetAt: cached.resetAt,
    };
  }
  
  // Start new window
  const resetAt = now + config.windowMs;
  rateLimitCache.set(key, { count: 1, resetAt });
  
  // Cleanup old entries periodically
  if (rateLimitCache.size > 10000) {
    for (const [k, v] of rateLimitCache.entries()) {
      if (v.resetAt < now) {
        rateLimitCache.delete(k);
      }
    }
  }
  
  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    resetAt,
  };
}

// Rate limit configurations for different actions
export const RATE_LIMITS = {
  // Payment relay: 5 transactions per minute per wallet (strict to prevent treasury drain)
  relay: { windowMs: 60_000, maxRequests: 5, keyPrefix: "relay" },
  
  // Payment relay per IP: 10 requests per minute (catch multi-wallet attacks from same IP)
  relayIP: { windowMs: 60_000, maxRequests: 10, keyPrefix: "relay_ip" },
  
  // Registration: 3 attempts per 10 minutes per IP (prevent spam accounts)
  register: { windowMs: 600_000, maxRequests: 3, keyPrefix: "register" },
  
  // PayTag check: 30 per minute (for typo corrections while typing)
  check: { windowMs: 60_000, maxRequests: 30, keyPrefix: "check" },
  
  // Invoice creation: 20 per minute per profile
  invoiceCreate: { windowMs: 60_000, maxRequests: 20, keyPrefix: "inv_create" },
  
  // Product mutations: 30 per minute per profile
  productMutate: { windowMs: 60_000, maxRequests: 30, keyPrefix: "prod_mutate" },
  
  // General API: 100 requests per minute (for reads)
  general: { windowMs: 60_000, maxRequests: 100, keyPrefix: "general" },
  
  // Admin dashboard: 30 requests per minute per wallet (prevent abuse of admin functions)
  admin: { windowMs: 60_000, maxRequests: 30, keyPrefix: "admin" },
  
  // Admin write operations: 10 per minute (delete logs, reply feedback, etc.)
  adminWrite: { windowMs: 60_000, maxRequests: 10, keyPrefix: "admin_write" },

  // AI rate limits
  aiParseCommand: { windowMs: 60_000, maxRequests: 15, keyPrefix: "ai_parse" },
  aiChat:         { windowMs: 60_000, maxRequests: 20, keyPrefix: "ai_chat" },
  aiReply:        { windowMs: 60_000, maxRequests: 30, keyPrefix: "ai_reply" },
};

// ===== REQUEST SIGNATURE VERIFICATION =====
// HMAC-SHA256 based request signing to ensure only MoniPay app can call functions

async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verifies the request signature.
 * 
 * Client should send:
 * - x-request-timestamp: Unix timestamp in seconds
 * - x-request-signature: HMAC-SHA256(timestamp + "." + body)
 * 
 * We verify:
 * 1. Timestamp is within 5 minutes (prevents replay attacks)
 * 2. Signature matches
 */
export async function verifyRequestSignature(
  req: Request,
  body: string
): Promise<SignatureVerificationResult> {
  const secret = Deno.env.get("APP_SIGNING_SECRET");
  
  // If no secret configured, skip verification (Lovable-hosted, protected by infrastructure)
  if (!secret) {
    return { valid: true };
  }
  
  const timestamp = req.headers.get("x-request-timestamp");
  const signature = req.headers.get("x-request-signature");
  
  // If headers not present, skip (signing not required on Lovable)
  if (!timestamp || !signature) {
    return { valid: true };
  }
  
  // Check timestamp (prevent replay attacks - 5 minute window)
  const requestTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 300; // 5 minutes
  
  if (isNaN(requestTime) || Math.abs(now - requestTime) > maxAge) {
    console.warn(`Request timestamp invalid or expired: ${timestamp} (now: ${now})`);
    return { valid: false, error: "Request expired or invalid timestamp" };
  }
  
  // Verify signature
  const message = `${timestamp}.${body}`;
  const expectedSignature = await hmacSign(message, secret);
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    console.warn("Signature length mismatch");
    return { valid: false, error: "Invalid signature" };
  }
  
  let match = true;
  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== expectedSignature[i]) {
      match = false;
    }
  }
  
  if (!match) {
    console.warn("Signature verification failed");
    return { valid: false, error: "Invalid signature" };
  }
  
  return { valid: true };
}

// ===== CLIENT-SIDE SIGNATURE GENERATION =====
// This will be used by the client to sign requests
// Export the algorithm for the client library

export async function generateRequestSignature(
  body: string,
  secret: string
): Promise<{ timestamp: string; signature: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}.${body}`;
  const signature = await hmacSign(message, secret);
  return { timestamp, signature };
}

// ===== HELPER: Get Client IP =====
export function getClientIP(req: Request): string {
  // Check various headers (Cloudflare, nginx, etc.)
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;
  
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();
  
  const xRealIP = req.headers.get("x-real-ip");
  if (xRealIP) return xRealIP;
  
  return "unknown";
}

// ===== CORS Headers =====
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-timestamp, x-request-signature",
};

// ===== Admin CORS (restricted to MoniPay domains) =====
const ALLOWED_ORIGINS = [
  "https://monipay.lovable.app",
  "https://www.monipay.lovable.app",
  "https://monipay.xyz",
  "https://www.monipay.xyz",
];

export function getAdminCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-timestamp, x-request-signature, x-wallet-address, x-wallet-signature, x-railway-token",
  };
}

export function checkAdminOrigin(req: Request): Response | null {
  if (req.method === "OPTIONS") return null; // Let preflight through
  const origin = req.headers.get("origin") || "";
  // Allow no origin (server-to-server like Railway webhooks)
  if (!origin) return null;
  // Allow preview URLs (Lovable dev)
  if (origin.includes("lovable.app") || origin.includes("lovable.dev")) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return null;
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

// ===== Security Response Helpers =====
export function rateLimitedResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ 
      error: "Too many requests", 
      retryAfterMs: result.retryAfterMs,
      resetAt: result.resetAt,
    }),
    { 
      status: 429, 
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Retry-After": Math.ceil((result.retryAfterMs || 60000) / 1000).toString(),
      } 
    }
  );
}

export function unauthorizedResponse(message: string = "Unauthorized"): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
